import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The NIYOM mark on its forest cover: an N engraved as three parallel strokes.
export default function AppleIcon() {
  const path = "M11 31V9l18 22V9";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1e3b2f" }}>
        <svg width="180" height="180" viewBox="0 0 40 40">
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={path} stroke="#e8dcb5" strokeWidth="9.5" />
            <path d={path} stroke="#1e3b2f" strokeWidth="5.4" />
            <path d={path} stroke="#e8dcb5" strokeWidth="1.6" />
          </g>
        </svg>
      </div>
    ),
    size
  );
}
