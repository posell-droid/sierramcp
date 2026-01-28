import { CheckCircle } from "lucide-react";

const features = [
  "Connects to systems without native AI support",
  "Transforms existing documentation into actionable knowledge",
  "No system rewrites or migrations required",
  "Preserves your current infrastructure investments",
];

export function LegacySystems() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Perfect for Legacy Systems
          </h2>
          <p className="text-muted-foreground text-lg mb-10">
            Most business-critical applications weren&apos;t designed with AI in mind.
            SierraMCP works with what you already have.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
            {features.map((feature) => (
              <div key={feature} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-violet-400 flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
