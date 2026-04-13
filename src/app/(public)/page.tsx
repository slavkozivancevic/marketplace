import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Zap,
  Globe,
  ArrowRight,
  Store,
  TrendingUp,
  Users,
  CreditCard,
} from "lucide-react";
import { HeroBackground } from "@/components/layout/hero-background";
import { Footer } from "@/components/layout/footer";

const stats = [
  { label: "Active Sellers", value: "2,500+", icon: Store },
  { label: "Products Listed", value: "50,000+", icon: TrendingUp },
  { label: "Happy Customers", value: "100K+", icon: Users },
  { label: "Transactions", value: "$10M+", icon: CreditCard },
];

const features = [
  {
    icon: ShieldCheck,
    title: "Enterprise Security",
    description:
      "Bank-grade encryption and compliance. Your data and transactions are always protected.",
  },
  {
    icon: Zap,
    title: "Lightning Performance",
    description:
      "Built on cutting-edge infrastructure for instant page loads and seamless shopping.",
  },
  {
    icon: Globe,
    title: "Global Scale",
    description:
      "Reach customers worldwide with multi-currency support and global CDN delivery.",
  },
];

export default function HomePage() {
  return (
    <div className="star-field flex-1 overflow-y-auto min-h-0">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        <HeroBackground />

        {/* Hero overlay gradient */}
        <div className="absolute inset-0 bg-linear-to-b from-background/60 via-background/40 to-background pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="animate-slide-down mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Now live — Start selling today
          </div>

          {/* Main heading */}
          <h1 className="animate-slide-up text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            The Marketplace
            <br />
            <span className="text-gradient-gold">Built for Scale</span>
          </h1>

          <p className="animate-slide-up delay-200 mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl opacity-0">
            A modern, enterprise-grade commerce platform where sellers thrive
            and buyers discover extraordinary products.
          </p>

          {/* CTA Buttons */}
          <div className="animate-slide-up delay-400 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0">
            <Link href="/products">
              <Button
                size="lg"
                className="h-12 px-8 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5 group"
              >
                Explore Products
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base font-semibold backdrop-blur-sm hover:-translate-y-0.5 transition-all duration-300"
              >
                Start Selling
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="animate-fade-in delay-700 mt-20 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-8 opacity-0">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="group flex flex-col items-center gap-1 rounded-xl p-4 transition-colors hover:bg-muted/50"
                >
                  <Icon className="h-5 w-5 text-muted-foreground mb-1 transition-colors group-hover:text-foreground" />
                  <span className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {stat.value}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground sm:text-sm">
                    {stat.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-background to-transparent" />
      </section>

      {/* Features Section */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Why Choose{" "}
              <span className="text-gradient-cosmos">Our Platform</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Built from the ground up for serious commerce, with the tools
              and infrastructure you need to succeed.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3 sm:gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group relative rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur-sm transition-all duration-300 hover:border-border hover:bg-card hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/80 p-10 sm:p-16 text-center backdrop-blur-sm">
            {/* Decorative gradient orbs */}
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />

            <div className="relative z-10">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to Get Started?
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
                Join thousands of sellers and buyers on the most powerful
                marketplace platform available.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/sign-up">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-base font-semibold shadow-lg shadow-primary/20 group"
                  >
                    Create Free Account
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <Link href="/products">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 px-8 text-base font-semibold"
                  >
                    Browse Products
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
