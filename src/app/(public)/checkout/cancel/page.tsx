import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";

export default function CheckoutCancelPage() {
  return (
    <div className="container max-w-md py-16 text-center space-y-6">
      <div className="flex justify-center">
        <XCircle className="h-16 w-16 text-destructive" />
      </div>
      <PageHeader
        title="Payment Cancelled"
        description="Your payment was cancelled. Your cart is still saved."
      />
      <div className="flex flex-col gap-3">
        <Button asChild>
          <Link href="/products">Back to Products</Link>
        </Button>
      </div>
    </div>
  );
}
