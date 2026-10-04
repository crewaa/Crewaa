import Image from "next/image";
import Link from "next/link";

/**
 * The Crewaa lockup above an auth card.
 *
 * Shared rather than pasted into each of the five auth pages, because those
 * pages are the first thing a new creator or brand sees and the one place the
 * brand should be identical everywhere. One component also means the day the
 * logo changes again, it changes in one file.
 *
 * It links home deliberately: someone who lands on /login from an email and
 * wants to know what Crewaa actually is currently has no way back.
 */
export function AuthBrand() {
  return (
    <Link
      href="/"
      aria-label="Crewaa home"
      className="mb-7 flex justify-center transition hover:opacity-80"
    >
      {/* `unoptimized`: Next's image optimizer rejects SVGs unless
          `dangerouslyAllowSVG` is set globally, and a vector gains nothing
          from raster optimization. */}
      <Image
        src="/crewaa-logo-dark.svg"
        alt="Crewaa"
        width={128}
        height={38}
        priority
        unoptimized
        className="h-9 w-auto"
      />
    </Link>
  );
}
