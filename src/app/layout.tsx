import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";
import { Providers } from "@/providers/providers";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const BG_IMAGE_URL =
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Modern SaaS Marketplace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn("font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background antialiased">
        <div className="page-background">
          <Image
            src={BG_IMAGE_URL}
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
            priority
            unoptimized
          />
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
