import { PhaseTwoSection } from "@/components/admin/phase-two-placeholder";

export const dynamic = "force-dynamic";

export const metadata = { title: "Marketing" };

export default async function MarketingPage() {
  return (
    <PhaseTwoSection
      title="Marketing"
      description="Campaigns, promotions and customer outreach. Meta Pixel configuration lives under Settings → Marketing — Meta Pixel. The items below still need dedicated database tables."
      planned={[
        "Discount / promo codes applied at checkout",
        "Campaign tracking on orders",
        "Customer email list export",
        "Abandoned-checkout follow-ups",
      ]}
    />
  );
}
