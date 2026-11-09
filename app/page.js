import Link from "next/link";
import { ArrowRight, Check, ContactRound, FileText, MessageSquareText, Send, ShieldCheck, Sparkles } from "lucide-react";

const capabilities = [
  ["Embedded onboarding", "Connect a business, WABA and phone number in one guided flow.", ShieldCheck],
  ["Clean contact imports", "Map customer data from CSV or Excel and keep consent visible.", ContactRound],
  ["Approved templates", "Create, preview and sync WhatsApp templates without leaving the workspace.", FileText],
  ["Visible delivery", "Send to opted-in audiences and follow every status from one place.", Send],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-[#1a1a1a]">
      <nav className="sticky top-0 z-30 border-b border-[#e6e6e6] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1152px] items-center justify-between px-5">
          <div className="flex items-center gap-12">
            <Link href="/" className="flex items-center gap-2.5 font-semibold">
              <span className="flex size-10 items-center justify-center rounded-lg bg-[#1a1a1a] text-base font-bold text-white">e</span>
              <span>Engage</span>
            </Link>
            <div className="hidden items-center gap-7 text-sm text-[#666] md:flex">
              <a href="#product" className="hover:text-[#1a1a1a]">Product</a>
              <a href="#workflow" className="hover:text-[#1a1a1a]">Workflow</a>
              <a href="#security" className="hover:text-[#1a1a1a]">Security</a>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#f5f5f5] sm:inline-flex">Sign in</Link>
            <Link href="/signup" className="rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black">Get started</Link>
          </div>
        </div>
      </nav>

      <header className="mx-auto max-w-[1152px] px-5 pb-20 pt-24 text-center md:pb-28 md:pt-28">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[#e6e6e6] bg-[#fafafa] px-3 py-1.5 text-xs font-medium text-[#555]">
          <Sparkles className="size-3.5" /> WhatsApp operations, simplified
        </div>
        <h1 className="mx-auto max-w-4xl text-[44px] font-semibold leading-[.98] tracking-[-.045em] text-[#0a0a0a] sm:text-6xl md:text-[72px]">
          The best way to run business messaging.
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-lg leading-7 text-[#606060]">
          Onboard businesses, organize opted-in customers, build approved templates, and send WhatsApp messages from one focused workspace.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#1a1a1a] px-6 text-sm font-semibold text-white shadow-sm hover:-translate-y-0.5 hover:bg-black">
            Create workspace <ArrowRight className="size-4" />
          </Link>
          <Link href="/login" className="inline-flex h-12 items-center rounded-lg border border-[#dedede] bg-white px-6 text-sm font-semibold hover:bg-[#f7f7f7]">Continue with email</Link>
        </div>

        <div className="relative mt-16 overflow-hidden rounded-xl border border-[#d9d4c8] bg-[#f1eee6] p-3 text-left shadow-[0_30px_80px_rgba(0,0,0,.12)] sm:p-6">
          <div className="overflow-hidden rounded-lg border border-[#dcdcdc] bg-white">
            <div className="flex h-12 items-center justify-between border-b border-[#e8e8e8] px-4">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-[#1a1a1a] text-[11px] font-bold text-white">e</span>
                <span className="text-xs font-semibold">Engage</span><span className="text-xs text-[#aaa]">/</span><span className="text-xs text-[#666]">Campaign workspace</span>
              </div>
              <span className="rounded-full bg-[#edf6ef] px-2.5 py-1 text-[10px] font-semibold text-[#107c41]">Live</span>
            </div>
            <div className="grid min-h-[390px] sm:grid-cols-[190px_1fr]">
              <aside className="hidden border-r border-[#ececec] p-3 sm:block">
                {['Overview','Onboarding','Contacts','Templates','Send'].map((item, index) => (
                  <div key={item} className={`mb-1 rounded-md px-3 py-2 text-xs ${index === 4 ? 'bg-[#f0f0f0] font-semibold text-[#1a1a1a]' : 'text-[#777]'}`}>{item}</div>
                ))}
              </aside>
              <section className="p-5 sm:p-8">
                <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#888]">Template campaign</p>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <div><h2 className="text-xl font-semibold tracking-[-.02em]">Order updates</h2><p className="mt-1 text-xs text-[#777]">Ready to send to 1,284 opted-in customers.</p></div>
                  <button className="rounded-lg bg-[#1a1a1a] px-4 py-2 text-xs font-semibold text-white">Send campaign</button>
                </div>
                <div className="mt-7 grid gap-4 md:grid-cols-[1fr_240px]">
                  <div className="rounded-lg border border-[#e5e5e5] p-4">
                    <p className="text-xs font-semibold">Delivery checklist</p>
                    <div className="mt-4 space-y-3">
                      {[['Approved template','order_ready_update'],['Audience','Customers · consent verified'],['Phone number','Connected · +1 415 555 0123'],['Variables','Name and order number mapped']].map(([label,value]) => (
                        <div key={label} className="flex items-center justify-between gap-4 border-b border-[#efefef] pb-3 text-xs last:border-0 last:pb-0"><span className="text-[#777]">{label}</span><span className="font-medium">{value}</span></div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#f1eee6] p-4">
                    <div className="ml-auto rounded-lg bg-white p-4 text-xs leading-5 shadow-sm"><p className="font-semibold">Order ready</p><p className="mt-2 text-[#525252]">Hi Asha, your order #1042 is ready for dispatch.</p><div className="mt-3 border-t border-[#ededed] pt-3 text-center font-semibold text-[#107c41]">Track order</div></div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </header>

      <section id="product" className="border-y border-[#e6e6e6] bg-[#fafafa]">
        <div className="mx-auto max-w-[1152px] px-5 py-24 md:py-28">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#777]">One operating system</p>
          <h2 className="mt-4 max-w-2xl text-4xl font-medium leading-tight tracking-[-.035em]">Everything your messaging team needs. Nothing it doesn’t.</h2>
          <div className="mt-14 grid border-l border-t border-[#e4e4e4] md:grid-cols-2">
            {capabilities.map(([title, copy, Icon]) => (
              <article key={title} className="group border-b border-r border-[#e4e4e4] bg-white p-7 md:p-9">
                <div className="flex size-10 items-center justify-center rounded-lg border border-[#e6e6e6] bg-[#fafafa] transition-transform group-hover:-translate-y-1"><Icon className="size-4.5" /></div>
                <h3 className="mt-8 text-lg font-semibold">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-[#707070]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto grid max-w-[1152px] gap-14 px-5 py-24 md:grid-cols-[.8fr_1.2fr] md:py-32">
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#777]">Visible execution</p><h2 className="mt-4 text-4xl font-medium leading-tight tracking-[-.035em]">Know what happens at every step.</h2><p className="mt-5 text-base leading-7 text-[#707070]">From business authorization to message delivery, every state is explicit, reviewable and ready for the next action.</p></div>
        <div className="divide-y divide-[#e7e7e7] border-y border-[#e7e7e7]">
          {['Create your workspace','Connect WhatsApp through Meta','Import opted-in customers','Sync an approved template','Send and track delivery'].map((item,index) => (
            <div key={item} className="flex items-center gap-5 py-5"><span className="flex size-7 items-center justify-center rounded-full bg-[#107c41] text-[11px] font-semibold text-white">{index+1}</span><span className="flex-1 text-sm font-medium">{item}</span><Check className="size-4 text-[#107c41]" /></div>
          ))}
        </div>
      </section>

      <section id="security" className="bg-[#1a1a1a] text-white">
        <div className="mx-auto flex max-w-[1152px] flex-col items-start justify-between gap-10 px-5 py-20 md:flex-row md:items-end">
          <div className="max-w-2xl"><MessageSquareText className="size-7" /><h2 className="mt-8 text-4xl font-medium tracking-[-.035em]">Built for serious customer communication.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-white/60">Server-side credentials, consent-aware contact handling and template-first sending keep your team inside the lines.</p></div>
          <Link href="/signup" className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-[#1a1a1a] hover:bg-[#ededed]">Try Engage <ArrowRight className="size-4" /></Link>
        </div>
      </section>

      <footer className="border-t border-[#e6e6e6] bg-white">
        <div className="mx-auto flex max-w-[1152px] flex-col gap-4 px-5 py-10 text-xs text-[#777] sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 font-semibold text-[#1a1a1a]"><span className="flex size-6 items-center justify-center rounded-md bg-[#1a1a1a] text-white">e</span> Engage</div><p>WhatsApp Cloud API operations for modern teams.</p></div>
      </footer>
    </main>
  );
}
