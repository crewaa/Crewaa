import { Wallet } from "lucide-react"

/**
 * What happens to the money, shown once terms are agreed.
 *
 * Crewaa records an agreed fee but does not move it — payment/escrow (V2 §1.3)
 * is blocked on an RBI Payment Aggregator compliance check. The risk that
 * creates is not a missing feature, it is a wrong assumption: a creator who has
 * just agreed a fee inside a product that tracks the whole deal will reasonably
 * assume the product also pays them. Saying nothing lets them wait on a
 * transfer that is never coming.
 *
 * So this states both halves plainly — settle it yourselves, and Crewaa never
 * holds the money. The agreed figure is quoted back deliberately: it is exactly
 * what the creator receives today, with nothing deducted.
 *
 * When §1.3 ships this component is where the fee disclosure has to land too.
 * Crewaa's 20-25% commission is not shown anywhere yet (decision 2a, "gross
 * only"), which is honest while no money moves and becomes a lie the moment it
 * does.
 */
export function PaymentStatus({ fee }: { fee: string }) {
  return (
    <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium text-amber-200">
        <Wallet className="h-4 w-4" />
        Payment — coming soon
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-300">
        Crewaa does not process payments yet. Arrange the{" "}
        <span className="font-medium text-white">{fee}</span> directly with each
        other — bank transfer or UPI, as you would have before.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">
        Crewaa records the agreed terms and the delivery, but never holds the
        money, so nothing here confirms a payment was made. In-platform payments
        are being built.
      </p>
    </div>
  )
}
