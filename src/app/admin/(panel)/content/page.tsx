import { PhaseTwoSection } from "@/components/admin/phase-two-placeholder";

export const dynamic = "force-dynamic";

export const metadata = { title: "Content" };

export default async function ContentPage() {
  return (
    <PhaseTwoSection
      title="Content"
      description="Manage the editorial side of the storefront — homepage sections, banners and written content. Today the only store-wide text managed in the database is the announcement banner, available under Settings."
      planned={[
        "Homepage hero and section editor",
        "Announcement banners with scheduling",
        "Lookbook / editorial pages",
        "Rich-text content blocks stored in the database",
      ]}
    />
  );
}
