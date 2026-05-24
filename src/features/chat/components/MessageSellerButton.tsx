"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useChatStore } from "../store/chatStore";

interface Props {
  productId: string;
  className?: string;
}

export function MessageSellerButton({ productId, className }: Props) {
  const { isSignedIn } = useUser();
  const openConversation = useChatStore((s) => s.openConversation);
  const [loading, setLoading] = useState(false);

  // Don't render for guests - they see a sign-in redirect on click
  // (or you can hide entirely: if (!isSignedIn) return null)

  const handleClick = async () => {
    if (!isSignedIn) {
      // Redirect to sign-in with return URL
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`;
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
      console.error("[MessageSellerButton]", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className={className}
      onClick={() => void handleClick()}
      disabled={loading}
    >
      <MessageCircle className="size-4" />
      {loading ? "Opening…" : "Message seller"}
    </Button>
  );
}