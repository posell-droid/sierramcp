import Image from "next/image";
import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="SierraMCP"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="text-xl font-bold tracking-tight">SierraMCP</span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </Link>
            <Link
              href="mailto:hello@sierramcp.com"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </Link>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} SierraMCP. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
