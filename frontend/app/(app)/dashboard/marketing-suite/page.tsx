import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "AI Marketing Suite" };

export default function MarketingSuitePage() {
  return (
    <ComingSoon
      part="suite"
      title="Plan, write and measure in one place."
      description="The AI Marketing Suite brings content ideas, captions, ad copy, content calendars and growth reports together, for brands and creators alike."
      points={["Captions and ad copy in your voice", "A content calendar that fills itself", "Growth reports from your real data"]}
    />
  );
}
