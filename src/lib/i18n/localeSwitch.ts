"use client";

/**
 * Signal used to tell a remount caused by a *language switch* apart from any
 * other navigation.
 *
 * A locale change navigates `/sr/...` -> `/en/...`, which remounts the entire
 * `[locale]` subtree and destroys all in-progress client state (form fields,
 * active tab, uploaded media). Components that want to survive that - and only
 * that - persist a draft and restore it when this marker is fresh on mount.
 *
 * The locale switchers call `markLanguageSwitch()` immediately before they
 * navigate. Restorers call `consumeLanguageSwitch()` once on mount: it is
 * one-shot (cleared on read) and time-boxed, so an ordinary navigation can
 * never accidentally trigger a restore.
 */
const MARKER = "i18n:localeSwitchAt";
// Generous enough to outlast one client transition, short enough that a normal
// navigation seconds later is never mistaken for a switch.
const WINDOW_MS = 5000;

export function markLanguageSwitch(): void {
  try {
    sessionStorage.setItem(MARKER, String(Date.now()));
  } catch {
    // sessionStorage unavailable (private mode) - state simply won't survive the
    // switch, which is harmless.
  }
}

export function consumeLanguageSwitch(): boolean {
  try {
    const raw = sessionStorage.getItem(MARKER);
    sessionStorage.removeItem(MARKER);
    if (raw == null) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < WINDOW_MS;
  } catch {
    return false;
  }
}

/**
 * Pages holding in-progress state that must survive a language switch (forms,
 * the bulk panel) flag themselves while mounted. The locale switcher reads this
 * and does a HARD navigation instead of a soft one, because Next's client Router
 * Cache otherwise restores the previous locale's cached tree (with stale client
 * state) on back-navigation, bypassing any on-mount restore. A full reload drops
 * the cache; the draft (in sessionStorage) is then restored deterministically on
 * the fresh mount. Storefront pages don't set this, so they keep soft nav.
 */
const PRESERVE = "i18n:preserveAcrossLocaleSwitch";

export function setPreserveAcrossLocaleSwitch(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(PRESERVE, "1");
    else sessionStorage.removeItem(PRESERVE);
  } catch {
    // ignore
  }
}

export function shouldHardSwitchLocale(): boolean {
  try {
    return sessionStorage.getItem(PRESERVE) === "1";
  } catch {
    return false;
  }
}
