import { forwardRef, useId } from "react"

/**
 * The Crewaa mark in its peacock colours (teal arc, peacock-blue crescent,
 * gold dot), as inline SVG so it can animate. Same geometry as
 * public/crewaa-mark.svg. `animated` adds the classes site.css draws in.
 */
export const CrewaaMark = forwardRef<
  SVGCircleElement,
  { className?: string; animated?: boolean }
>(function CrewaaMark({ className, animated = false }, dotRef) {
  const id = useId().replace(/:/g, "")
  return (
    <svg className={className} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <linearGradient id={`a${id}`} x1="90" y1="330" x2="400" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#138A80" />
          <stop offset="1" stopColor="#5FE0D2" />
        </linearGradient>
        <linearGradient id={`b${id}`} x1="100" y1="200" x2="400" y2="460" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1B5F8C" />
          <stop offset="1" stopColor="#5CC3E4" />
        </linearGradient>
        <radialGradient id={`c${id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#F6E3A5" />
          <stop offset="1" stopColor="#D2A945" />
        </radialGradient>
      </defs>
      <path
        className={animated ? "swoosh" : undefined}
        d="M92.90 368.26A198.0 198.0 0 0 0 407.68 383.27A48.0 48.0 0 0 0 334.14 321.56A102.0 102.0 0 0 1 177.30 320.89A61.0 61.0 0 0 1 92.90 368.26Z"
        fill={`url(#b${id})`}
      />
      <path
        className={animated ? "arc" : undefined}
        pathLength={animated ? 1 : undefined}
        d="M370.91 159.58A150 150 0 0 0 116.92 312.19"
        fill="none"
        stroke={`url(#a${id})`}
        strokeWidth="96"
        strokeLinecap="round"
      />
      {animated && <circle className="halo" cx="406" cy="256" r="31" fill="none" stroke="#D8B45A" strokeWidth="2" />}
      <circle ref={dotRef} cx="406" cy="256" r="31" fill={`url(#c${id})`} />
    </svg>
  )
})
