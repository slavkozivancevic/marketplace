import { ImageResponse } from "next/og";

/**
 * Branded 1200x630 social-share card used as the default OG/Twitter image for
 * pages without their own imagery (home, catalog). Entity pages keep their own
 * product/category/brand images. Generated on the fly so it needs no design
 * asset; cached hard since it never changes.
 */
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1e1b4b 55%, #4338ca 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: "-0.03em" }}>
          Marketplace
        </div>
        <div style={{ marginTop: 16, fontSize: 36, opacity: 0.8 }}>
          Modern commerce, built for scale
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
