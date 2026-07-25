import { LoaderVisual } from "./loader-visual";

/**
 * Static stand-in for {@link AppLoader}, used as the Suspense `fallback`
 * around `<LocaleDataProviders>` in the `[locale]` root layout.
 *
 * That boundary suspends on real async work (loading the locale's messages,
 * fetching currency rates) both on first boot and on every locale switch.
 * `<ClerkGate>`'s `<AppLoader>` lives *inside* the boundary, so it isn't
 * mounted yet either - this needs no Clerk/intl context (it renders while
 * both are still unavailable), so it stands in and keeps the exact same
 * loader on screen continuously through that gap. It shares `<LoaderVisual>`
 * with `<AppLoader>` so the two are pixel-identical and the handoff between
 * them is invisible - including the faint background photo, which is
 * `z-index: -1` and easy to accidentally omit (this component used to, which
 * showed up as the background photo flickering in and out).
 */
export function BootLoaderFallback() {
  return (
    <div
      aria-hidden
      role="status"
      className="fixed inset-0 z-100 grid place-items-center bg-background"
    >
      <LoaderVisual />
    </div>
  );
}
