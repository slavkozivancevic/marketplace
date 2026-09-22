"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { setFlash } from "@/lib/navigation/flash";
import { acceptInviteAction, declineInviteAction } from "../actions/invites";

interface InviteActionsProps {
  token: string;
}

export function InviteActions({ token }: InviteActionsProps) {
  const t = useTranslations("invite");
  const router = useRouter();
  const locale = useLocale();
  const [isAccepting, startAcceptTransition] = useTransition();
  const [isDeclining, startDeclineTransition] = useTransition();

  const isPending = isAccepting || isDeclining;

  const handleAccept = () => {
    startAcceptTransition(async () => {
      const result = await acceptInviteAction(token);
      if (result && "error" in result) {
        toast.error(result.message);
        return;
      }
      // Accepting switched the active org server-side; refresh so the session
      // token is reissued with the new org before landing on the dashboard.
      router.refresh();
      // Queued rather than raised: this button keeps spinning through the
      // navigation, so a toast here would sit next to a pending control on the
      // page being left. FlashHost raises it on the organization page, which is
      // where the result - the org you just joined - is visible.
      const target = `/${locale}/dashboard/organization`;
      setFlash(t("accepted"), { path: target });
      router.push(target);
    });
  };

  const handleDecline = () => {
    startDeclineTransition(async () => {
      const result = await declineInviteAction(token);
      if (result && "error" in result) {
        toast.error(result.message);
        return;
      }
      // Declining leaves nothing on screen to show for it, so the confirmation
      // is the only feedback there is - same flash treatment as accepting.
      const target = `/${locale}/dashboard`;
      setFlash(t("declined"), { path: target });
      router.push(target);
    });
  };

  return (
    <div className="flex gap-2">
      <Button
        className="flex-1"
        disabled={isPending}
        onClick={handleAccept}
      >
        {isAccepting && <Loader2 className="animate-spin" />}
        {isAccepting ? t("accepting") : t("accept")}
      </Button>
      <Button
        variant="outline"
        className="flex-1"
        disabled={isPending}
        onClick={handleDecline}
      >
        {isDeclining && <Loader2 className="animate-spin" />}
        {isDeclining ? t("declining") : t("decline")}
      </Button>
    </div>
  );
}