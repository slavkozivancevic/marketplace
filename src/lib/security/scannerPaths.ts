/**
 * Paths that only a vulnerability scanner ever asks for.
 *
 * WHY THIS EXISTS. Every error recorded on staging in a 24h window came from
 * automated probes, not users: `/.git/config` (5x), `/.git/HEAD`,
 * `/wp-login.php`, `/xmlrpc.php`, `/wp-json/gravitysmtp/v1/tests/mock-data`.
 * Not one legitimate page render failed. Left alone they are not merely noise:
 *
 *  - Each probe runs the full middleware and renders a page, so it can WAKE
 *    NEON. The Free plan allows 100 CU-hours a month and suspends the database
 *    outright when they are gone; background scan traffic is a real drain on a
 *    budget nobody is watching.
 *  - They land in the `AppErrors` metric, whose alarm fires at 5 errors in 5
 *    minutes. A single scanner burst would page a human about WordPress paths
 *    on an app that has never run WordPress.
 *  - They cost a Lambda invocation and log volume each.
 *
 * A second burst on 2026-09-01 proved the point and widened the list: six
 * probes in 130ms (`/wp-config.php.bak`, `/env`, `/storage/logs/laravel.log`,
 * `/_ignition/health-check`, `/wp-config.php.swp`, `/actuator/configprops`)
 * missed every pattern below, woke Neon 14 times and tripped the AppErrors
 * alarm at 08:21 UTC. Those shapes are covered now.
 *
 * A WAF would be the textbook answer, but a Web ACL is billed monthly and this
 * project holds a hard $0 rule (ROADMAP #23), so the check lives in middleware
 * where it costs nothing. Matching is deliberately narrow - only paths that
 * cannot belong to a Next.js storefront - so a real route can never be caught.
 */

const SCANNER_PATTERNS: RegExp[] = [
  // Nothing in this app is PHP, so the extension alone is conclusive. This one
  // pattern covers the large majority of automated scans.
  /\.php$/i,

  // Source control, credentials and editor metadata left exposed by accident -
  // the highest-value thing a scanner can find.
  /^\/(?:\.git|\.svn|\.hg|\.env|\.aws|\.ssh|\.vscode|\.idea|\.DS_Store)(?:\/|$|\.)/i,

  // CMS install paths. `.well-known` is deliberately NOT here: it is a real
  // standard (ACME challenges, security.txt) and blocking it would break
  // certificate issuance.
  /^\/(?:wp-admin|wp-includes|wp-content|wp-json|wordpress|xmlrpc|phpmyadmin|pma|administrator|vendor)(?:\/|$)/i,

  // Backup, swap and dump files left next to a deployed source tree - the
  // shape that got past the list above on 2026-09-01 (`/wp-config.php.bak`,
  // `/wp-config.php.swp`, `/storage/logs/laravel.log`). Anchored to the
  // extension rather than the first segment, unlike the patterns above,
  // because the file name is the whole tell and it can sit at any depth. That
  // is safe here: `slugify` strips every character outside `[a-z0-9-]`, so no
  // slug this app has ever minted contains a dot.
  /\.(?:bak|swp|swo|old|orig|sql|log)$/i,

  // Framework debug and management endpoints, each one a known RCE or
  // config-disclosure target in a stack this app does not run: Laravel
  // (`/env`, `/_ignition/*`, `/storage/logs/*`) and Spring Boot
  // (`/actuator/*`). `/env` is spelled out in full - `/environment` and any
  // future route starting with those letters must still resolve.
  /^\/env$/i,
  /^\/(?:_ignition|actuator)(?:\/|$)/i,
  /^\/storage\/logs(?:\/|$)/i,
];

export function isScannerPath(pathname: string): boolean {
  return SCANNER_PATTERNS.some((pattern) => pattern.test(pathname));
}
