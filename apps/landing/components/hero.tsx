import Image from "next/image";
import { EmailForm } from "./email-form";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-32">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-900/20 via-background to-background" />

      <div className="container relative mx-auto px-4">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Logo */}
          <div className="mb-8">
            <Image
              src="/logo.svg"
              alt="SierraMCP"
              width={200}
              height={60}
              priority
              className="h-12 w-auto"
            />
          </div>

          {/* Main headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-balance mb-6">
            Making AI accessible where your teams already work—
            <span className="gradient-text">no engineering required.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-muted-foreground max-w-2xl mb-10">
            Connect QuickBooks, Shopify, Salesforce, and more to Slack or Teams.
            Ask questions in plain English. Get answers in seconds.
          </p>

          {/* Email capture */}
          <EmailForm className="w-full max-w-md" />

          {/* Visual hint */}
          <div className="mt-16 flex flex-wrap justify-center gap-4 text-muted-foreground text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              Connect your tools
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              Ask in plain English
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              Get instant answers
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
