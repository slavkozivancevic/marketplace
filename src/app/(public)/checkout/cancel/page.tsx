import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/footer";

export default function CheckoutCancelPage() {
  return (
    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
      <div className="flex-1 px-6 py-16 text-center space-y-6 max-w-md mx-auto w-full">
        <div className="flex justify-center">
          <XCircle className="h-16 w-16 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Payment Cancelled</h1>
        <p className="text-muted-foreground text-sm">
          Your payment was cancelled. Your cart is still saved.
        </p>
        <div className="flex flex-col gap-3">
          <Button asChild>
            <Link href="/products">Back to Products</Link>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
