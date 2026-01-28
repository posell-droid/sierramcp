const stats = [
  {
    value: "80%",
    label: "Faster Deployment",
    description: "Compared to traditional AI integration projects",
  },
  {
    value: "$0",
    label: "Engineering Cost",
    description: "Business users handle implementation independently",
  },
  {
    value: "60%",
    label: "Time Savings",
    description: "Employees spend less time searching for information",
  },
];

export function StatsSection() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-5xl sm:text-6xl font-bold gradient-text mb-2">
                {stat.value}
              </div>
              <div className="text-xl font-semibold mb-1">{stat.label}</div>
              <p className="text-muted-foreground text-sm">{stat.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
