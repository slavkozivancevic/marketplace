// import { SignIn } from "@clerk/nextjs";
"use client";
import dynamic from "next/dynamic";

const SignIn = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignIn),
  {
    ssr: false,
  },
);

export default function Page() {
  return <SignIn />;
}
