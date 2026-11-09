import Link from "next/link";
import { ContactImporter } from "@/components/contact-importer";

export default function GuidedImportPage() {
  return (
    <main className="min-h-screen bg-[#f7f9f7] text-[#111b21]">
      <header className="border-b border-[#dce5df] bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1200px] items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold"><span className="flex size-8 items-center justify-center rounded-lg bg-[#075e54] text-sm font-bold text-white">e</span>Engage</Link>
          <span className="text-xs font-medium text-[#66736b]">Workspace setup</span>
        </div>
      </header>
      <section className="mx-auto max-w-[1200px] px-5 py-10 md:py-14">
        <div className="mb-8 max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#107c41]">Bring your audience</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] md:text-5xl">Start with your contacts.</h1><p className="mt-4 text-base leading-7 text-[#5f6c64]">Upload a CSV or Excel file, match its columns, and keep consent visible before you create your first WhatsApp template.</p></div>
        <ContactImporter guided />
      </section>
    </main>
  );
}
