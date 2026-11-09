"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const [status, setStatus] = useState("");

  async function submit(event) {
    event.preventDefault();
    setStatus("Creating workspace...");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.get("fullName"),
        email: form.get("email"),
        password: form.get("password"),
        organizationName: form.get("organizationName"),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Could not create workspace.");
      return;
    }
    window.location.href = "/getting-started/import";
  }

  return (
    <main className="grid min-h-screen bg-[#fafafa] text-[#1a1a1a] lg:grid-cols-[1fr_520px]">
      <section className="hidden border-r border-[#e6e6e6] bg-[#1a1a1a] px-14 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-white font-bold text-[#1a1a1a]">
            e
          </span>
          <span className="font-semibold">Engage</span>
        </Link>
        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[.16em] text-white/50">Built for serious messaging work</p>
          <h1 className="max-w-xl text-5xl font-medium leading-[1.05] tracking-[-.04em]">
            One precise workspace for every WhatsApp operation.
          </h1>
          <p className="mt-6 max-w-lg leading-7 text-white/60">
            Create your organization, import opted-in contacts, and start moving
            from approved templates to visible message delivery.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-[#e3e3e3] bg-white p-7 shadow-[0_18px_50px_rgba(0,0,0,.06)]">
          <h2 className="text-2xl font-semibold tracking-[-.025em]">Create workspace</h2>
          <p className="mt-2 text-sm text-[#777]">
            Set up the owner account for your business messaging console.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="organizationName">Business name</Label>
              <div className="relative mt-1">
                <Building2 className="absolute left-3 top-2.5 size-4 text-[#888]" />
                <Input id="organizationName" name="organizationName" className="pl-9" required />
              </div>
            </div>
            <div>
              <Label htmlFor="fullName">Your name</Label>
              <div className="relative mt-1">
                <UserRound className="absolute left-3 top-2.5 size-4 text-[#888]" />
                <Input id="fullName" name="fullName" className="pl-9" required />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-2.5 size-4 text-[#888]" />
                <Input id="email" name="email" type="email" className="pl-9" required />
              </div>
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
          </div>

          {status ? <p className="mt-4 text-sm text-[#555]">{status}</p> : null}

          <Button className="mt-6 w-full bg-[#1a1a1a] hover:bg-black">Create workspace</Button>
          <p className="mt-5 text-center text-sm text-[#777]">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[#1a1a1a] underline underline-offset-4">Sign in</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
