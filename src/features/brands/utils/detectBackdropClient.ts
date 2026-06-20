import type { LogoBackdrop } from "../components/BrandLogo";

// Client-side mirror of `analyzeLogo.ts` (which uses sharp on the server). Lets
// the brand form show an accurate AUTO preview without a round-trip. Returns
// `null` when it can't decide - notably when the image host doesn't send CORS
// headers, which taints the canvas and makes `getImageData` throw; the caller
// then shows a "computed on save" placeholder instead of a misleading tile.

const TRANSPARENCY_THRESHOLD = 0.05;
const LIGHT_LUMINANCE = 0.55;
const SAMPLE = 64;

export function detectLogoBackdropClient(url: string): Promise<LogoBackdrop | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(null);

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.clearRect(0, 0, SAMPLE, SAMPLE);
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);

        // Throws (SecurityError) if the image is cross-origin without CORS.
        const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);
        const pixelCount = SAMPLE * SAMPLE;

        let transparent = 0;
        let lumWeightedSum = 0;
        let alphaSum = 0;

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3] / 255;
          if (a < 0.85) transparent += 1;
          const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          lumWeightedSum += lum * a;
          alphaSum += a;
        }

        if (transparent / pixelCount < TRANSPARENCY_THRESHOLD) return resolve("NEUTRAL");
        const avgLuminance = alphaSum > 0 ? lumWeightedSum / alphaSum : 0.5;
        resolve(avgLuminance >= LIGHT_LUMINANCE ? "DARK" : "LIGHT");
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = url;
  });
}
