import { ImageResponse } from "next/og";

/**
 * Square 512x512 brand logo for the `Organization` JSON-LD `logo` field.
 * Google prefers a real logo (>=112px, square) over a favicon. Generated on
 * the fly so it needs no design asset; swap for a real logo file when one
 * exists. Cached hard since it never changes.
 */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          fontSize: 320,
          fontWeight: 800,
        }}
      >
        M
      </div>
    ),
    {
      width: 512,
      height: 512,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
