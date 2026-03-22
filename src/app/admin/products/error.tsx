"use client";

import { useEffect } from "react";

import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ProductsErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProductsErrorPage({
  error,
  reset,
}: ProductsErrorPageProps) {
  useEffect(() => {
    console.error("Products route error:", error);
  }, [error]);

  return (
    <div className="container my-6">
      <PageHeader
        title="Products"
        description="An unexpected error occurred while loading this page."
      />

      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>
            We couldn&apos;t load the requested products page. Please try again.
          </p>
          <Button type="button" onClick={reset}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
