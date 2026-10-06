import { Suspense } from "react"

import { UnsubscribeCard } from "./unsubscribe-card"

export const metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
}

export default function UnsubscribePage() {
  return (
    <main>
      <header className="phero" style={{ ["--c" as string]: "var(--teal)", minHeight: "70vh" }}>
        <div className="wrap">
          <Suspense fallback={null}>
            <UnsubscribeCard />
          </Suspense>
        </div>
      </header>
    </main>
  )
}
