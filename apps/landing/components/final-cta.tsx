import { EmailForm } from "./email-form";
import { Users, Rocket, Code2 } from "lucide-react";

const pillars = [
  {
    icon: Users,
    title: "Meet Users Where They Are",
    description: "Deploy to Slack, Teams, or any chat platform",
  },
  {
    icon: Rocket,
    title: "Deploy in Days",
    description: "Not months of engineering work",
  },
  {
    icon: Code2,
    title: "No Code Required",
    description: "Business users can configure everything",
  },
];

export function FinalCTA() {
  return (
    <section className="py-24 bg-gradient-to-b from-violet-900/20 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to Transform How Your Team Accesses AI?
          </h2>
          <p className="text-muted-foreground text-lg mb-12">
            Join the waitlist for early access. Deploy in days, not months—no engineering required.
          </p>

          {/* Three pillars */}
          <div className="grid sm:grid-cols-3 gap-8 mb-12">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                  <pillar.icon className="h-6 w-6 text-violet-400" />
                </div>
                <h3 className="font-semibold mb-1">{pillar.title}</h3>
                <p className="text-sm text-muted-foreground">{pillar.description}</p>
              </div>
            ))}
          </div>

          {/* Email form */}
          <EmailForm className="max-w-md mx-auto" buttonText="Join the Waitlist" />
        </div>
      </div>
    </section>
  );
}
