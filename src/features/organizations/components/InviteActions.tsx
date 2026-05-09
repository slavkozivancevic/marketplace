"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInviteAction, declineInviteAction } from "../actions/invites";

interface InviteActionsProps {
  token: string;
}

export function InviteActions({ token }: InviteActionsProps) {
  const t = useTranslations("invite");
  const router = useRouter();
  const [isAccepting, startAcceptTransition] = useTransition();
  const [isDeclining, startDeclineTransition] = useTransition();

  const isPending = isAccepting || isDeclining;

  const handleAccept = () => {
    startAcceptTransition(async () => {
      const result = await acceptInviteAction(token);
      if (!result || !("error" in result)) {
        router.push("/dashboard/organization");
      }
    });
  };

  const handleDecline = () => {
    startDeclineTransition(async () => {
      await declineInviteAction(token);
      router.push("/dashboard");
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