import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Serve modern formats when the browser supports them (AVIF → WebP →
    // JPEG fallback). Same URLs, smaller payloads on mobile networks.
    formats: ["image/avif", "image/webp"],
    // Mobile-first srcset: phones rarely need desktop-4K candidates, and
    // fewer candidates means lighter HTML and faster source selection.
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [96, 160, 256, 384],
    // Product/brand images can come from the store's media library,
    // Pexels (seed catalogue) or any CDN URL an admin pastes. HTTPS hosts
    // only; the optimizer never touches non-HTTPS sources.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
