"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("");

  async function submit(event) {
    event.preventDefault();
    setStatus("Signing in...");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Could not sign in.");
      return;
    }
    const next = searchParams.get("next") || "";
    // Only allow same-site paths to prevent open redirects.
    window.location.href = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafafa] px-5 text-[#1a1a1a]">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-[#e3e3e3] bg-white p-7 shadow-[0_18px_50px_rgba(0,0,0,.06)]">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-[#1a1a1a] font-bold text-white">
            e
          </span>
          <span className="font-semibold">Engage</span>
        </Link>
        <h1 className="text-2xl font-semibold tracking-[-.025em]">Welcome back</h1>
        <p className="mt-2 text-sm text-[#777]">Continue to your messaging workspace.</p>

        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
        </div>

        {status ? <p className="mt-4 text-sm text-[#555]">{status}</p> : null}

        <Button className="mt-6 w-full bg-[#1a1a1a] hover:bg-black">Sign in</Button>
        <p className="mt-5 text-center text-sm text-[#777]">
          New here? <Link href="/signup" className="font-semibold text-[#1a1a1a] underline underline-offset-4">Create a workspace</Link>
        </p>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
