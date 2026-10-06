import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata = { title: "Crewaa Crew" };

export default function CrewPage() {
  return (
    <ComingSoon
      part="crew"
      title="Hire your crew. Keep creating."
      description="Video editors, script writers, thumbnail designers and more, from our in-house team and vetted freelancers. We're getting it ready."
      points={["Editors, writers and designers on call", "In-house team and vetted freelancers", "Thumbnails and post designs"]}
    />
  );
}
