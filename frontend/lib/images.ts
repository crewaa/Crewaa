/**
 * Checks whether an Instagram CDN signed URL has expired.
 * Instagram embeds the unix expiration timestamp in the `oe` parameter (in hex).
 */
export function isInstagramUrlExpired(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false
  const match = url.match(/[?&]oe=([0-9a-fA-F]+)/)
  if (match && match[1]) {
    try {
      const expSec = parseInt(match[1], 16)
      const nowSec = Math.floor(Date.now() / 1000)
      return nowSec > expSec
    } catch {
      return false
    }
  }
  return false
}

/**
 * Returns a browser-safe image URL.
 *
 * Instagram / Facebook CDN images send `Cross-Origin-Resource-Policy: same-origin`,
 * which causes modern web browsers to block the image when requested directly from
 * another origin. Routing through our local proxy `/api/proxy-image` strips this restriction
 * and serves the image with caching headers.
 *
 * If the primary URL is an expired Instagram URL and a fallback URL (e.g. YouTube profile pic)
 * is provided, it automatically prefers the working fallback.
 */
export function getSafeImageUrl(
  url?: string | null,
  fallbackUrl?: string | null
): string {
  const clean = (url || "").trim()
  const cleanFallback = (fallbackUrl || "").trim()

  if (!clean) return cleanFallback

  const isInstagram =
    clean.includes("cdninstagram.com") ||
    clean.includes("fbcdn.net") ||
    clean.includes("instagram.com")

  // If this Instagram URL is already expired and we have a valid fallback, prefer the fallback
  if (isInstagram && isInstagramUrlExpired(clean) && cleanFallback) {
    return getSafeImageUrl(cleanFallback)
  }

  // If it's an Instagram or Facebook CDN URL, proxy it to avoid CORP same-origin block
  if (isInstagram) {
    let proxyUrl = `/api/proxy-image?url=${encodeURIComponent(clean)}`
    if (cleanFallback) {
      proxyUrl += `&fallback=${encodeURIComponent(cleanFallback)}`
    }
    return proxyUrl
  }

  return clean
}
