"use server";

import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { requireAdminWrite } from "@/lib/auth/requireRole";
import { recordAudit } from "@/features/audit/db/audit";
import type { ActionErrorResult } from "@/types/types";
import { priceMarketSchema, type PriceMarketInput } from "../schema/priceMarkets";
import {
  createPriceMarket,
  deletePriceMarket,
  duplicatePriceMarket,
  updatePriceMarket,
} from "../db/markets";

// Every action hands its redirect target back instead of calling `redirect()`,
// which unwinds by throwing and would drop the form's confirmation. The client
// re-prefixes it with the request locale. Platform admins only: markets are a
// platform decision, never a seller's (dynamic-pricing spec, Constraint 12).

export async function createPriceMarketAction(
  unsafeData: PriceMarketInput,
  redirectTo = "/admin/price-markets",
): Promise<{ ok: true; redirectTo: string } | ActionErrorResult> {
  try {
    await requireAdminWrite();
    const parsed = priceMarketSchema.safeParse(unsafeData, { error: await getServerZodErrorMap() });
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }
    const created = await createPriceMarket(parsed.data);
    await recordAudit({
      action: "price_market.created",
      entityType: "PriceMarket",
      entityId: created.id,
      diff: { name: created.name, countries: parsed.data.countries.join(", ") },
    });
    return { ok: true, redirectTo };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updatePriceMarketAction(
  id: string,
  unsafeData: PriceMarketInput,
  redirectTo = "/admin/price-markets",
): Promise<{ ok: true; redirectTo: string } | ActionErrorResult> {
  try {
    await requireAdminWrite();
    const parsed = priceMarketSchema.safeParse(unsafeData, { error: await getServerZodErrorMap() });
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }
    const updated = await updatePriceMarket(id, parsed.data);
    await recordAudit({
      action: "price_market.updated",
      entityType: "PriceMarket",
      entityId: id,
      diff: { name: updated.name, countries: parsed.data.countries.join(", ") },
    });
    return { ok: true, redirectTo };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Duplicates a market and returns the copy's id, so the list can offer "Edit
 * copy" in its toast - the copy has no countries yet, which is the first thing
 * the admin will want to give it. Mirrors `duplicateTrustPointAction`; the
 * audit line names the source, not its id.
 */
export async function duplicatePriceMarketAction(
  id: string,
): Promise<{ error: false; id: string } | ActionErrorResult> {
  try {
    await requireAdminWrite();
    const copy = await duplicatePriceMarket(id);
    await recordAudit({
      action: "price_market.duplicated",
      entityType: "PriceMarket",
      entityId: copy.id,
      diff: { from: copy.sourceName, fromId: id },
    });
    return { error: false, id: copy.id };
  } catch (error) {
    return handleActionError(error);
  }
}

/** Returns instead of redirecting: the only caller is the list it would point at. */
export async function deletePriceMarketAction(id: string): Promise<{ ok: true } | ActionErrorResult> {
  try {
    await requireAdminWrite();
    const name = await deletePriceMarket(id);
    await recordAudit({
      action: "price_market.deleted",
      entityType: "PriceMarket",
      entityId: id,
      diff: { name },
    });
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}
