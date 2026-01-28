import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Zap, Shield, DollarSign } from "lucide-react";

const benefits = [
  {
    icon: Code,
    title: "No Engineering Required",
    description:
      "Business users define, test, and deploy AI tools independently using natural language—no code, no waiting.",
  },
  {
    icon: Zap,
    title: "Faster Information Access",
    description:
      "Employees get answers to business-critical questions instantly, right where they're already communicating.",
  },
  {
    icon: Shield,
    title: "Enterprise-Ready Security",
    description:
      "Built with compliance and data protection in mind from day one.",
  },
  {
    icon: DollarSign,
    title: "Reduced Operational Cost",
    description:
      "Eliminate hiring delays, reduce support tickets, and accelerate time-to-value.",
  },
];

export function BenefitsGrid() {
  return (
    <section className="py-24 bg-card/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Why Teams Choose SierraMCP
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Deploy AI where your team already works, without the complexity.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {benefits.map((benefit) => (
            <Card
              key={benefit.title}
              className="bg-background/50 border-violet-500/20 hover:border-violet-500/40 transition-colors"
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4">
                  <benefit.icon className="h-6 w-6 text-violet-400" />
                </div>
                <CardTitle className="text-xl">{benefit.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{benefit.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
