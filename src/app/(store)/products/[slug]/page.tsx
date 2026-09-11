import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/queries";
import { formatDate, formatPriceWithSymbol } from "@/lib/format";
import { getStoreSettings } from "@/lib/settings";
import { ProductCard } from "@/components/product-card";
import { StarRating } from "@/components/star-rating";
import { CheckIcon, RefreshIcon, TruckIcon } from "@/components/icons";
import { ProductGallery } from "./product-gallery";
import { ProductPurchase } from "./product-purchase";
import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getProductBySlug(slug);
  if (!detail) return { title: "Product not found" };
  return {
    title: detail.product.name,
    description: detail.product.description.slice(0, 155),
    openGraph: {
      title: detail.product.name,
      images: detail.product.images.slice(0, 1),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [detail, store] = await Promise.all([
    getProductBySlug(slug),
    getStoreSettings().catch(() => null),
  ]);
  if (!detail) notFound();

  const formatPrice = (cents: number) =>
    formatPriceWithSymbol(cents, store?.currency ?? "");

  const { product, reviews, avgRating, reviewCount, related } = detail;
  const onSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;
  const badge = product.isNew
    ? "New"
    : product.bestSeller
      ? "Best Seller"
      : onSale
        ? "Sale"
        : null;

  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="bg-bone pt-16">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 text-xs uppercase tracking-widest text-black/40">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <span>/</span>
          <Link
            href={`/shop?category=${encodeURIComponent(product.category)}`}
            className="hover:text-ink"
          >
            {product.category}
          </Link>
          <span>/</span>
          <span className="truncate text-ink">{product.name}</span>
        </nav>
      </div>

      {/* main */}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8">
        <ProductGallery
          images={product.images}
          name={product.name}
          badge={badge}
        />

        <div className="lg:py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-black/40">
            {product.collection} · {product.category}
          </p>
          <h1 className="mt-2 font-display text-4xl uppercase leading-tight tracking-tight sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-2 text-black/60">{product.tagline}</p>

          {reviewCount > 0 && (
            <a
              href="#reviews"
              className="mt-3 inline-flex items-center gap-2 text-sm text-black/60 hover:text-ink"
            >
              <StarRating rating={avgRating} size={16} />
              <span className="font-medium">{avgRating}</span>
              <span className="text-black/40">
                ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </span>
            </a>
          )}

          <div className="mt-5 flex items-center gap-3">
            <span className="font-display text-3xl">
              {formatPrice(product.price)}
            </span>
            {onSale && (
              <>
                <span className="text-lg text-black/35 line-through">
                  {formatPrice(product.compareAtPrice!)}
                </span>
                <span className="rounded-full bg-amber/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">
                  Save {formatPrice(product.compareAtPrice! - product.price)}
                </span>
              </>
            )}
          </div>

          <p className="mt-5 leading-relaxed text-black/70">
            {product.description}
          </p>

          <div className="mt-7">
            <ProductPurchase
              productId={product.id}
              slug={product.slug}
              name={product.name}
              price={product.price}
              image={product.images[0] ?? ""}
              sizes={product.sizes}
              colors={product.colors}
              stock={product.stock}
            />
          </div>

          {/* perks */}
          <div className="mt-8 grid grid-cols-1 gap-3 rounded-2xl border border-black/10 bg-brand-50 p-5 sm:grid-cols-3">
            {[
              { icon: TruckIcon, label: "Free shipping over $150" },
              { icon: RefreshIcon, label: "30-day easy returns" },
              { icon: CheckIcon, label: "Secure checkout" },
            ].map((p) => (
              <div key={p.label} className="flex items-center gap-2.5">
                <p.icon className="h-5 w-5 shrink-0 text-ink" />
                <span className="text-xs font-medium text-black/70">
                  {p.label}
                </span>
              </div>
            ))}
          </div>

          {/* details */}
          {product.details.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
                Product details
              </h2>
              <ul className="mt-3 space-y-2">
                {product.details.map((d) => (
                  <li
                    key={d}
                    className="flex items-start gap-2.5 text-sm text-black/70"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* REVIEWS */}
      <section id="reviews" className="border-t border-black/10 bg-brand-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-4xl uppercase tracking-tight sm:text-5xl">
            Reviews
          </h2>

          <div className="mt-8 grid gap-12 lg:grid-cols-[320px_1fr]">
            {/* summary */}
            <div>
              <div className="rounded-2xl border border-black/10 bg-bone p-6">
                <div className="flex items-end gap-3">
                  <span className="font-display text-5xl leading-none">
                    {reviewCount ? avgRating : "—"}
                  </span>
                  <div className="pb-1">
                    <StarRating rating={avgRating} size={16} />
                    <p className="mt-1 text-xs text-black/50">
                      {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                    </p>
                  </div>
                </div>

                {reviewCount > 0 && (
                  <div className="mt-5 space-y-2">
                    {dist.map((d) => (
                      <div key={d.star} className="flex items-center gap-2">
                        <span className="w-3 text-xs text-black/50">
                          {d.star}
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
                          <div
                            className="h-full rounded-full bg-amber-500"
                            style={{
                              width: `${
                                reviewCount ? (d.count / reviewCount) * 100 : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="w-5 text-right text-xs tabular-nums text-black/40">
                          {d.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6">
                  <ReviewForm productId={product.id} />
                </div>
              </div>
            </div>

            {/* list */}
            <div>
              {reviews.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-black/15 p-10 text-center text-sm text-black/50">
                  No reviews yet. Be the first to share your thoughts.
                </p>
              ) : (
                <ul className="space-y-5">
                  {reviews.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-2xl border border-black/10 bg-bone p-5"
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
                                  <CheckIcon className="h-3 w-3" /> Verified
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-black/40">
                          {formatDate(r.createdAt)}
                        </span>
                      </div>
                      {r.title && (
                        <h3 className="mt-3 text-sm font-semibold">{r.title}</h3>
                      )}
                      <p className="mt-1 text-sm leading-relaxed text-black/70">
                        {r.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* RELATED */}
      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
            You might also like
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {related.map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
