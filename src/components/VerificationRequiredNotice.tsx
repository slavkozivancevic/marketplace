import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Standard "your organization must be verified first" panel. Rendered at the
 * entry point of any seller write flow (product create/edit) so an unverified
 * org sees the gate immediately instead of filling a form and hitting a 403 on
 * upload/save. The server actions still enforce verification via
 * `requirePermission` - this is progressive disclosure, not the security
 * boundary. Pass CTA buttons as `children` so typed i18n `<Link>`s stay in the
 * calling page.
 */
export function VerificationRequiredNotice({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <Alert>
        <ShieldAlert />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <p>{description}</p>
          {children ? (
            <div className="mt-4 flex flex-wrap gap-2">{children}</div>
          ) : null}
        </AlertDescription>
      </Alert>
    </div>
  );
}
