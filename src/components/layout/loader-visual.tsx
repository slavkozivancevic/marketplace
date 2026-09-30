import Image from "next/image";
import { BrandLockup } from "./brand-lockup";
import { HERO_IMAGE_URL } from "./hero-image";

/**
 * Shared visual content of the full-page branded loader: the faint background
 * photo and the brand lockup with the comet orbiting the mark. No hooks, no
 * Clerk/intl dependency - safe to render from a plain Server Component.
 *
 * The lockup is the same `<BrandLockup>` the home hero and both headers use,
 * which is the point: the loader is the brand mark waiting, not an unrelated
 * spinner that happens to have a logo in the middle of it.
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
 *
 * There is a THIRD copy of this markup that React cannot share:
 * `localeSwitchOverlay.ts` builds it as an innerHTML string outside React.
 * Any change here has to be mirrored there, and the classes involved have to
 * stay plain CSS classes from globals.css - Tailwind never scans that string,
 * so a utility used only there is never generated.
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

      <BrandLockup size="loader" orientation="vertical" effect="orbit" />
    </>
  );
}
