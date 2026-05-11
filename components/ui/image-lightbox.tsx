"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Props = {
  images: string[];
  initialIndex: number;
  onClose: () => void;
};

export function ImageLightbox({ images, initialIndex, onClose }: Props) {
  const [idx, setIdx] = useState(initialIndex);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);
  const src = images[idx] ?? "";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* close */}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: 14,
          left: 16,
          background: "none",
          border: "none",
          color: "#fff",
          fontSize: 22,
          cursor: "pointer",
          lineHeight: 1,
          padding: "4px 8px",
          opacity: 0.85,
        }}
      >
        ✕
      </button>

      {/* counter */}
      {images.length > 1 && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 20,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            background: "rgba(0,0,0,0.45)",
            borderRadius: 6,
            padding: "3px 10px",
          }}
        >
          {idx + 1} / {images.length}
        </div>
      )}

      {/* image */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(90vw, 900px)",
          height: "min(85vh, 900px)",
        }}
      >
        <Image
          src={src}
          alt={`Image ${idx + 1}`}
          fill
          sizes="90vw"
          style={{ objectFit: "contain" }}
          unoptimized={src.startsWith("data:")}
        />
      </div>

      {/* prev / next */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Previous image"
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.5)",
              border: "none",
              color: "#fff",
              fontSize: 24,
              cursor: "pointer",
              borderRadius: 8,
              padding: "10px 18px",
              lineHeight: 1,
            }}
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Next image"
            style={{
              position: "absolute",
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.5)",
              border: "none",
              color: "#fff",
              fontSize: 24,
              cursor: "pointer",
              borderRadius: 8,
              padding: "10px 18px",
              lineHeight: 1,
            }}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
