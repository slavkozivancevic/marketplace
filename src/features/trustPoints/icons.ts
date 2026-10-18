import {
  BadgeCheck,
  CreditCard,
  Headset,
  Lock,
  Package,
  RotateCcw,
  ShieldCheck,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * The icons a trust point may use.
 *
 * A fixed list rather than free text, so an admin cannot type a name that
 * renders as nothing - but a plain `String` column rather than a Prisma enum,
 * because which icons exist is a presentation decision. Adding one here is a
 * code change; making it an enum would make it a migration.
 *
 * Keys are stored in `TrustPoint.icon`. Never rename one without a data fix:
 * the stored value is the key.
 *
 * Typed as a plain `Record<string, LucideIcon>` on purpose. Call sites read it
 * as `TRUST_POINT_ICONS[key] ?? TRUST_POINT_FALLBACK_ICON` - a property access,
 * the same shape the sidebar uses for `link.icon`. Resolving the component
 * through a FUNCTION instead trips `react-hooks/static-components`, which reads
 * `const Icon = someCall()` as a component being created during render.
 */
export const TRUST_POINT_ICONS: Record<string, LucideIcon> = {
  shield: ShieldCheck,
  lock: Lock,
  card: CreditCard,
  wallet: Wallet,
  truck: Truck,
  package: Package,
  returns: RotateCcw,
  support: Headset,
  verified: BadgeCheck,
};

/** Shown for a row whose icon key has since been retired. The strip is
 *  marketing copy, not a place to surface a missing-asset error. */
export const TRUST_POINT_FALLBACK_ICON: LucideIcon = BadgeCheck;

/** The keys, as a literal tuple, so the Zod schema can build an enum from it. */
export const TRUST_POINT_ICON_KEYS = [
  "shield",
  "lock",
  "card",
  "wallet",
  "truck",
  "package",
  "returns",
  "support",
  "verified",
] as const;

export type TrustPointIcon = (typeof TRUST_POINT_ICON_KEYS)[number];

export function isTrustPointIcon(value: string): value is TrustPointIcon {
  return (TRUST_POINT_ICON_KEYS as readonly string[]).includes(value);
}
