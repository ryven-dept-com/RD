import Image from "next/image";

/**
 * Shared product-card imagery — every theme card renders through this so the
 * performance invariants stay identical across all six storefronts:
 *   - server-optimized AVIF/WebP + responsive srcset, sized for the card;
 *   - a second (hover) image is rendered ONLY on pointer devices
 *     ([@media(hover:hover)]), so touch-first phones never download it;
 *   - base image stays visible while the hover asset loads.
 */
export function CardMedia({
  images,
  name,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
  priority = false,
  imgClassName = "",
}: {
  images: string[];
  name: string;
  sizes?: string;
  priority?: boolean;
  /** Extra classes applied to the base <img>. */
  imgClassName?: string;
}) {
  const secondImage = images[1] ?? images[0];
  const hasHoverImage = Boolean(secondImage) && secondImage !== images[0];

  return (
    <>
      {images[0] ? (
        <Image
          src={images[0]}
          alt={name}
          fill
          sizes={sizes}
          priority={priority}
          className={`img-zoom object-cover transition-opacity duration-500 ${
            hasHoverImage ? "group-hover:opacity-0" : ""
          } ${imgClassName}`}
        />
      ) : null}
      {hasHoverImage ? (
        <Image
          src={secondImage}
          alt=""
          aria-hidden="true"
          fill
          sizes={sizes}
          className="hidden object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 [@media(hover:hover)]:block"
        />
      ) : null}
    </>
  );
}
