import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, Monitor, Database, Users } from "lucide-react";

const painPoints = [
  {
    icon: Monitor,
    title: "Where does AI live?",
    description:
      "Is it embedded in existing apps, or does it require new interfaces?",
  },
  {
    icon: HelpCircle,
    title: "How do users access it?",
    description:
      "Through dedicated dashboards, command lines, or something else entirely?",
  },
  {
    icon: Database,
    title: "What about legacy systems?",
    description:
      "Most business-critical tools weren't built with AI in mind.",
  },
  {
    icon: Users,
    title: "Do we need engineers?",
    description:
      "Hiring specialized talent to build AI integrations is expensive and slow.",
  },
];

const comparison = [
  { promise: "AI transforms workflows", reality: "Complex integration requirements" },
  { promise: "Users get instant answers", reality: "Disconnected tools and data" },
  { promise: "Systems work seamlessly", reality: "Engineering bottlenecks" },
  { promise: "Productivity skyrockets", reality: "Uncertain implementation paths" },
];

export function ProblemSection() {
  return (
    <section className="py-24 bg-card/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            The AI Integration Confusion
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Every company knows AI will transform how users interact with software.
            But translating that promise into practice feels overwhelming.
          </p>
        </div>

        {/* Pain point cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {painPoints.map((point) => (
            <Card key={point.title} className="bg-background/50 border-border/50">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-3">
                  <point.icon className="h-5 w-5 text-violet-400" />
                </div>
                <CardTitle className="text-lg">{point.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{point.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Promise vs Reality */}
        <div className="max-w-3xl mx-auto">
          <h3 className="text-xl font-semibold text-center mb-8">
            The Gap: Promise vs Reality
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-2 bg-violet-500/10">
              <div className="px-6 py-3 font-semibold text-violet-300">
                The Promise
              </div>
              <div className="px-6 py-3 font-semibold text-muted-foreground border-l border-border">
                The Reality
              </div>
            </div>
            {comparison.map((row, index) => (
              <div
                key={index}
                className="grid grid-cols-2 border-t border-border"
              >
                <div className="px-6 py-4 text-sm">{row.promise}</div>
                <div className="px-6 py-4 text-sm text-muted-foreground border-l border-border">
                  {row.reality}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
