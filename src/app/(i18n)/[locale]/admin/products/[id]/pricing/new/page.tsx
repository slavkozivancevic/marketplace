import { PriceRuleFormScreen } from "@/features/pricing/components/PriceRulesScreens";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PriceRuleFormScreen scope="admin" productId={id} />;
}
