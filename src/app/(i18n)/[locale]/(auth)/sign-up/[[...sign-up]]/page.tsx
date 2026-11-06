"use client";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { DemoSignInPanel } from "@/features/demo/components/DemoSignInPanel";

const SignUp = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignUp),
  {
    ssr: false,
  },
);

// The demo panel sits under Clerk's form here too, as on sign-in: "Sign up" in
// the header is what a visitor who came to try the demo is as likely to click,
// and the showcase promises a way in with no sign-up at all. The panel reads
// `redirect_url` (useSearchParams), hence its own Suspense boundary.
export default function Page() {
  return (
    <div className="flex w-full flex-col items-center gap-6 px-4 py-8">
      <SignUp />
      <Suspense fallback={null}>
        <DemoSignInPanel />
      </Suspense>
    </div>
  );
}
