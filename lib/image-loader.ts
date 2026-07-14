import type { ImageLoaderProps } from "next/image";

export function cloudflareImageLoader({ src, width, quality }: ImageLoaderProps): string {
  if (src.startsWith("http")) return src;
  if (src.startsWith("/")) return src;
  return src;
}

export function getOptimizedSrc(src: string, width: number): string {
  return cloudflareImageLoader({ src, width, quality: 80 });
}
