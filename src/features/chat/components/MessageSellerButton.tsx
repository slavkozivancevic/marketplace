"use client";
import { logger } from "@/lib/logger";

import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import axios from "axios";
import { useChatStore } from "../store/chatStore";

interface Props {
  productId: string;
  className?: string;
  /** Current visitor is the OWNER of the org selling this product - the API
   *  rejects that combination (can't message yourself as the seller), so the
   *  button is disabled up front instead of round-tripping a 400. */
  isOwnProduct?: boolean;
}

export function MessageSellerButton({ productId, className, isOwnProduct = false }: Props) {
  const { isSignedIn } = useUser();
  const locale = useLocale();
  const t = useTranslations("chat");
  const openConversation = useChatStore((s) => s.openConversation);
  const [loading, setLoading] = useState(false);

  // Don't render for guests - they see a sign-in redirect on click
  // (or you can hide entirely: if (!isSignedIn) return null)

  const handleClick = async () => {
    if (!isSignedIn) {
      // Redirect to sign-in with return URL - both legs prefixed with locale
      // so middleware doesn't have to bounce again. Keep the pending state on
      // for the whole hard navigation - the page is about to unload, so the
      // spinner correctly runs until the browser leaves.
      setLoading(true);
      window.location.href = `/${locale}/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post<{ conversationId: string }>(
        "/api/chat/start-with-seller",
        { productId }
      );
      const { conversationId } = data;
      openConversation(conversationId);
    } catch (err) {
      logger.error("[MessageSellerButton]", err);
    } finally {
      setLoading(false);
    }
  };

  if (isOwnProduct) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Wrap so the tooltip still fires on a disabled button (which
              swallows pointer events on its own). */}
          <span className={className}>
            <Button variant="outline" className="w-full" disabled>
              <MessageCircle className="size-4" />
              {t("ownProduct")}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t("ownProductTooltip")}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="outline"
      className={className}
      onClick={() => void handleClick()}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <MessageCircle className="size-4" />
      )}
      {loading ? t("openingConversation") : t("messageSeller")}
    </Button>
  );
}