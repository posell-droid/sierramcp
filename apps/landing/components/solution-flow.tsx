import { FileText, Database, MessageSquare, Route, MessageCircle } from "lucide-react";

const steps = [
  {
    icon: FileText,
    title: "Ingest Documentation",
    description: "Pull from PDFs, YAML files, API docs, and other sources you already have.",
  },
  {
    icon: Database,
    title: "Build Knowledge Bases",
    description: "Vectorize content and create searchable, application-specific knowledge graphs.",
  },
  {
    icon: MessageSquare,
    title: "Define Tools",
    description: "Business users test and publish capabilities without writing code.",
  },
  {
    icon: Route,
    title: "Route Through Endpoints",
    description: "Bundle tools and connect them to your communication channels seamlessly.",
  },
  {
    icon: MessageCircle,
    title: "Meet Users Where They Work",
    description: "Deploy directly into Slack, Teams, Google Chat, or SMS—no new tools to learn.",
  },
];

export function SolutionFlow() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            How SierraMCP Works
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            SierraMCP bridges the gap between AI potential and practical deployment.
          </p>
        </div>

        {/* Flow diagram */}
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/50 via-violet-500/30 to-transparent hidden md:block" />

            {steps.map((step, index) => (
              <div
                key={step.title}
                className={`relative flex items-start gap-6 mb-12 last:mb-0 ${
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                {/* Step content */}
                <div
                  className={`flex-1 ${
                    index % 2 === 0 ? "md:text-right md:pr-12" : "md:text-left md:pl-12"
                  }`}
                >
                  <div
                    className={`inline-flex items-center gap-3 mb-2 ${
                      index % 2 === 0 ? "md:flex-row-reverse" : ""
                    }`}
                  >
                    <span className="text-xs font-medium text-violet-400 uppercase tracking-wider">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>

                {/* Icon (center on desktop) */}
                <div className="relative z-10 flex-shrink-0 md:absolute md:left-1/2 md:-translate-x-1/2">
                  <div className="w-12 h-12 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                    <step.icon className="h-6 w-6 text-violet-400" />
                  </div>
                </div>

                {/* Empty space for alternating layout */}
                <div className="hidden md:block flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
