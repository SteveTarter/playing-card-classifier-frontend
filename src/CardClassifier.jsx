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
  // visible preview
  const previewCanvasRef = useRef(null);

  // Camera capture devices
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const fileInputRef = useRef(null);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [previewUrl]);

  // Zoom factor for digital zoom
  const ZOOM = 3; // 2x zoom-in

  // Attach MediaStream to video and start/stop render loop for preview canvas
  useEffect(() => {
    let frameId;
    if (cameraActive && videoRef.current && previewCanvasRef.current && streamRef.current) {
      const video = videoRef.current;
      const canvas = previewCanvasRef.current;

      // attach stream to hidden video for drawing
      videoRef.current.srcObject = streamRef.current;
      const playPromise = videoRef.current.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(err => console.warn('Video play interrupted', err));
      }

      // once metadata is loaded, adjust canvas to preserve aspect
      video.onloadedmetadata = () => {
        const cw = 224;
        const ch = Math.round((video.videoHeight / video.videoWidth) * cw);
        canvas.width = cw;
        canvas.height = ch;
        canvas.style.width = `${cw}px`;
        canvas.style.height = `${ch}px`;
      };

      // draw loop into canvas
      const draw = () => {
        const ctx = canvas.getContext('2d');
        const sw = video.videoWidth / ZOOM;
        const sh = video.videoHeight / ZOOM;
        const sx = (video.videoWidth - sw) / 2;
        const sy = (video.videoHeight - sh) / 2;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        frameId = requestAnimationFrame(draw);
      };
      draw();
    }
    return () => cancelAnimationFrame(frameId);
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
      // Request high-res with continuous autofocus
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          focusMode: 'continuous', // may work on some devices
          zoom: true // allow zoom capability
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setCameraActive(true);
      setError(null);
    } catch (err) {
      console.error('openCamera error', err);
      setError('Cannot access camera or adjust focus');
    }
  }, []);

  // Capture a photo from the camera
  const capturePhoto = useCallback(async () => {
    try {
      // generate preview via the visible canvas
      const previewCanvas = previewCanvasRef.current;
      if (previewCanvas) {
        previewCanvas.toBlob(blob => {
          setPreviewUrl(URL.createObjectURL(blob));
          // set the zoomed blob as file for classification
          setFile(new File([blob], 'capture.png', { type: 'image/png' }));
        }, 'image/png');
      }
      setResult(null);
    } catch (e) {
      console.error('capture error', e);
      setError('Capture failed');
    } finally {
      streamRef.current?.getTracks().forEach(t => t.stop());
      setCameraActive(false);
    }
  }, []);

  // Close the camera
  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    setCameraActive(false);
  }, []);

  // Main classify routine
  const classifyCard = useCallback(async () => {
    if ((!file && !previewCanvasRef.current) || !API_BASE_URL) return;
    setLoading(true);
    setResult(null);
    setError(null);

    // Prepare AbortController
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      // If the user uploaded a file, redraw that into the offscreen canvas and grab its dataURL.
      // Otherwise (camera flow), grab the dataURL from the preview canvas.
      let dataUrl;
      if (file && !cameraActive) {
        const imgBitmap = await createImageBitmap(file);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasRef.current.width;
        tempCanvas.height = canvasRef.current.height;
        const tctx = tempCanvas.getContext('2d');
        tctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        tctx.drawImage(imgBitmap, 0, 0, tempCanvas.width, tempCanvas.height);
        dataUrl = tempCanvas.toDataURL('image/png');
      } else {
        dataUrl = previewCanvasRef.current.toDataURL('image/png');
      }
      const base64 = dataUrl.split(',')[1];

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
        setError("Request timed out.");
      } else if (err.message.includes('blocked by CORS')) {
        setError('CORS error: please enable CORS on the backend or use a proxy.');
      } else {
        setError(err.message || 'Failed to classify.');
      }
      console.error("Classification error:", err);
    } finally {
      setLoading(false);
      controllerRef.current = null;
    }
  }, [file, cameraActive]);

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
        <Row className="justify-content-center mb-3">
          <Col xs="auto" className="text-center">
            <video
              ref={videoRef}
              style={{ display: 'none' }}
              autoPlay
              muted
              playsInline
            />
            <canvas
              ref={previewCanvasRef}
              width={224}
              height={224}
              className="border rounded"
            />
            <div className="mt-2">
              <Button onClick={capturePhoto} variant="primary" className="me-2">Capture</Button>
              <Button onClick={closeCamera} variant="primary">Close</Button>
            </div>
          </Col>
        </Row>
      ) : (
        <>
        <Row className="justify-content-center mb-3 text-center">
          {previewUrl ? (
          <Col xs="auto">
            <img
              src={previewUrl}
              alt="Card preview"
              style={{ maxWidth: 224, maxHeight: 224 }}
              className="border rounded"
            />
            {loading && (
              <Spinner
                animation="border"
                role="status"
                variant="light"
                size="md"
                style={{position:"absolute",top:"50%",left:"50%",width:"2rem",height:"2rem",marginTop:"-1rem",marginLeft:"-1rem"}}
              />
            )}
          </Col>
            ) : (
              <>
                <Col xs="auto">
                  <Form.Control ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} />
                </Col>
                <Col xs="auto">
                  <Button onClick={openCamera} variant="primary">Use Camera</Button>
                </Col>
              </>
            )}
          </Row>
          {file && (
            <Row className="justify-content-center mb-3">
              <Col xs="auto">
                <Button onClick={handleActionClick} variant="primary">
                  {loading ? 'Cancel' : result ? 'Try Again' : 'Classify'}
                </Button>
              </Col>
            </Row>
          )}
        </>
      )}

      {error && <p className="text-danger text-center">{error}</p>}

      {result && (
        <Card bg="dark" text="light" className="text-center">
          <Card.Body>
            <Card.Title>Prediction: {result.label}</Card.Title>
            <Card.Text>Confidence: {result.confidence}%</Card.Text>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
}
