"use client";

import { useState, useEffect, useTransition } from "react";
import { usePathname } from "next/navigation";
import { useRefreshOrderViews } from "@/features/orders/hooks/useRefreshOrderViews";
import { useTranslations } from "next-intl";
import { Loader2, RotateCcw, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/sonner";
import { requestReturn, shipReturn } from "@/features/returns/actions/returns";

type ItemRow = {
  orderItemId: string;
  title: string;
  variantLabel: string | null;
  returnable: number;
};

type Seller = {
  organizationId: string;
  name: string;
  shipped: boolean;
  delivered: boolean;
  canReturn: boolean;
  items: ItemRow[];
};

type ReturnLine = {
  orderItemId: string;
  title: string;
  variantLabel: string | null;
  quantity: number;
};

type ReturnRow = {
  id: string;
  organizationId: string;
  status: string;
  reason: string | null;
  resolutionNote: string | null;
  refundAmount: number | null;
  items: ReturnLine[];
};

function statusVariant(s: string) {
  if (s === "REFUNDED") return "default" as const;
  if (s === "REJECTED") return "destructive" as const;
  return "secondary" as const;
}

export function BuyerReturns({
  orderId,
  sellers,
  returns,
}: {
  orderId: string;
  sellers: Seller[];
  returns: ReturnRow[];
}) {
  const t = useTranslations("returns");
  const refreshOrderViews = useRefreshOrderViews();
  const [isPending, start] = useTransition();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");

  // Reset the in-progress return form when the route changes - the client Router
  // Cache (dynamicOnHover) would otherwise keep a half-filled form alive across
  // instant back-navigation.
  const pathname = usePathname();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenFor(null);
    setSel({});
    setReason("");
  }, [pathname]);

  const statusLabel: Record<string, string> = {
    REQUESTED: t("statusRequested"),
    APPROVED: t("statusApproved"),
    REJECTED: t("statusRejected"),
    SHIPPED: t("statusShipped"),
    REFUNDED: t("statusRefunded"),
  };

  const openForm = (orgId: string) => {
    setOpenFor(orgId);
    setSel({});
    setReason("");
  };

  const submit = (orgId: string) => {
    const items = Object.entries(sel)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }))
      .filter((i) => i.quantity > 0);
    if (items.length === 0) {
      toast.error(t("selectItemsError"));
      return;
    }
    start(async () => {
      const res = await requestReturn(orderId, orgId, items, reason.trim() || undefined);
      if ("error" in res) {
        toast.error(res.message);
        return;
      }
      toast.success(t("requestSent"));
      setOpenFor(null);
      setSel({});
      setReason("");
      refreshOrderViews();
    });
  };

  const onShip = (returnId: string) => {
    start(async () => {
      const res = await shipReturn(returnId);
      if ("error" in res) {
        toast.error(res.message);
        return;
      }
      toast.success(t("markedShipped"));
      refreshOrderViews();
    });
  };

  const lineLabel = (l: ReturnLine | ItemRow) =>
    "variantLabel" in l && l.variantLabel ? `${l.title} (${l.variantLabel})` : l.title;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 text-sm">
        {sellers.map((seller, index) => {
          const sellerReturns = returns.filter((r) => r.organizationId === seller.organizationId);
          const returnable = seller.items.filter((i) => i.returnable > 0);
          const formOpen = openFor === seller.organizationId;

          return (
            <div key={seller.organizationId}>
              {index > 0 && <Separator className="my-3" />}
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{seller.name}</span>
                {seller.canReturn && returnable.length > 0 && !formOpen && (
                  <Button size="sm" variant="outline" onClick={() => openForm(seller.organizationId)}>
                    {t("requestReturn")}
                  </Button>
                )}
              </div>
              {!seller.canReturn && returnable.length > 0 && sellerReturns.length === 0 && (
                <>
                  {seller.shipped && !seller.delivered && (
                    <p className="mt-1 text-xs text-muted-foreground">{t("returnAfterShip")}</p>
                  )}
                  {seller.delivered && (
                    <p className="mt-1 text-xs text-muted-foreground">{t("notEligibleHint")}</p>
                  )}
                </>
              )}

              {/* Existing returns for this seller */}
              {sellerReturns.map((ret) => (
                <div key={ret.id} className="mt-2 rounded-md border bg-muted/30 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={statusVariant(ret.status)} className="text-[10px]">
                      {statusLabel[ret.status] ?? ret.status}
                    </Badge>
                    {ret.status === "APPROVED" && (
                      <Button size="sm" className="gap-1.5 h-7" disabled={isPending} onClick={() => onShip(ret.id)}>
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                        {t("markShipped")}
                      </Button>
                    )}
                  </div>
                  <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                    {ret.items.map((l) => (
                      <li key={l.orderItemId}>{lineLabel(l)} × {l.quantity}</li>
                    ))}
                  </ul>
                  {ret.status === "REJECTED" && ret.resolutionNote && (
                    <p className="mt-1 text-xs text-muted-foreground">{ret.resolutionNote}</p>
                  )}
                </div>
              ))}

              {/* Request form */}
              {formOpen && (
                <div className="mt-3 space-y-3 rounded-md border p-3">
                  {returnable.map((item) => (
                    <div key={item.orderItemId} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate">{lineLabel(item)}</p>
                        <p className="text-xs text-muted-foreground">{t("returnQtyMax", { max: item.returnable })}</p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={item.returnable}
                        className="h-8 w-20 text-sm"
                        value={sel[item.orderItemId] ?? 0}
                        onChange={(e) => {
                          const raw = parseInt(e.target.value, 10);
                          const q = Number.isNaN(raw) ? 0 : Math.max(0, Math.min(item.returnable, raw));
                          setSel((s) => ({ ...s, [item.orderItemId]: q }));
                        }}
                      />
                    </div>
                  ))}
                  <Textarea
                    rows={2}
                    placeholder={t("reasonPlaceholder")}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={isPending} className="gap-1.5" onClick={() => submit(seller.organizationId)}>
                      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {t("submitRequest")}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setOpenFor(null)}>
                      {t("cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
