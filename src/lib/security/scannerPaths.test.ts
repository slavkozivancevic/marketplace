import { describe, it, expect } from "vitest";
import { isScannerPath } from "./scannerPaths";

describe("isScannerPath", () => {
  it("catches every probe actually observed on staging", () => {
    // Taken verbatim from the CloudWatch error logs, 2026-08-25/26.
    for (const path of [
      "/.git/config",
      "/.git/HEAD",
      "/wp-login.php",
      "/xmlrpc.php",
      "/wp-json/gravitysmtp/v1/tests/mock-data",
    ]) {
      expect(isScannerPath(path), path).toBe(true);
    }
  });

  it("catches the usual credential and source-control probes", () => {
    for (const path of [
      "/.env",
      "/.env.production",
      "/.aws/credentials",
      "/.ssh/id_rsa",
      "/.svn/entries",
      "/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php",
      "/phpmyadmin/index.php",
      "/administrator/",
    ]) {
      expect(isScannerPath(path), path).toBe(true);
    }
  });

  it("leaves every real route of this app alone", () => {
    for (const path of [
      "/",
      "/en",
      "/sr/proizvodi",
      "/sr/proizvodi/aurora-x1-5g-pametni-telefon",
      "/en/products/some-product",
      "/api/products",
      "/api/webhooks/stripe",
      "/dashboard/orders",
      "/admin/audit",
      "/invite/abc123",
      "/sign-in",
    ]) {
      expect(isScannerPath(path), path).toBe(false);
    }
  });

  it("does not block .well-known - ACME and security.txt depend on it", () => {
    // Blocking this would break certificate issuance, which is a far worse
    // outcome than letting a handful of probes through.
    expect(isScannerPath("/.well-known/acme-challenge/token")).toBe(false);
    expect(isScannerPath("/.well-known/security.txt")).toBe(false);
  });

  it("does not fire on a slug that merely resembles a probe", () => {
    // The patterns are anchored to the first segment, so a product whose slug
    // contains one of these words is safe.
    expect(isScannerPath("/en/products/wp-admin-plugin-book")).toBe(false);
    expect(isScannerPath("/en/brands/vendor-supplies")).toBe(false);
    expect(isScannerPath("/sr/proizvodi/git-config-knjiga")).toBe(false);
  });
});
