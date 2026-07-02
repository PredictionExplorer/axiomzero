import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#120f0a",
          border: "4px solid #d87932",
          borderRadius: 40,
          color: "#f4eee2",
          fontSize: 72,
          fontWeight: 700,
        }}
      >
        AZ
      </div>
    ),
    size,
  );
}
