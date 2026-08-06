"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

/**
 * Renders a raw Baileys QR payload onto a canvas. Client-side only; the QR
 * string never leaves the browser mid-frame.
 */
export function QrDisplay({ value, size = 220 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 2 })
        .catch((err) => console.error("Failed to render WhatsApp QR:", err));
    }
  }, [value, size]);

  return <canvas ref={canvasRef} className="rounded-lg" />;
}

export default QrDisplay;