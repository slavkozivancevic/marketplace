import { connection } from "next/server";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { ClearCartOnSuccess } from "@/features/cart/components/ClearCartOnSuccess";
import { Footer } from "@/components/layout/footer";

export default async function CheckoutSuccessPage() {
  await connection();

  return (
    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
      <div className="flex-1 px-6 py-16 text-center space-y-6 max-w-md mx-auto w-full">
        <ClearCartOnSuccess />
        <div className="flex justify-center">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <PageHeader
          title="Payment Successful"
          description="Thank you for your order! You will receive a confirmation email shortly."
        />
        <div className="flex flex-col gap-3">
          <Button asChild>
            <Link href="/products">Continue Shopping</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/orders">View My Orders</Link>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
