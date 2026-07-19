/**
 * Two-tone brand wordmark: "Market" inherits the surrounding text color,
 * "Verse" carries the brand violet via `.brand-verse` (theme-tuned in
 * globals.css - deep violet on light surfaces, luminous violet on dark).
 * Use anywhere the brand name renders as text so headers, the boot loader
 * and the home hero match the email header and Stripe lockups. The brand
 * name is identical across locales, so this intentionally bypasses i18n.
 */
export function BrandWordmark() {
  return (
    <>
      Market<span className="brand-verse">Verse</span>
    </>
  );
}
