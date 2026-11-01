"use client";

/**
 * Diagnostics for a soft navigation that never completes.
 *
 * Three times on staging a navigation started and never finished - the URL or
 * the progress bar moved, the page did not - always in a fresh tab right after
 * a demo sign-in, and never once in seventeen scripted attempts to provoke it.
 * Nothing here changes how a navigation behaves. It records the requests
 * Next.js makes (navigations, prefetches, server actions) and, when a watched
 * navigation is still not on screen after STUCK_AFTER_MS, sends what it saw to
 * `/api/diagnostics/nav`, which writes it to the logs (`nav_stuck`).
 */

export const STUCK_AFTER_MS = 10_000;
const MAX_REQUESTS = 60;
const REPORT_WINDOW_MS = 30_000;

type RequestKind = "nav" | "prefetch" | "action";

export type RecordedRequest = {
  kind: RequestKind;
  /** Path + search, with secrets (sign-in tickets, handshakes) cut out. */
  url: string;
  /** Segment-prefetch target, when there is one. */
  segment?: string;
  /** ms since page load, like performance.now(). */
  start: number;
  status?: number;
  /** When the response headers arrived. */
  headersAt?: number;
  /** When it failed or was aborted. */
  failedAt?: number;
  error?: string;
};

const SECRET_PARAMS = /([?&](?:__clerk_ticket|__clerk_handshake[a-z_]*|__clerk_db_jwt|token)=)[^&#]*/gi;

export function sanitizeUrl(raw: string, origin: string): string {
  try {
    const u = new URL(raw, origin);
    const path = u.origin === origin ? u.pathname + u.search : u.origin + u.pathname;
    return path.replace(SECRET_PARAMS, "$1…").slice(0, 300);
  } catch {
    return "?";
  }
}

function headerOf(init: RequestInit | undefined, input: RequestInfo | URL, name: string): string | null {
  const from = (h: HeadersInit | undefined): string | null => {
    if (!h) return null;
    if (h instanceof Headers) return h.get(name);
    if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === name)?.[1] ?? null;
    const key = Object.keys(h).find((k) => k.toLowerCase() === name);
    return key ? (h as Record<string, string>)[key] : null;
  };
  return from(init?.headers) ?? (input instanceof Request ? input.headers.get(name) : null);
}

/** Which kind of Next.js request this is, or null for any other fetch. */
export function classify(init: RequestInit | undefined, input: RequestInfo | URL): RequestKind | null {
  if (headerOf(init, input, "next-action")) return "action";
  if (!headerOf(init, input, "rsc")) return null;
  return headerOf(init, input, "next-router-prefetch") ? "prefetch" : "nav";
}

const requests: RecordedRequest[] = [];
let installed = false;

function installFetchRecorder() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const kind = classify(init, input);
    if (!kind) return original(input, init);
    const raw = input instanceof Request ? input.url : String(input);
    const entry: RecordedRequest = {
      kind,
      url: sanitizeUrl(raw, window.location.origin),
      segment: headerOf(init, input, "next-router-segment-prefetch") ?? undefined,
      start: Math.round(performance.now()),
    };
    requests.push(entry);
    if (requests.length > MAX_REQUESTS) requests.shift();
    return original(input, init).then(
      (res) => {
        entry.status = res.status;
        entry.headersAt = Math.round(performance.now());
        return res;
      },
      (err: unknown) => {
        entry.failedAt = Math.round(performance.now());
        entry.error = err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 120) : String(err).slice(0, 120);
        throw err;
      },
    );
  };
}

type Watch = { target: string; startedAt: number; reason: string; timer: number };
let watch: Watch | null = null;
const reported = new Set<string>();

function buildId(): string | null {
  const flight = (window as unknown as { __next_f?: unknown[][] }).__next_f;
  if (!Array.isArray(flight)) return null;
  for (const chunk of flight) {
    const text = typeof chunk?.[1] === "string" ? chunk[1] : "";
    const m = text.match(/"b":"([^"]+)"/);
    if (m) return m[1];
  }
  return null;
}

function report(w: Watch) {
  const key = `${w.reason}:${w.target}`;
  if (reported.has(key)) return;
  reported.add(key);
  const now = Math.round(performance.now());
  const clerk = (window as unknown as { Clerk?: { loaded?: boolean; session?: { id?: string; status?: string } | null; user?: { id?: string } | null } }).Clerk;
  const payload = {
    reason: w.reason,
    target: sanitizeUrl(w.target, window.location.origin),
    here: sanitizeUrl(window.location.href, window.location.origin),
    waitedMs: now - w.startedAt,
    pageAgeMs: now,
    visibility: document.visibilityState,
    online: navigator.onLine,
    buildId: buildId(),
    nextVersion: (window as unknown as { next?: { version?: string } }).next?.version ?? null,
    clerk: clerk ? { loaded: !!clerk.loaded, sessionId: clerk.session?.id ?? null, sessionStatus: clerk.session?.status ?? null, userId: clerk.user?.id ?? null } : null,
    requests: requests.filter((r) => now - r.start <= REPORT_WINDOW_MS),
  };
  const body = JSON.stringify(payload);
  if (!navigator.sendBeacon?.("/api/diagnostics/nav", new Blob([body], { type: "application/json" }))) {
    void fetch("/api/diagnostics/nav", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  }
}

/** Starts recording. Call once, as early as possible on the client. */
export function startNavDiagnostics() {
  installFetchRecorder();
}

/**
 * Watches a navigation to `target`; reports it if it is still not on screen
 * after STUCK_AFTER_MS. `isDone` decides "on screen" at that moment.
 */
export function watchNavigation(target: string, reason: string, isDone: () => boolean) {
  if (typeof window === "undefined") return;
  clearNavigationWatch();
  const startedAt = Math.round(performance.now());
  const w: Watch = {
    target,
    startedAt,
    reason,
    timer: window.setTimeout(() => {
      if (watch === w && !isDone()) report(w);
      if (watch === w) watch = null;
    }, STUCK_AFTER_MS),
  };
  watch = w;
}

export function clearNavigationWatch() {
  if (watch) window.clearTimeout(watch.timer);
  watch = null;
}
