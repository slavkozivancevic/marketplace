/**
 * Keeps a redirect on the address the visitor actually used.
 *
 * Behind a tunnel or proxy (ngrok in local dev) the visitor's `Host` arrives as
 * `x-forwarded-host`, and when it carries no port the visitor reached the
 * default one for the scheme. Next's own server meanwhile fills in
 * `x-forwarded-port` with the port IT listens on (3000), and next-intl copies
 * that onto every locale redirect it builds - so `/sign-in` sent a browser to
 * `https://<tunnel-host>:3000/en/sign-in`, a port the tunnel does not serve,
 * and the page hung until the connection timed out. Every signed-out visit to a
 * private page goes through that redirect.
 *
 * So: a redirect back to the forwarded host, when that host names no port,
 * drops the port. A redirect anywhere else, or a forwarded host that does name
 * a port, is left exactly as it was.
 */
export function publicRedirectLocation(location: string, forwardedHost: string | null): string | null {
  if (!forwardedHost || forwardedHost.includes(":")) return null;
  let url: URL;
  try {
    url = new URL(location);
  } catch {
    // Relative: the browser resolves it against the address it used.
    return null;
  }
  if (url.hostname !== forwardedHost.toLowerCase() || url.port === "") return null;
  url.port = "";
  return url.toString();
}

/** Applies `publicRedirectLocation` to a response, in place. */
export function withPublicRedirect<R extends Response>(headers: Headers, res: R): R {
  const location = res.headers.get("location");
  if (!location) return res;
  const fixed = publicRedirectLocation(location, headers.get("x-forwarded-host"));
  if (fixed) res.headers.set("location", fixed);
  return res;
}
