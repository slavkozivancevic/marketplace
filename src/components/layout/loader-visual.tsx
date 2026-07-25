import Image from "next/image";
import { BrandMark } from "./brand-mark";
import { BrandWordmark } from "./brand-wordmark";
import { HERO_IMAGE_URL } from "./hero-image";

/**
 * Shared visual content of the full-page branded loader: the faint background
 * photo, the spinning ring around the brand mark, and the wordmark + bouncing
 * dots underneath. No hooks, no Clerk/intl dependency - safe to render from a
 * plain Server Component.
 *
 * Used by both `<AppLoader>` (Clerk boot gate / org switch) and
 * `<BootLoaderFallback>` (the Suspense fallback around the locale's
 * messages/currency data). Keeping the markup in one place means those two
 * loaders are always pixel-identical, so a page can never visibly hand off
 * from one to the other - which is what made the background photo appear to
 * flicker in and out before this was unified: `<BootLoaderFallback>` used to
 * omit its own copy of the image (image is `z-index: -1`, faint by design;
 * relying on the caller to see it through wasn't safe), so whichever loader
 * was active determined whether a background photo showed at all.
 */
export function LoaderVisual() {
  return (
    <>
      <div className="page-background">
        <Image
          src={HERO_IMAGE_URL}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          unoptimized
        />
      </div>

      <div className="flex flex-col items-center gap-8">
        <div className="relative h-24 w-24">
          <div className="app-loader-ring absolute inset-0 animate-spin rounded-full animation-duration-[1s]" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl brand-tile shadow-lg shadow-primary/30 animate-pulse">
              <BrandMark className="h-9 w-9" />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] pl-[0.3em] text-muted-foreground">
            <BrandWordmark />
          </span>
          <div className="flex items-center gap-1.5">
            <span className="app-loader-dot h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="app-loader-dot h-1.5 w-1.5 rounded-full bg-primary [animation-delay:0.15s]" />
            <span className="app-loader-dot h-1.5 w-1.5 rounded-full bg-primary [animation-delay:0.3s]" />
          </div>
        </div>
      </div>
    </>
  );
}
