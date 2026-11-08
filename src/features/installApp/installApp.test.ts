import { describe, expect, it } from "vitest";
import { resolveInstallKind } from "./resolveInstallKind";
import { INSTALL_PROMPT_SCRIPT_JS } from "./installPromptScript";

const UA = {
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  desktopChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  // iPadOS Safari requests desktop sites and reports a Mac.
  ipadDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  firefoxDesktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
};

const base = { hasPrompt: false, standalone: false, installed: false, maxTouchPoints: 0 };

describe("resolveInstallKind", () => {
  it("offers the browser prompt when Chrome on Android handed one over", () => {
    expect(resolveInstallKind({ ...base, hasPrompt: true, userAgent: UA.androidChrome, maxTouchPoints: 5 })).toBe("prompt");
  });

  it("offers nothing on desktop, even when Chrome handed over a prompt", () => {
    expect(resolveInstallKind({ ...base, hasPrompt: true, userAgent: UA.desktopChrome })).toBeNull();
  });

  it("offers the Share steps on iPhone and on iPad with a desktop UA", () => {
    expect(resolveInstallKind({ ...base, userAgent: UA.iphone, maxTouchPoints: 5 })).toBe("ios");
    expect(resolveInstallKind({ ...base, userAgent: UA.ipadDesktop, maxTouchPoints: 5 })).toBe("ios");
  });

  it("does not mistake a Mac for an iPad", () => {
    expect(resolveInstallKind({ ...base, userAgent: UA.ipadDesktop, maxTouchPoints: 0 })).toBeNull();
  });

  it("offers nothing inside the installed app, even with a prompt or on iOS", () => {
    expect(resolveInstallKind({ ...base, standalone: true, hasPrompt: true, userAgent: UA.androidChrome })).toBeNull();
    expect(resolveInstallKind({ ...base, standalone: true, userAgent: UA.iphone, maxTouchPoints: 5 })).toBeNull();
  });

  it("offers nothing in a browser tab once the app is installed on the device", () => {
    expect(resolveInstallKind({ ...base, installed: true, hasPrompt: true, userAgent: UA.androidChrome, maxTouchPoints: 5 })).toBeNull();
  });

  it("offers nothing where the browser cannot install", () => {
    expect(resolveInstallKind({ ...base, userAgent: UA.firefoxDesktop })).toBeNull();
    expect(resolveInstallKind({ ...base, userAgent: UA.androidChrome, maxTouchPoints: 5 })).toBeNull();
  });
});

describe("install prompt head script", () => {
  it("runs from its source text alone: keeps the event, clears it on appinstalled", () => {
    const listeners: Record<string, (e: unknown) => void> = {};
    const dispatched: string[] = [];
    const fakeWindow: Record<string, unknown> = {
      addEventListener: (name: string, fn: (e: unknown) => void) => {
        listeners[name] = fn;
      },
      dispatchEvent: (e: { type: string }) => dispatched.push(e.type),
    };
    class FakeEvent {
      constructor(public type: string) {}
    }
    new Function("window", "Event", INSTALL_PROMPT_SCRIPT_JS)(fakeWindow, FakeEvent);

    const promptEvent = { prompt() {} };
    listeners.beforeinstallprompt(promptEvent);
    expect(fakeWindow.__mvInstallPrompt).toBe(promptEvent);

    listeners.appinstalled({});
    expect(fakeWindow.__mvInstallPrompt).toBeNull();
    expect(dispatched).toEqual(["mv:installprompt", "mv:installprompt"]);
  });
});
