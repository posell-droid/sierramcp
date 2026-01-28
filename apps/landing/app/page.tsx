import { Hero } from "@/components/hero";
import { ProblemSection } from "@/components/problem-section";
import { SolutionFlow } from "@/components/solution-flow";
import { BenefitsGrid } from "@/components/benefits-grid";
import { StatsSection } from "@/components/stats-section";
import { Integrations } from "@/components/integrations";
import { LegacySystems } from "@/components/legacy-systems";
import { FinalCTA } from "@/components/final-cta";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <ProblemSection />
      <SolutionFlow />
      <BenefitsGrid />
      <StatsSection />
      <Integrations />
      <LegacySystems />
      <FinalCTA />
      <Footer />
    </main>
  );
}
