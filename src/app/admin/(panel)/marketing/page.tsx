import { PhaseTwoSection } from "@/components/admin/phase-two-placeholder";

export const dynamic = "force-dynamic";

export const metadata = { title: "Marketing" };

export default async function MarketingPage() {
  return (
    <PhaseTwoSection
      title="Marketing"
      description="Campaigns, promotions and customer outreach. The current database schema does not include marketing tables yet, so this section is reserved for Phase 2."
      planned={[
        "Discount / promo codes applied at checkout",
        "Campaign tracking on orders",
        "Customer email list export",
        "Abandoned-checkout follow-ups",
      ]}
    />
  );
}
