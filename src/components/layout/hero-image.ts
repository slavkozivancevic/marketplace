/**
 * Shared hero/background image URL. Kept in its own dependency-free module so
 * it can be imported both by the client `HeroBackground` component and by the
 * edge-rendered 404 page (`notFoundResponse`) without pulling client code into
 * the middleware bundle.
 */
export const HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop";