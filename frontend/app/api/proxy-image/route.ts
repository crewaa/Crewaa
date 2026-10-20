import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import os from "os"
import crypto from "crypto"

export const dynamic = "force-dynamic"

const CACHE_DIR = path.join(os.tmpdir(), "cree-image-proxy")

// Ensure cache directory exists
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
} catch {
  // Ignore filesystem init error
}

function getCacheKey(url: string): string {
  try {
    const parsed = new URL(url)
    return crypto.createHash("sha256").update(parsed.pathname).digest("hex")
  } catch {
    return crypto.createHash("sha256").update(url).digest("hex")
  }
}

function getMetaCachePath(key: string): string {
  return path.join(CACHE_DIR, `${key}.meta`)
}

function getImageCachePath(key: string): string {
  return path.join(CACHE_DIR, `${key}.bin`)
}

function isInstagramUrlExpired(url: string): boolean {
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

const DEFAULT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="p-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F2B28"/>
      <stop offset="100%" stop-color="#061614"/>
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="64" fill="url(#p-bg)"/>
  <circle cx="64" cy="46" r="21" fill="#26BDB0" opacity="0.85"/>
  <path d="M26 106 C 26 82, 42 74, 64 74 C 86 74, 102 82, 102 106 Z" fill="#26BDB0" opacity="0.85"/>
</svg>`

function fallbackSvgResponse() {
  return new NextResponse(DEFAULT_AVATAR_SVG, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

async function tryFetchImage(
  targetUrl: string
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: "https://www.instagram.com/",
      },
    })
    if (!res.ok) {
      return null
    }
    const contentType = res.headers.get("content-type") || "image/jpeg"
    const buffer = await res.arrayBuffer()
    return { buffer, contentType }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")
  const fallback = request.nextUrl.searchParams.get("fallback")

  if (!url) {
    if (fallback) {
      return NextResponse.redirect(fallback)
    }
    return fallbackSvgResponse()
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return fallbackSvgResponse()
    }

    const cacheKey = getCacheKey(url)
    const binPath = getImageCachePath(cacheKey)
    const metaPath = getMetaCachePath(cacheKey)

    // 1. Check if image is already cached on disk
    try {
      if (fs.existsSync(binPath)) {
        const fileBuffer = fs.readFileSync(binPath)
        let contentType = "image/jpeg"
        if (fs.existsSync(metaPath)) {
          contentType = fs.readFileSync(metaPath, "utf-8").trim() || "image/jpeg"
        }
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control":
              "public, max-age=86400, stale-while-revalidate=604800",
            "Cross-Origin-Resource-Policy": "cross-origin",
            "Access-Control-Allow-Origin": "*",
          },
        })
      }
    } catch {
      // Disk read error, proceed to fetch
    }

    // 2. If it's an expired Instagram URL, skip fetching the dead URL
    const isExpired = isInstagramUrlExpired(url)
    if (isExpired && fallback) {
      const fbResult = await tryFetchImage(fallback)
      if (fbResult) {
        try {
          fs.writeFileSync(binPath, Buffer.from(fbResult.buffer))
          fs.writeFileSync(metaPath, fbResult.contentType)
        } catch {}
        return new NextResponse(fbResult.buffer, {
          status: 200,
          headers: {
            "Content-Type": fbResult.contentType,
            "Cache-Control":
              "public, max-age=86400, stale-while-revalidate=604800",
            "Cross-Origin-Resource-Policy": "cross-origin",
            "Access-Control-Allow-Origin": "*",
          },
        })
      }
    }

    if (isExpired && !fallback) {
      return fallbackSvgResponse()
    }

    // 3. Fetch upstream image
    let fetchResult = await tryFetchImage(url)

    // 4. If upstream failed (e.g. 403 Forbidden or network error), try fallback
    if (!fetchResult && fallback) {
      fetchResult = await tryFetchImage(fallback)
    }

    // 5. If everything failed, return graceful themed SVG avatar
    if (!fetchResult) {
      return fallbackSvgResponse()
    }

    // 6. Cache successful image to disk
    try {
      fs.writeFileSync(binPath, Buffer.from(fetchResult.buffer))
      fs.writeFileSync(metaPath, fetchResult.contentType)
    } catch {
      // Ignore disk write errors
    }

    return new NextResponse(fetchResult.buffer, {
      status: 200,
      headers: {
        "Content-Type": fetchResult.contentType,
        "Cache-Control":
          "public, max-age=86400, stale-while-revalidate=604800",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch {
    return fallbackSvgResponse()
  }
}
