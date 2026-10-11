/**
 * Returns a browser-safe image URL.
 *
 * Instagram / Facebook CDN images send `Cross-Origin-Resource-Policy: same-origin`,
 * which causes modern web browsers to block the image when requested directly from
 * another origin. Routing through our local proxy `/api/proxy-image` strips this restriction
 * and serves the image with caching headers.
 */
export function getSafeImageUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return ""
  const clean = url.trim()
  if (!clean) return ""

  // If it's an Instagram or Facebook CDN URL, proxy it to avoid CORP same-origin block
  if (
    clean.includes("cdninstagram.com") ||
    clean.includes("fbcdn.net") ||
    clean.includes("instagram.com")
  ) {
    return `/api/proxy-image?url=${encodeURIComponent(clean)}`
  }

  return clean
}
