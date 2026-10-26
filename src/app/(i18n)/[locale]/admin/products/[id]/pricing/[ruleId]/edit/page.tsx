import { PriceRuleFormScreen } from "@/features/pricing/components/PriceRulesScreens";

export default async function Page({ params }: { params: Promise<{ id: string; ruleId: string }> }) {
  const { id, ruleId } = await params;
  return <PriceRuleFormScreen scope="admin" productId={id} ruleId={ruleId} />;
}
