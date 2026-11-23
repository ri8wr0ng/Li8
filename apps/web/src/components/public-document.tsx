import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wordmark } from "#/components/brand";

export function PublicDocument({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 sm:px-10">
      <header className="py-6 sm:py-8">
        <Link to="/login" className="inline-flex rounded-md" aria-label="li8 home">
          <Wordmark />
        </Link>
      </header>
      <main className="flex-1 py-8 sm:py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <div className="prose dark:prose-invert mt-8 max-w-none">{children}</div>
      </main>
      <footer className="border-t py-6 text-sm text-muted-foreground">
        <nav aria-label="About li8" className="flex flex-wrap gap-x-6 gap-y-3">
          <Link to="/download" activeProps={{ className: "text-foreground underline" }}>
            Download the app
          </Link>
          <Link to="/privacy" activeProps={{ className: "text-foreground underline" }}>
            Privacy policy
          </Link>
          <Link to="/terms" activeProps={{ className: "text-foreground underline" }}>
            Terms of service
          </Link>
          <Link to="/support" activeProps={{ className: "text-foreground underline" }}>
            Support
          </Link>
        </nav>
      </footer>
    </div>
  );
}
