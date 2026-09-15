import { Footer as HouseFooter } from "@/components/footer";
import type { FooterProps } from "@/storefront/types";

/**
 * DISTRICT footer — the house footer itself: brand column with newsletter,
 * link groups, legal bar. The baseline other storefronts diverge from.
 * Pure server component: zero client JS.
 */
export function DistrictFooter({ data }: FooterProps) {
  return (
    <HouseFooter
      content={data.content}
      newsletter={data.newsletter}
      contact={data.contact}
      storeName={data.storeName}
      strings={data.strings}
    />
  );
}
