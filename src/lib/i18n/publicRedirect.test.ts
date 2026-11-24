import { describe, it, expect } from "vitest";
import { publicRedirectLocation, withPublicRedirect } from "./publicRedirect";

const HOST = "shop.example.dev";

describe("publicRedirectLocation", () => {
  it("drops the internal port from a redirect back to the forwarded host", () => {
    // What next-intl built behind ngrok: the public host with Next's own port.
    expect(publicRedirectLocation(`https://${HOST}:3000/en/sign-in?redirect_url=x`, HOST)).toBe(
      `https://${HOST}/en/sign-in?redirect_url=x`,
    );
  });

  it("leaves a redirect that already has no port alone", () => {
    // Staging: CloudFront's host, no port anywhere - nothing to change.
    expect(publicRedirectLocation(`https://${HOST}/en/sign-in`, HOST)).toBeNull();
  });

  it("keeps the port when the forwarded host names one", () => {
    // The visitor really used :8443, so the redirect must too.
    expect(publicRedirectLocation(`https://${HOST}:8443/en`, `${HOST}:8443`)).toBeNull();
  });

  it("never touches a redirect to another host", () => {
    expect(publicRedirectLocation("https://accounts.example.com:3000/x", HOST)).toBeNull();
  });

  it("does nothing without a forwarded host", () => {
    // Plain localhost: the port in the URL is the one the browser used.
    expect(publicRedirectLocation("http://localhost:3000/en/sign-in", null)).toBeNull();
  });

  it("leaves a relative redirect to the browser", () => {
    expect(publicRedirectLocation("/en/sign-in", HOST)).toBeNull();
  });

  it("matches the host case-insensitively", () => {
    expect(publicRedirectLocation(`https://${HOST}:3000/en`, HOST.toUpperCase())).toBe(`https://${HOST}/en`);
  });
});

describe("withPublicRedirect", () => {
  it("rewrites the Location header of a redirect in place", () => {
    const res = new Response(null, { status: 307, headers: { location: `https://${HOST}:3000/en` } });
    const out = withPublicRedirect(new Headers({ "x-forwarded-host": HOST }), res);

    expect(out).toBe(res);
    expect(out.headers.get("location")).toBe(`https://${HOST}/en`);
  });

  it("passes a response without a Location through untouched", () => {
    const res = new Response("ok");

    expect(withPublicRedirect(new Headers({ "x-forwarded-host": HOST }), res).headers.get("location")).toBeNull();
  });
});
