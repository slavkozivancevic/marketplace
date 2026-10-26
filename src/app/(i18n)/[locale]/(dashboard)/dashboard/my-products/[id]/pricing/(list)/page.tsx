import { PriceRulesScreen } from "@/features/pricing/components/PriceRulesScreens";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PriceRulesScreen scope="dashboard" productId={id} />;
}
