"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Loader2, CheckCircle } from "lucide-react";

interface EmailFormProps {
  className?: string;
  buttonText?: string;
}

export function EmailForm({ className, buttonText = "Get Early Access" }: EmailFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setErrorMessage("Please enter your email");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to join waitlist");
      }

      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  if (status === "success") {
    return (
      <div className={`flex items-center gap-2 text-green-400 ${className}`}>
        <CheckCircle className="h-5 w-5" />
        <span>Thanks! We&apos;ll be in touch soon.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col sm:flex-row gap-3 ${className}`}>
      <div className="flex-1">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50"
          disabled={status === "loading"}
        />
        {status === "error" && errorMessage && (
          <p className="text-red-400 text-sm mt-1">{errorMessage}</p>
        )}
      </div>
      <Button
        type="submit"
        size="xl"
        disabled={status === "loading"}
        className="bg-violet-600 hover:bg-violet-500 text-white"
      >
        {status === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {buttonText}
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
