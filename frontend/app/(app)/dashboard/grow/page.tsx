import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Crewaa Grow" };

export default function GrowPage() {
  return (
    <ComingSoon
      part="grow"
      title="Run your business. We'll grow it online."
      description="Crewaa Grow is a service: our team runs your ads, finds you leads and builds your presence online, and you follow every step here. We're getting it ready."
      points={["Meta ads planned, run and reported", "Lead generation", "Google Business Profile, website and SEO", "Social media management"]}
    />
  );
}
