"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { ArrowRight, CheckCircle2, Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CONTACT_TEMPLATE_FILE_NAME,
  CONTACT_TEMPLATE_HEADERS,
  CONTACT_TEMPLATE_INSTRUCTIONS,
} from "@/lib/contact-template";

const targetFields = ["Ignore", "Phone", "First Name", "Last Name", "Email", "Company", "Opt In", "Attribute"];
const targetLabels = { Attribute: "Custom attribute" };

export function ContactImporter({ guided = false, onImported }) {
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [listName, setListName] = useState("All Contacts");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [countryCode, setCountryCode] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  const mapsOptIn = Object.values(mapping).includes("Opt In");

  function downloadTemplate() {
    const workbook = XLSX.utils.book_new();
    const contactsSheet = XLSX.utils.aoa_to_sheet([CONTACT_TEMPLATE_HEADERS]);
    contactsSheet["!cols"] = [
      { wch: 20 },
      { wch: 20 },
      { wch: 22 },
      { wch: 30 },
      { wch: 28 },
      { wch: 16 },
    ];
    contactsSheet["!autofilter"] = { ref: "A1:F1" };

    const instructionsSheet = XLSX.utils.aoa_to_sheet(CONTACT_TEMPLATE_INSTRUCTIONS);
    instructionsSheet["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 30 }, { wch: 62 }];

    XLSX.utils.book_append_sheet(workbook, contactsSheet, "Contacts");
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
    XLSX.writeFile(workbook, CONTACT_TEMPLATE_FILE_NAME, { compression: true });
  }

  async function parseFile(file) {
    if (!file) return;
    setFileName(file.name);
    setStatus("");
    setResult(null);

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsedRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const nextHeaders = Object.keys(parsedRows[0] || {});
      const nextMapping = {};

      nextHeaders.forEach((header) => {
        const key = header.toLowerCase();
        if (key.includes("phone") || key.includes("mobile") || key.includes("whatsapp")) nextMapping[header] = "Phone";
        else if (key.includes("first")) nextMapping[header] = "First Name";
        else if (key.includes("last")) nextMapping[header] = "Last Name";
        else if (key.includes("email")) nextMapping[header] = "Email";
        else if (key.includes("company") || key.includes("org")) nextMapping[header] = "Company";
        else if (key.includes("opt")) nextMapping[header] = "Opt In";
        else if (key.trim()) nextMapping[header] = "Attribute";
        else nextMapping[header] = "Ignore";
      });

      setHeaders(nextHeaders);
      setRows(parsedRows);
      setMapping(nextMapping);
      if (!parsedRows.length) setStatus("This file does not contain any contact rows.");
    } catch {
      setHeaders([]);
      setRows([]);
      setMapping({});
      setStatus("We could not read this file. Upload a valid CSV or Excel workbook.");
    }
  }

  async function importContacts() {
    setStatus("Importing contacts...");
    setResult(null);
    setImporting(true);
    try {
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listName,
          mapping,
          rows,
          source: (fileName || "import").slice(0, 120),
          defaultCountryCode: countryCode.replace(/[^\d]/g, ""),
          consentConfirmed,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data.error || "Import failed.");
        return;
      }
      setResult(data);
      setStatus(
        `Imported ${data.imported} contacts (${data.created} new, ${data.updated} updated). ` +
        `Skipped ${data.skipped} rows without a valid phone number` +
        (data.duplicatesInFile ? ` and ${data.duplicatesInFile} duplicate rows.` : ".")
      );
      onImported?.();
    } catch {
      setStatus("Import failed. Check your connection and try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {guided ? (
        <div className="flex flex-col gap-3 rounded-xl border border-[#dbe9df] bg-[#edf8f0] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#107c41]">Step 1 of 2</p><p className="mt-1 text-sm text-[#47604f]">Start with customers who have agreed to hear from your business.</p></div>
          {!result ? <Button asChild variant="ghost"><Link href="/dashboard">I&apos;ll do this later</Link></Button> : null}
        </div>
      ) : null}

      {result && guided ? (
        <Card className="border-[#25d366]/40 bg-[#f2fff5] shadow-none">
          <CardContent className="flex flex-col gap-5 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3"><CheckCircle2 className="mt-0.5 size-6 text-[#107c41]" /><div><p className="font-semibold">Your contacts are ready</p><p className="mt-1 text-sm text-[#526057]">{result.imported} imported · {result.skipped} skipped</p></div></div>
            <Button asChild className="bg-[#075e54] hover:bg-[#064d45]"><Link href="/templates/new">Continue to templates <ArrowRight className="size-4" /></Link></Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-lg border-[#e6e6e6] shadow-none">
          <CardHeader><CardTitle>{guided ? "Import your first contacts" : "Import customers"}</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-5 flex flex-col gap-4 rounded-lg border border-[#d8e8dc] bg-[#f7fbf8] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3"><FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-[#107c41]" /><div><p className="text-sm font-semibold">Start with our Excel template</p><p className="mt-1 text-xs leading-5 text-[#66736b]">Fill the Contacts sheet, keep the column names unchanged, then upload it below.</p></div></div>
              <Button type="button" variant="outline" onClick={downloadTemplate} className="shrink-0 bg-white"><Download className="size-4" /> Download template</Button>
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} onDrop={(event) => { event.preventDefault(); parseFile(event.dataTransfer.files?.[0]); }} onDragOver={(event) => event.preventDefault()} className="flex w-full flex-col items-center rounded-lg border border-dashed border-[#107c41]/30 bg-[#edf6ef] p-8 text-center hover:border-[#107c41]/50">
              <UploadCloud className="mb-3 size-7 text-[#107c41]" /><span className="font-semibold">Upload CSV or Excel</span><span className="mt-1 text-sm text-[#737373]">Preview the first 50 rows, then import the full file.</span>
            </button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={(event) => parseFile(event.target.files?.[0])} />
            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_140px]">
              <div><Label htmlFor={guided ? "guided-list-name" : "listName"}>Contact list</Label><Input id={guided ? "guided-list-name" : "listName"} value={listName} onChange={(event) => setListName(event.target.value)} /></div>
              <div><Label htmlFor={guided ? "guided-cc" : "countryCode"}>Default country code</Label><Input id={guided ? "guided-cc" : "countryCode"} value={countryCode} onChange={(event) => setCountryCode(event.target.value)} placeholder="+91" /></div>
            </div>
            <p className="mt-1.5 text-xs text-[#888]">The country code is added to numbers written without one. Leave it blank if every number already includes it.</p>
            {fileName ? <p className="mt-4 text-sm text-[#525252]">Selected: {fileName}</p> : null}
            {status ? <p className="mt-4 text-sm text-[#525252]" role="status">{status}</p> : null}
          </CardContent>
        </Card>

        <div className="space-y-5">
          {headers.length === 0 ? (
            <Card className="rounded-lg border-[#dfe7e1] bg-white/70 shadow-none">
              <CardHeader><CardTitle>What happens next</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {[
                  ["01", "Match your columns", "We suggest mappings for phone, name, email, company, and consent."],
                  ["02", "Review before import", "Preview up to 50 rows while the full file stays ready to import."],
                  ["03", "Continue to templates", "Once contacts are ready, move directly into your first approved message."],
                ].map(([number, title, copy]) => (
                  <div key={number} className="flex gap-4 border-b border-[#e7ece8] pb-5 last:border-0 last:pb-0">
                    <span className="font-mono text-xs font-semibold text-[#107c41]">{number}</span>
                    <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-[#68736c]">{copy}</p></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
          {headers.length > 0 ? (
            <Card className="rounded-lg border-[#e6e6e6] shadow-none">
              <CardHeader><CardTitle>Map fields</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {headers.map((header) => (
                  <div key={header} className="grid gap-3 rounded-md border border-[#e6e6e6] p-3 md:grid-cols-[1fr_220px] md:items-center">
                    <div><p className="font-medium">{header}</p><p className="text-xs text-[#737373]">Sample: {String(rows[0]?.[header] || "").slice(0, 80)}</p></div>
                    <Select value={mapping[header]} onValueChange={(value) => setMapping({ ...mapping, [header]: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{targetFields.map((field) => <SelectItem key={field} value={field}>{targetLabels[field] || field}</SelectItem>)}</SelectContent></Select>
                  </div>
                ))}
                <p className="text-xs text-[#737373]">Custom attributes are saved on each contact and can personalize template variables (e.g. an order number).</p>
                {!mapsOptIn ? (
                  <label className="flex items-start gap-3 rounded-md border border-[#e8b54a]/50 bg-[#fffaf0] p-3 text-sm">
                    <input type="checkbox" className="mt-1" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} />
                    <span>No Opt In column is mapped. I confirm every contact in this file has agreed to receive WhatsApp messages from us.</span>
                  </label>
                ) : null}
                <Button onClick={importContacts} disabled={importing || !rows.length || !Object.values(mapping).includes("Phone") || (!mapsOptIn && !consentConfirmed)} className="bg-[#075e54] hover:bg-[#064d45]">{importing ? "Importing…" : `Import ${rows.length.toLocaleString()} rows`}</Button>
              </CardContent>
            </Card>
          ) : null}

          {rows.length > 0 ? (
            <Card className="rounded-lg border-[#e6e6e6] shadow-none">
              <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto"><Table><TableHeader><TableRow>{headers.slice(0, 6).map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 50).map((row, index) => <TableRow key={`${index}-${fileName}`}>{headers.slice(0, 6).map((header) => <TableCell key={header}>{String(row[header] || "").slice(0, 80)}</TableCell>)}</TableRow>)}</TableBody></Table></div>
                <p className="mt-3 text-sm text-[#737373]">Showing {Math.min(rows.length, 50)} of {rows.length} rows. Import applies to the full file.</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
