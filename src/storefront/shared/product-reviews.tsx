import { ReviewForm } from "@/app/(store)/products/[slug]/review-form";
import { CheckIcon } from "@/components/icons";
import { StarRating } from "@/components/star-rating";
import { formatDate } from "@/lib/format";
import { localeTag, type Locale } from "@/i18n/translations";
import type { PdpReview, Tr } from "@/storefront/types";

/**
 * Shared reviews block — summary card, distribution, form and list. Themes
 * place and skin it; content and behavior stay in one implementation.
 */
export function ProductReviews({
  productId,
  reviews,
  avgRating,
  reviewCount,
  dist,
  locale,
  tr,
  className = "",
}: {
  productId: number;
  reviews: PdpReview[];
  avgRating: number;
  reviewCount: number;
  dist: Array<{ star: number; count: number }>;
  locale: Locale;
  tr: Tr;
  className?: string;
}) {
  return (
    <section id="reviews" className={className}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-4xl uppercase tracking-tight sm:text-5xl">
          {tr("product.reviewsTitle")}
        </h2>

        <div className="mt-8 grid gap-12 lg:grid-cols-[320px_1fr]">
          {/* summary */}
          <div>
            <div className="rd-review-card rounded-2xl border border-black/10 bg-bone p-6">
              <div className="flex items-end gap-3">
                <span className="font-display text-5xl leading-none">
                  {reviewCount ? avgRating : "—"}
                </span>
                <div className="pb-1">
                  <StarRating rating={avgRating} size={16} />
                  <p className="mt-1 text-xs text-black/50">
                    {tr(
                      reviewCount === 1
                        ? "product.reviewCountOne"
                        : "product.reviewCountMany",
                      { count: reviewCount },
                    )}
                  </p>
                </div>
              </div>

              {reviewCount > 0 && (
                <div className="mt-5 space-y-2">
                  {dist.map((d) => (
                    <div key={d.star} className="flex items-center gap-2">
                      <span className="w-3 text-xs text-black/50">{d.star}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{
                            width: `${reviewCount ? (d.count / reviewCount) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="w-5 text-end text-xs tabular-nums text-black/40">
                        {d.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6">
                <ReviewForm productId={productId} />
              </div>
            </div>
          </div>

          {/* list */}
          <div>
            {reviews.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-black/15 p-10 text-center text-sm text-black/50">
                {tr("product.noReviews")}
              </p>
            ) : (
              <ul className="space-y-5">
                {reviews.map((r) => (
                  <li
                    key={r.id}
                    className="rd-review-item rounded-2xl border border-black/10 bg-bone p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-sm font-bold text-bone">
                          {r.author.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{r.author}</p>
                          <div className="flex items-center gap-2">
                            <StarRating rating={r.rating} size={13} />
                            {r.verified && (
                              <span className="flex items-center gap-1 text-[11px] font-medium text-olive">
                                <CheckIcon className="h-3 w-3" /> {tr("product.verified")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-black/40">
                        {formatDate(r.createdAt, localeTag(locale))}
                      </span>
                    </div>
                    {r.title && <h3 className="mt-3 text-sm font-semibold">{r.title}</h3>}
                    <p className="mt-1 text-sm leading-relaxed text-black/70">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
