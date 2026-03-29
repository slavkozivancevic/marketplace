// import { SignUp } from "@clerk/nextjs";
"use client";
import dynamic from "next/dynamic";

const SignUp = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignUp),
  {
    ssr: false,
  },
);

export default function Page() {
  return <SignUp />;
}
