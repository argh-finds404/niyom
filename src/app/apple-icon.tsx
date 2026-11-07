import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// A notice sheet on the Merit forest, its corner folded, with the engraved N: one rule written
// three times, as notices are. At this size the engraving reads; the favicon uses a solid N.
export default function AppleIcon() {
  const n = "M11 29.5V13l15 16.5V13";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1e3b2f" }}>
        <svg width="180" height="180" viewBox="0 0 40 40">
          <path d="M28.5 0v7.5a4 4 0 0 0 4 4H40V0z" fill="#e8dcb5" opacity="0.5" />
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={n} stroke="#e8dcb5" strokeWidth="8" />
            <path d={n} stroke="#1e3b2f" strokeWidth="4.4" />
            <path d={n} stroke="#e8dcb5" strokeWidth="1.3" />
          </g>
        </svg>
      </div>
    ),
    size
  );
}
