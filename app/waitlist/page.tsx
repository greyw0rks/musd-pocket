"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type Status = "idle" | "loading" | "success";

export default function WaitlistPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setStatus("success");
      setEmail("");
      toast("success", data.message || "You're on the list.");
    } catch (err) {
      setStatus("idle");
      toast("error", err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <Wordmark className="text-lg" showMusd />
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-24">
        {status === "success" ? (
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight">
              You&rsquo;re on the list.
            </h1>
            <p className="mt-3 text-muted">
              We&rsquo;ll email you the moment Pocket opens up.
            </p>
            <Link
              href="/"
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark"
            >
              <ArrowLeft className="size-4" />
              Back to home
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Get early access
            </h1>
            <p className="mt-4 text-muted">
              Pocket is the simplest way to spend your Bitcoin without selling
              it. Leave your email and we&rsquo;ll let you in first.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
              <div>
                <Label htmlFor="waitlist-email">Email</Label>
                <Input
                  id="waitlist-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "loading"}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={status === "loading"}
                className="mt-1"
              >
                {status === "loading" ? "Joining…" : "Join the waitlist"}
                {status !== "loading" && <ArrowRight className="size-4" />}
              </Button>
            </form>

            <p className="mt-6 text-sm text-muted">
              No spam. We&rsquo;ll never share your email, and you can
              unsubscribe anytime.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
