import React, { useState, useEffect, useRef, useCallback } from "react";

// Read from environment; fallback to a no-op placeholder.
//  In your Lambda/SAM/Serverless config, set API_BASE_URL to your Gateway URL.
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || process.env.API_BASE_URL || "";
if (!API_BASE_URL) {
  console.warn("API_BASE_URL is not defined in the environment");
}

export default function CardClassifier() {
  const [file,      setFile]      = useState(null);
  const [previewUrl,setPreviewUrl]= useState(null);
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);

  // Reuse one OffscreenCanvas to avoid reallocating on every classify
  const canvasRef = useRef(new OffscreenCanvas(224, 224));

  // Clean up blob URLs when unmounting or changing preview
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // File-picker handler with basic validation
  const handleFileChange = useCallback((e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    // 🔒 Security: only accept images under 5 MB
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

  // The main classification routine
  const classifyCard = useCallback(async () => {
    if (!file || !API_BASE_URL) return;
    setLoading(true);
    setResult(null);

    try {
      // Draw into a 224×224 offscreen canvas.  This reduces the payload sent.
      // Since the model was trained on 224x224 images, this is perfectly fine,
      // as long as the scaling is decent.
      const imgBitmap = await createImageBitmap(file);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgBitmap, 0, 0, canvas.width, canvas.height);

      // Get a Blob → ArrayBuffer → base64 (no FileReader blocking)
      const blob = await canvas.convertToBlob({ type: "image/png" });
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer)
          .reduce((str, byte) => str + String.fromCharCode(byte), "")
      );

      // AbortController for timeout protection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      const res = await fetch(
        `${API_BASE_URL}/predictCardLabel`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ image_base64: base64 }),
          signal:  controller.signal
        }
      );
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text().catch(()=>res.statusText);
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult({
        label:      String(data.label),
        confidence: (Number(data.confidence) * 100).toFixed(2)
      });
    } catch (err) {
      console.error("Classification error:", err);
      setResult({
        error: err.name === "AbortError"
               ? "Request timed out. Try again?"
               : "Failed to classify."
      });
    } finally {
      setLoading(false);
    }
  }, [file]);

  return (
    <div className="max-w-sm mx-auto p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4 text-center">Card Classifier</h1>

      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="block w-full text-sm text-gray-500 mt-2"
      />

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Uploaded card preview"
          className="mt-4 border rounded mx-auto"
          style={{ height: 224, width: "auto" }}
        />
      )}

      <button
        onClick={classifyCard}
        disabled={!file || loading}
        className="mt-4 w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading && (
          <div
            style={{
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #3498db",
              borderRadius: "50%",
              width: "1rem",
              height: "1rem",
              marginRight: "0.5rem",
              animation: "spin 1s linear infinite"
            }}
          />
        )}
        {loading ? "Classifying…" : "Classify"}
      </button>

      {result && (
        <div className="mt-6 p-4 bg-gray-50 rounded">
          {result.error ? (
            <p className="text-red-600">Error: {result.error}</p>
          ) : (
            <>
              <p className="text-lg">
                <span className="font-semibold">Prediction:</span> {result.label}
              </p>
              <p className="mt-1">
                <span className="font-semibold">Confidence:</span> {result.confidence}%
              </p>
            </>
          )}
        </div>
      )}

      {/* Inline spinner keyframes */}
      <style>{`
        @keyframes spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
