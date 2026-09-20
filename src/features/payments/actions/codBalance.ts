"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { recordAudit } from "@/features/audit/db/audit";
import { settleCodBalance, payOutCodCredit } from "../db/payouts";
import type { ActionErrorResult } from "@/types/types";

/**
 * Platform-admin action: records commission collected outside the app (bank
 * transfer, cash) against an org's COD balance. See settleCodBalance for the
 * clamping behavior and /admin/cod-balances for the UI.
 */
export async function settleCodBalanceAction(
  organizationId: string,
  currency: string,
  amount: number,
): Promise<{ ok: true; settled: number } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const settled = await settleCodBalance({ organizationId, currency, amount });
    await recordAudit({
      action: "cod_balance.settled",
      entityType: "Organization",
      entityId: organizationId,
      diff: { currency, settled },
    });
    revalidatePath("/[locale]/admin/cod-balances", "page");
    return { ok: true, settled };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * The other direction: hand back a credit the platform owes this org. Audited
 * under its own action so the trail never reads a payout as a collection.
 */
export async function payOutCodCreditAction(
  organizationId: string,
  currency: string,
  amount: number,
): Promise<{ ok: true; paid: number } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const paid = await payOutCodCredit({ organizationId, currency, amount });
    await recordAudit({
      action: "cod_balance.credit_paid",
      entityType: "Organization",
      entityId: organizationId,
      diff: { currency, paid },
    });
    revalidatePath("/[locale]/admin/cod-balances", "page");
    return { ok: true, paid };
  } catch (error) {
    return handleActionError(error);
  }
}
