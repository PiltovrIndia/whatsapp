import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export const LEGAL = {
  entity: "Piltovr",
  product: "TxtIt",
  email: "hi@piltovr.com",
  domains: ["txtit.in", "piltovr-wa.vercel.app"],
  effective: "11 November 2026",
};

export function LegalSection({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3 border-t border-[#ececec] pt-8">
      <h2 className="text-xl font-semibold tracking-[-.01em] text-[#1a1a1a]">{title}</h2>
      {children}
    </section>
  );
}

export function Mail() {
  return <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-2">{LEGAL.email}</a>;
}

export function LegalPage({ eyebrow, title, intro, sections, children }) {
  return (
    <div className="min-h-screen bg-white text-[#222]">
      <header className="sticky top-0 z-30 border-b border-[#e6e6e6] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" aria-label="TxtIt home"><BrandLogo height={30} priority /></Link>
          <nav className="flex gap-4 text-sm text-[#555]">
            <Link href="/terms" className="hover:text-[#1a1a1a]">Terms</Link>
            <Link href="/privacy" className="hover:text-[#1a1a1a]">Privacy</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl break-words px-4 py-10 text-[15px] leading-relaxed">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#888]">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-.02em] text-[#1a1a1a]">{title}</h1>
        <p className="mt-2 text-sm text-[#777]">Effective {LEGAL.effective}</p>
        <div className="mt-4 text-[#555]">{intro}</div>

        <nav aria-label="Contents" className="mt-6 rounded-lg border border-[#ececec] bg-[#fafafa] p-4 text-sm">
          <p className="mb-2 font-semibold text-[#1a1a1a]">Contents</p>
          <ol className="grid list-decimal gap-x-6 gap-y-1 pl-5 text-[#555] sm:grid-cols-2">
            {sections.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="underline-offset-2 hover:underline">{label}</a></li>
            ))}
          </ol>
        </nav>

        <div className="legal mt-8 space-y-10 [&_li]:mt-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
      </main>

      <footer className="border-t border-[#e6e6e6]">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-8 text-xs text-[#777] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {LEGAL.entity}. {LEGAL.product} is a product of {LEGAL.entity}.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-[#1a1a1a]">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-[#1a1a1a]">Privacy Policy</Link>
            <Mail />
          </div>
        </div>
      </footer>
    </div>
  );
}
