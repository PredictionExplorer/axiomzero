import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

const copper = "#d87932";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "transparent",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            backgroundColor: "rgba(216, 121, 50, 0.1)",
            border: `20px solid ${copper}`,
            borderRadius: "9999px",
            color: copper,
            display: "flex",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 150,
            fontWeight: 700,
            height: 376,
            justifyContent: "center",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            paddingTop: 4,
            width: 376,
          }}
        >
          AZ
        </div>
      </div>
    ),
    size,
  );
}
