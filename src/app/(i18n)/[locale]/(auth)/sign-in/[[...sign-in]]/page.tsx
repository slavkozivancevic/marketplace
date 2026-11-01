"use client";
import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppLoader } from "@/components/layout/app-loader";
import { BootLoaderFallback } from "@/components/layout/boot-loader-fallback";
import { DemoSignInPanel } from "@/features/demo/components/DemoSignInPanel";
import { DemoTicketSignIn } from "@/features/demo/components/DemoTicketSignIn";
import { DEMO_BUSY_PARAM } from "@/features/demo/demoSignIn";

const SignIn = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignIn),
  {
    ssr: false,
  },
);

// The boundary is what keeps a demo link to one steady loader. The static
// shell cannot know about the ticket, so it carries the boot loader's twin
// instead of a sign-in page that hydration would then swap for a loader - the
// boot gate would lift in between and the loader would blink.
export default function Page() {
  return (
    <Suspense fallback={<BootLoaderFallback />}>
      <SignInContent />
    </Suspense>
  );
}

function SignInContent() {
  const t = useTranslations("demo");
  // A demo link redeems a sign-in token here (see /api/demo/sign-in).
  const searchParams = useSearchParams();
  const hasTicket = searchParams.has("__clerk_ticket");
  // A demo click the route refused for now (rate limit) - seconds to wait.
  const busySeconds = Number(searchParams.get(DEMO_BUSY_PARAM)) || 0;
  const [expired, setExpired] = useState(false);

  const onFailed = useCallback(() => {
    // Drop the spent ticket, or <SignIn /> would try it again and show
    // Clerk's own error instead of ours.
    const url = new URL(window.location.href);
    url.searchParams.delete("__clerk_ticket");
    url.searchParams.delete("redirect_url");
    window.history.replaceState(window.history.state, "", url);
    setExpired(true);
  }, []);

  if (hasTicket && !expired) return <DemoTicketSignIn onFailed={onFailed} />;

  return (
    <div className="flex w-full flex-col items-center gap-6 px-4 py-8">
      {(expired || busySeconds > 0) && (
        <p role="alert" className="w-full max-w-100 text-center text-sm text-muted-foreground">
          {expired ? t("linkExpired") : t("busy", { minutes: Math.ceil(busySeconds / 60) })}
        </p>
      )}
      <SignIn />
      <DemoSignInPanel />
      {expired && <CardLoader />}
    </div>
  );
}

const CARD_WAIT_MS = 3000;

/**
 * Takes over from the ticket's loader when the link turns out to be expired
 * and lifts only once Clerk has drawn its card: the card mounts a beat after
 * the page, above the demo panel, and would push it down in plain view.
 */
function CardLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hasCard = () => document.querySelector(".cl-signIn-root") !== null;
    const done = () => setReady(true);
    if (hasCard()) return done();
    const observer = new MutationObserver(() => hasCard() && done());
    observer.observe(document.body, { childList: true, subtree: true });
    const id = setTimeout(done, CARD_WAIT_MS);
    return () => {
      observer.disconnect();
      clearTimeout(id);
    };
  }, []);

  return <AppLoader hidden={ready} />;
}
