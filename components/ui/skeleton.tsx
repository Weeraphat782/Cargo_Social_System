"use client";

import { clsx } from "clsx";

export function Skeleton({
  variant = "line",
  width,
  height,
  className,
  style,
}: {
  variant?: "line" | "card" | "circle";
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const w = width === undefined ? "100%" : typeof width === "number" ? `${width}px` : width;
  const h =
    height === undefined
      ? variant === "line"
        ? 14
        : variant === "circle"
          ? 40
          : 120
      : typeof height === "number"
        ? height
        : height;

  return (
    <div
      className={clsx("shimmer-block", className)}
      style={{
        width: w,
        height: typeof h === "number" ? h : h,
        borderRadius: variant === "circle" ? "50%" : variant === "card" ? 12 : 6,
        ...style,
      }}
      aria-hidden
    />
  );
}
