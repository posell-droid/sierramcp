import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Terms of Service - SierraMCP",
  description: "Terms of Service for SierraMCP",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen py-20">
      <div className="container mx-auto px-4 max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-2 mb-12">
          <Image
            src="/logo.svg"
            alt="SierraMCP"
            width={40}
            height={40}
            className="h-10 w-10"
          />
          <span className="text-2xl font-bold tracking-tight">SierraMCP</span>
        </Link>

        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 28, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using SierraMCP (&quot;Service&quot;), you agree to be bound by these
              Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground">
              SierraMCP provides a platform that enables businesses to connect AI agents to
              enterprise tools through the Model Context Protocol (MCP). Our Service includes
              tools for creating, configuring, and deploying MCP integrations, as well as
              connecting these integrations to communication platforms like Slack and Microsoft Teams.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Account Registration</h2>
            <p className="text-muted-foreground mb-4">To use our Service, you must:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly notify us of any unauthorized use of your account</li>
              <li>Be at least 18 years old or have legal authority to enter into this agreement</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              You are responsible for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use</h2>
            <p className="text-muted-foreground mb-4">You agree not to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Violate any laws, regulations, or third-party rights</li>
              <li>Transmit malicious code, viruses, or harmful data</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Use the Service to send spam or unsolicited communications</li>
              <li>Resell or redistribute the Service without authorization</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Your Data</h2>
            <p className="text-muted-foreground">
              You retain ownership of all data you submit to the Service. By using the Service,
              you grant us a limited license to use, store, and process your data solely to
              provide and improve the Service. We will handle your data in accordance with our
              Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Third-Party Integrations</h2>
            <p className="text-muted-foreground">
              The Service enables connections to third-party applications (e.g., QuickBooks,
              Shopify, Slack). Your use of these integrations is subject to the respective
              third-party terms and policies. We are not responsible for third-party services
              or their handling of your data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Payment and Billing</h2>
            <p className="text-muted-foreground">
              Paid features are billed in accordance with the pricing plan you select. You
              agree to pay all fees associated with your account. Fees are non-refundable
              except as required by law or as explicitly stated in our refund policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Service Availability</h2>
            <p className="text-muted-foreground">
              We strive to maintain high availability but do not guarantee uninterrupted
              access to the Service. We may modify, suspend, or discontinue any part of the
              Service at any time with reasonable notice when possible.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Intellectual Property</h2>
            <p className="text-muted-foreground">
              The Service and its original content, features, and functionality are owned by
              SierraMCP and are protected by international copyright, trademark, and other
              intellectual property laws. You may not copy, modify, or reverse engineer any
              part of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SIERRAMCP SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS
              OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF
              DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Indemnification</h2>
            <p className="text-muted-foreground">
              You agree to indemnify and hold harmless SierraMCP and its officers, directors,
              employees, and agents from any claims, damages, losses, or expenses arising from
              your use of the Service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Termination</h2>
            <p className="text-muted-foreground">
              We may terminate or suspend your account at any time for violation of these Terms.
              Upon termination, your right to use the Service will immediately cease. You may
              terminate your account at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these Terms at any time. We will provide notice
              of significant changes by posting the updated Terms on our website. Your continued
              use of the Service after changes constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of
              the State of Delaware, United States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">15. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about these Terms, please contact us at:
            </p>
            <p className="text-muted-foreground mt-2">
              Email: <a href="mailto:hello@sierramcp.com" className="text-violet-400 hover:underline">hello@sierramcp.com</a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <Link href="/" className="text-violet-400 hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
