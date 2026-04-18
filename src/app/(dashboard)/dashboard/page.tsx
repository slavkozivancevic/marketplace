import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import {
  ShoppingBag,
  ClipboardList,
  Building2,
  Package,
  Shield,
  ArrowRight,
} from "lucide-react";

interface QuickCard {
  href: string;
  title: string;
  description: string;
  icon: typeof ShoppingBag;
}

const baseCards: QuickCard[] = [
  {
    href: "/products",
    title: "Browse Products",
    description: "Discover products from our marketplace.",
    icon: ShoppingBag,
  },
  {
    href: "/dashboard/orders",
    title: "My Orders",
    description: "View your purchase history.",
    icon: ClipboardList,
  },
  {
    href: "/dashboard/organization",
    title: "Organization",
    description: "Manage your organization settings and members.",
    icon: Building2,
  },
];

const sellerCards: QuickCard[] = [
  {
    href: "/dashboard/my-products",
    title: "My Products",
    description: "Manage your products.",
    icon: Package,
  },
];

export default async function DashboardPage() {
  const { userId } = await auth();

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId! },
    select: { role: true, name: true },
  });

  const userRole = user?.role ?? "USER";

  const cards = [...baseCards, ...(userRole === "SELLER" ? sellerCards : [])];
  const isAdmin = userRole === "ADMIN";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 sticky-header-bg">
        <div className="pt-6 pb-4">
          <h1 className="text-2xl font-bold">
            Welcome, {user?.name || "User"}!
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Here&apos;s an overview of your marketplace activity.
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href} className="group">
                <Card className="h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 border-border/50">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle>{card.title}</CardTitle>
                        <CardDescription>{card.description}</CardDescription>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>

        {isAdmin && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Quick Links
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/admin" className="group">
                <Card className="h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 border-border/50">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                        <Shield className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle>Admin Panel</CardTitle>
                        <CardDescription>Manage products, users, and organizations.</CardDescription>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
