import React, { useState, useEffect, useRef, useCallback } from "react";
import { Container, Row, Col, Form, Button, Card } from "react-bootstrap";
import Spinner from "react-bootstrap/Spinner"
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

  // Keep track of the current fetch so we can cancel
  const controllerRef = useRef(null);
  // Reuse one OffscreenCanvas to reduce allocations
  const canvasRef = useRef(new OffscreenCanvas(224, 224));

  const fileInputRef = useRef(null);

  // Clean up blob URLs when unmounting or changing preview
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  // Handle file selection with type/size checks
  const handleFileChange = useCallback((e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setResult({ error: "Invalid file type—please upload an image." });
      return;
    }
    const MAX_SIZE = 15 * 1024 * 1024; // 15 MiB
    if (selected.size > MAX_SIZE) {
      setResult({ error: "File too large—max 15 MB." });
      return;
    }
    setFile(selected);
    setResult(null);
    setPreviewUrl(URL.createObjectURL(selected));
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

      const blob = await canvas.convertToBlob({ type: "image/png" });
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((str, byte) => str + String.fromCharCode(byte), "")
      );

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
        setResult({ error: "Failed to classify." });
      }
    } finally {
      setLoading(false);
      controllerRef.current = null;
    }
  }, [file]);

  // Cancel or retry handler
  const handleActionClick = () => {
    if (loading) {
      controllerRef.current?.abort();
    } else if (result) {
      // Try again resets everything except environment
      setFile(null);
      setPreviewUrl(null);
      setResult(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      classifyCard();
    }
  };

  return (
    <Container className="py-4">
      <h1 className="text-center mb-4">Card Classifier</h1>

      {/* Instructions block */}
      <Card className="mb-4">
        <Card.Body>
          <Card.Text>
            This simple app uses a trained TensorFlow model running on a serverless endpoint to identify playing cards from a photo.
          </Card.Text>
          <Card.Text>
            To get started, click <strong>Choose File</strong> and select an image of a single card (JPEG or PNG, under 15 MB). Once you’ve picked a file, hit <strong>Classify</strong> to upload and analyze it.
          </Card.Text>
          <Card.Text>
            Feel free to <strong>Cancel</strong> any in-flight request, or click <strong>Try Again</strong> after a result to reset and classify a new card.
          </Card.Text>
        </Card.Body>
      </Card>


      {/* Preview + filename */}
      {previewUrl && (
        <Row className="justify-content-center mb-3 text-center">
          <Col xs="auto" className="position-relative">
            <img
              src={previewUrl}
              alt="Card preview"
              style={{ height: 224, width: "auto" }}
              className="border rounded"
            />
            {loading && (
              <Spinner
                animation="border"
                role="status"
                variant="primary"
                size="md"
                style={{
                  position:   "absolute",
                  top:        "50%",
                  left:       "50%",
                  width:      "2rem",    // default spinner size
                  height:     "2rem",
                  marginTop:  "-1rem",   // half of height
                  marginLeft: "-1rem",   // half of width
                }}
              />
            )}
          </Col>
         <Col xs={12} className="mt-2">
            {file.name}
          </Col>
        </Row>
      )}

      {/* File input + action button */}
      <Row className="justify-content-center mb-3">
        {!file && (
          <Col xs="auto">
            <Form.Control ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} />
          </Col>
        )}
        {file && (
          <Col xs="auto">
            <Button
              onClick={handleActionClick}
              disabled={!file && !result}
              variant={loading ? "outline-danger" : "primary"}
            >
              {loading ? "Cancel" : result ? "Try Again" : "Classify"}
            </Button>
          </Col>
        )}
      </Row>

      {/* Result or error */}
      {result && !result.error && (
        <Card bg="light" className="text-center">
          <Card.Body>
            <Card.Title>Prediction: {result.label}</Card.Title>
            <Card.Text>Confidence: {result.confidence}%</Card.Text>
          </Card.Body>
        </Card>
      )}
      {result?.error && (
        <p className="text-danger text-center mt-3">{result.error}</p>
      )}
    </Container>
  );
}
