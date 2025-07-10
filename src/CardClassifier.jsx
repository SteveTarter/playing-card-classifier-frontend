import React, { useState, useEffect, useRef, useCallback } from "react";
import { Container, Row, Col, Form, Button, Card } from "react-bootstrap";
import Spinner from "react-bootstrap/Spinner";

// Read from environment; fallback to an empty string
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || process.env.API_BASE_URL || "";
if (!API_BASE_URL) {
  console.warn("API_BASE_URL is not defined in the environment");
}

export default function CardClassifier() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState(null);

  // Keep track of the current fetch so we can cancel
  const controllerRef = useRef(null);
  // Offscreen canvas for fixed 224x224 backend upload
  const canvasRef = useRef(new OffscreenCanvas(224, 224));

  // Camera capture devices
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    };
  }, [previewUrl]);

  // Attach stream to video element when cameraActive changes
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      const playPromise = videoRef.current.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(err => console.warn('Video play interrupted', err));
      }
    }
  }, [cameraActive]);

  // Handle file selection with type/size checks
  const handleFileChange = useCallback((e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setError("Invalid file type—please upload an image.");
      return;
    }
    const MAX_SIZE = 15 * 1024 * 1024;
    if (selected.size > MAX_SIZE) {
      setError("File too large—max 15 MB.");
      return;
    }
    setError(null);
    setFile(selected);
    setResult(null);
    setPreviewUrl(URL.createObjectURL(selected));
  }, []);

  // Open the device camera
  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraActive(true);
      setError(null);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  }, []);

  // Capture a photo from the camera
  const capturePhoto = useCallback(async () => {
    try {
      const video = videoRef.current;
      // 1) capture full-res preview
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = video.videoWidth;
      previewCanvas.height = video.videoHeight;
      const pctx = previewCanvas.getContext('2d');
      pctx.drawImage(video, 0, 0, previewCanvas.width, previewCanvas.height);
      const previewBlob = await new Promise(resolve => previewCanvas.toBlob(resolve, 'image/png'));
      const previewURL = URL.createObjectURL(previewBlob);
      setPreviewUrl(previewURL);
      setResult(null);

      // 2) prepare fixed-224x224 for backend
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const capturedFile = new File([blob], 'capture.png', { type: 'image/png' });
      setFile(capturedFile);
    } catch (err) {
      console.error('Capture error:', err);
      setError('Failed to capture image.');
    } finally {
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      setCameraActive(false);
    }
  }, []);

  // Close the camera
  const closeCamera = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    setCameraActive(false);
  }, []);

  // Main classify routine
  const classifyCard = useCallback(async () => {
    if (!file || !API_BASE_URL) return;
    setLoading(true);
    setResult(null);

    // Prepare AbortController
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {

      const imgBitmap = await createImageBitmap(file);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgBitmap, 0, 0, canvas.width, canvas.height);

      // Convert the image into a Base64 string.
      const buffer = await new Response(file).arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((str, byte) => str + String.fromCharCode(byte), "")
      );

      // Send the image to the ML.
      const res = await fetch(
        `${API_BASE_URL}/predictCardLabel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_base64: base64 }),
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();

      setResult({
        label: String(data.label),
        confidence: (Number(data.confidence) * 100).toFixed(2)
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Classification error:", err);
        setError("Failed to classify.");
      }
    } finally {
      setLoading(false);
      controllerRef.current = null;
    }
  }, [file]);

  const handleActionClick = () => {
    if (loading) {
      controllerRef.current?.abort();
    }
    else if (result) {
      // Try again resets everything except environment
      setFile(null);
      setPreviewUrl(null);
      setResult(null);
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else classifyCard();
  };

  return (
    <Container className="py-4">
      <h1 className="text-center mb-4">Playing Card Classifier</h1>

      <Card className="mb-4">
        <Card.Body>
          <Card.Text>
            This simple app uses a trained TensorFlow model running on a serverless endpoint to identify playing cards from a photo.
          </Card.Text>
          <Card.Text>
            To get started, click <strong>Choose File</strong> or <strong>Use Camera</strong>, then select or capture an image of a single card (JPEG or PNG, under 15 MB). Once ready, hit <strong>Classify</strong>.
          </Card.Text>
          <Card.Text>
            Feel free to <strong>Cancel</strong> any in-flight request, or click <strong>Try Again</strong> after a result to reset.
          </Card.Text>
        </Card.Body>
      </Card>

      {cameraActive ? (
        <Row className="justify-content-center mb-3 text-center">
          <Col xs="auto">
            <video
              ref={videoRef}
              width={224}
              height={224}
              autoPlay
              muted
              playsInline
              className="border rounded"
              style={{ objectFit: 'cover' }}
            />
            <div className="mt-2">
              <Button onClick={capturePhoto} variant="primary" className="me-2">Capture</Button>
              <Button onClick={closeCamera} variant="primary">Close</Button>
            </div>
          </Col>
        </Row>
      ) : previewUrl ? (
        <Row className="justify-content-center mb-3 text-center">
          <Col xs="auto" className="position-relative">
            <img src={previewUrl} alt="Card preview" style={{ maxWidth: 224, maxHeight: 224 }} className="border rounded" />
            {loading && (
              <Spinner animation="border" role="status" variant="light" size="md" style={{position:"absolute",top:"50%",left:"50%",width:"2rem",height:"2rem",marginTop:"-1rem",marginLeft:"-1rem"}} />
            )}
          </Col>
          <Col xs={12} className="mt-2">
            {file.name}
          </Col>
        </Row>
      ) : (
        <Row className="justify-content-center mb-3">
          <Col xs="auto">
            <Form.Control ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} />
          </Col>
          <Col xs="auto">
            <Button onClick={openCamera} variant="primary">Use Camera</Button>
          </Col>
        </Row>
      )}

      {file && (
        <Row className="justify-content-center mb-3">
          <Col xs="auto">
            <Button onClick={handleActionClick} variant={loading ? "outline-danger" : "primary"}>
              {loading ? "Cancel" : result ? "Try Again" : "Classify"}
            </Button>
          </Col>
        </Row>
      )}

      {error && <p className="text-danger text-center mt-3">{error}</p>}

      {result && !result.error && (
        <Card bg="light" className="text-center">
          <Card.Body>
            <Card.Title>Prediction: {result.label}</Card.Title>
            <Card.Text>Confidence: {result.confidence}%</Card.Text>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
}
