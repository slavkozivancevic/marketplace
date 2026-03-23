import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Welcome to Marketplace</CardTitle>
          <CardDescription>
            Discover and sell amazing products in our modern SaaS marketplace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link href="/products">
            <Button variant="outline" className="w-full">Browse Products</Button>
          </Link>
          <Link href="/dashboard">
            <Button className="w-full">Get Started</Button>
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            Join thousands of users buying and selling.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
