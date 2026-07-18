import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Branded 1200x630 social-share card used as the default OG/Twitter image for
 * pages without their own imagery (home, catalog). Entity pages keep their own
 * product/category/brand images. Generated on the fly so it needs no design
 * asset; cached hard since it never changes.
 *
 * Rendered in Geist (the app's --font-sans) so the wordmark matches the header
 * lockup; satori needs raw font data, served from the app's own public/fonts
 * like the invoice PDF does.
 */
async function geistFonts() {
  const dir = path.join(process.cwd(), "public/fonts");
  const [regular, bold] = await Promise.all([
    readFile(path.join(dir, "Geist-Regular.ttf")),
    readFile(path.join(dir, "Geist-Bold.ttf")),
  ]);
  return [
    { name: "Geist", data: regular, weight: 400 as const },
    { name: "Geist", data: bold, weight: 700 as const },
  ];
}

export async function GET() {
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
          background: "linear-gradient(135deg, #040511 0%, #191731 55%, #483e90 100%)",
          color: "#f2eee7",
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", fontSize: 88, fontWeight: 700, letterSpacing: "-0.03em" }}>
          <span>Market</span>
          {/* satori can't kern across text runs; -0.08em restores the t|V
              spacing measured on the opentype-generated brand lockup */}
          <span style={{ color: "#9076f3", marginLeft: "-0.08em" }}>Verse</span>
        </div>
        <div style={{ marginTop: 16, fontSize: 36, opacity: 0.8, color: "#c5cfdb" }}>
          Modern commerce, built for scale
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: await geistFonts(),
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
