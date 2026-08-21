"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Store, TrendingUp, Users, CreditCard } from "lucide-react";

function formatNumber(n: number): string {
  return n >= 1000 ? n.toLocaleString("en-US") : String(n);
}

function StatCounter({
  numericValue,
  prefix,
  suffix,
  animate,
}: {
  numericValue: number;
  prefix: string;
  suffix: string;
  animate: boolean;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) return;

    const duration = 1600;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(eased * numericValue);

      if (spanRef.current) {
        spanRef.current.textContent = `${prefix}${formatNumber(current)}${suffix}`;
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [animate, numericValue, prefix, suffix]);

  return (
    <span ref={spanRef} className="text-2xl font-bold tracking-tight sm:text-3xl">
      {prefix}0{suffix}
    </span>
  );
}

export function StatsSection() {
  const t = useTranslations("stats");
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const stats = [
    { label: t("activeSellers"), numericValue: 2500, prefix: "", suffix: "+", icon: Store },
    { label: t("productsListed"), numericValue: 50000, prefix: "", suffix: "+", icon: TrendingUp },
    { label: t("happyCustomers"), numericValue: 100, prefix: "", suffix: "K+", icon: Users },
    { label: t("transactions"), numericValue: 10, prefix: "$", suffix: "M+", icon: CreditCard },
  ];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <div
      ref={ref}
      className="animate-fade-in delay-700 mt-20 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-8 opacity-0"
    >
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          // These tiles are read-only figures, not links. They used to carry
          // `hover:bg-muted/50` plus a `group-hover` icon colour change, which
          // reads as "this is clickable" on a plain <div> that does nothing -
          // a false affordance. There is nowhere sensible for a stat to
          // navigate to, so the hover states are gone rather than the tiles
          // being turned into links.
          <div
            key={stat.label}
            className="flex flex-col items-center gap-1 rounded-xl p-4"
          >
            <Icon className="h-5 w-5 text-muted-foreground mb-1" />
            <StatCounter
              numericValue={stat.numericValue}
              prefix={stat.prefix}
              suffix={stat.suffix}
              animate={hasAnimated}
            />
            <span className="text-xs font-medium text-muted-foreground sm:text-sm">
              {stat.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
