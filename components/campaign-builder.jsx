"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Search, SendHorizonal, Upload } from "lucide-react";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, contactName } from "@/lib/api-client";
import {
  CONTACT_FIELDS,
  headerMediaFormat,
  renderPreview,
  templateVariableSlots,
  unsupportedSendFeatures,
} from "@/lib/message-payload";
import { languageLabel } from "@/lib/whatsapp-languages";

const ACCEPT = { IMAGE: "image/jpeg,image/png", VIDEO: "video/mp4", DOCUMENT: "application/pdf" };

function Step({ number, title, children, aside }) {
  return (
    <Card className="rounded-lg border-[#e6e6e6] shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-3">
          <span className="flex size-6 items-center justify-center rounded-full bg-[#1a1a1a] text-xs font-semibold text-white">{number}</span>
          {title}
        </CardTitle>
        {aside}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function VariableRule({ slot, rule, onChange }) {
  const source = rule?.source === "field" ? (rule.field?.startsWith("attr:") ? "attribute" : "field") : "static";
  return (
    <div className="grid gap-2 rounded-md border border-[#e6e6e6] p-3 md:grid-cols-[150px_150px_1fr] md:items-end">
      <div>
        <p className="text-sm font-medium">{slot.label}</p>
        {slot.example ? <p className="text-xs text-[#888]">e.g. {slot.example}</p> : null}
      </div>
      <div>
        <Label className="text-xs text-[#737373]">Value from</Label>
        <Select
          value={source}
          onValueChange={(next) => onChange(
            next === "static" ? { source: "static", value: "" }
              : next === "field" ? { source: "field", field: "first_name", fallback: "" }
                : { source: "field", field: "attr:", fallback: "" }
          )}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="static">Same text for everyone</SelectItem>
            <SelectItem value="field">Contact field</SelectItem>
            <SelectItem value="attribute">Custom attribute</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {source === "static" ? (
        <div>
          <Label className="text-xs text-[#737373]">Text</Label>
          <Input value={rule?.value || ""} onChange={(e) => onChange({ source: "static", value: e.target.value })} placeholder={slot.example || "Value"} />
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-[#737373]">{source === "field" ? "Field" : "Attribute key"}</Label>
            {source === "field" ? (
              <Select value={rule.field} onValueChange={(field) => onChange({ ...rule, field })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTACT_FIELDS.map((field) => <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Input
                value={rule.field.slice(5)}
                onChange={(e) => onChange({ ...rule, field: `attr:${e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_")}` })}
                placeholder="order_id"
              />
            )}
          </div>
          <div>
            <Label className="text-xs text-[#737373]">If empty, use</Label>
            <Input value={rule.fallback || ""} onChange={(e) => onChange({ ...rule, fallback: e.target.value })} placeholder="there" />
          </div>
        </div>
      )}
    </div>
  );
}

function ContactPicker({ selected, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ pageSize: "50", status: "opted_in" });
      if (query) params.set("q", query);
      api(`/api/contacts?${params}`).then((data) => setResults(data.contacts)).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const ids = selected.map((contact) => contact.id);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search opted-in contacts" className="pl-9" />
      </div>
      <div className="max-h-64 space-y-0.5 overflow-auto rounded-md border border-[#e6e6e6] p-1">
        {results.length ? results.map((contact) => (
          <label key={contact.id} className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-[#fafafa]">
            <Checkbox
              checked={ids.includes(contact.id)}
              onCheckedChange={(checked) => onChange(checked ? [...selected, contact] : selected.filter((c) => c.id !== contact.id))}
            />
            <span className="text-sm">{contactName(contact)} <span className="ml-1 font-mono text-xs text-[#888]">{contact.phone}</span></span>
          </label>
        )) : <p className="p-3 text-sm text-[#888]">No opted-in contacts found.</p>}
      </div>
      {selected.length ? <p className="text-xs text-[#555]">{selected.length} contact{selected.length === 1 ? "" : "s"} selected</p> : null}
    </div>
  );
}

export function CampaignBuilder({ initialTemplateId }) {
  const router = useRouter();
  const [templates, setTemplates] = useState(null);
  const [lists, setLists] = useState([]);
  const [templateId, setTemplateId] = useState(initialTemplateId || "");
  const [name, setName] = useState("");
  const [audienceType, setAudienceType] = useState("all");
  const [listIds, setListIds] = useState([]);
  const [pickedContacts, setPickedContacts] = useState([]);
  const [variables, setVariables] = useState({});
  const [media, setMedia] = useState({ mode: "link", link: "", id: "", fileName: "" });
  const [uploading, setUploading] = useState(false);
  const [schedule, setSchedule] = useState({ mode: "now", at: "" });
  const [rawEstimate, setEstimate] = useState(null);
  // Re-evaluated every 30s so a scheduled time that slips into the past disables sending.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api("/api/whatsapp/templates?status=APPROVED").then((data) => setTemplates(data.templates)).catch((error) => {
      toast.error(error.message);
      setTemplates([]);
    });
    api("/api/contact-lists").then((data) => setLists(data.lists)).catch(() => {});
  }, []);

  const template = templates?.find((item) => item.id === templateId) || null;
  const components = useMemo(() => template?.components || [], [template]);
  const slots = useMemo(() => templateVariableSlots(components), [components]);
  const mediaFormat = headerMediaFormat(components);
  const unsupported = unsupportedSendFeatures(components);

  // Reset variable rules when the template (and so its slots) changes.
  // Default: names come from the contact, everything else is typed in.
  const [prevSlots, setPrevSlots] = useState(slots);
  if (slots !== prevSlots) {
    setPrevSlots(slots);
    const next = {};
    for (const slot of slots) {
      next[slot.key] = slot.key === "body:1" && !slot.label.includes("code")
        ? { source: "field", field: "first_name", fallback: "there" }
        : { source: "static", value: "" };
    }
    setVariables(next);
  }

  const audience = useMemo(() => {
    if (audienceType === "lists") return listIds.length ? { type: "lists", listIds } : null;
    if (audienceType === "contacts") return pickedContacts.length ? { type: "contacts", contactIds: pickedContacts.map((c) => c.id) } : null;
    return { type: "all" };
  }, [audienceType, listIds, pickedContacts]);
  const estimate = audience ? rawEstimate : null;

  useEffect(() => {
    if (!audience) return;
    const timer = setTimeout(() => {
      api("/api/campaigns/estimate", { method: "POST", body: { audience } }).then(setEstimate).catch(() => setEstimate(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [audience]);

  const preview = useMemo(() => {
    const sample = { first_name: "Asha", last_name: "Rao", phone: "+919876543210", email: "asha@example.com", company: "Acme" };
    const values = {};
    for (const slot of slots) {
      const rule = variables[slot.key];
      if (!rule) continue;
      if (rule.source === "static") values[slot.key] = rule.value;
      else if (rule.field?.startsWith("attr:")) values[slot.key] = `[${rule.field.slice(5) || "attribute"}]`;
      else values[slot.key] = rule.field === "full_name" ? "Asha Rao" : sample[rule.field] || rule.fallback;
    }
    return renderPreview(components, values);
  }, [components, slots, variables]);

  const missingVariable = slots.find((slot) => {
    const rule = variables[slot.key];
    return !rule || (rule.source === "static" ? !rule.value.trim() : !rule.field || rule.field === "attr:");
  });
  const mediaReady = !mediaFormat || (media.mode === "link" ? /^https:\/\//.test(media.link) : Boolean(media.id));
  const scheduleReady = schedule.mode === "now" || (schedule.at && new Date(schedule.at).getTime() > now);
  const canSend = template && audience && estimate?.eligible > 0 && !missingVariable && mediaReady && scheduleReady && !unsupported.length;

  async function uploadMedia(file) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("format", mediaFormat);
      const data = await api("/api/whatsapp/media", { method: "POST", form });
      setMedia({ mode: "upload", link: "", id: data.id, fileName: data.fileName });
      toast.success("File uploaded");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!canSend) return;
    const count = estimate.eligible.toLocaleString();
    const when = schedule.mode === "now" ? "now" : `at ${new Date(schedule.at).toLocaleString()}`;
    if (!window.confirm(`Send "${template.name}" to ${count} opted-in contact(s) ${when}?`)) return;

    setSubmitting(true);
    try {
      const headerMedia = mediaFormat
        ? media.mode === "link"
          ? { link: media.link }
          : { id: media.id, ...(mediaFormat === "DOCUMENT" && media.fileName ? { filename: media.fileName } : {}) }
        : null;
      const data = await api("/api/campaigns", {
        method: "POST",
        body: {
          name: name.trim(),
          templateId,
          audience,
          variables,
          headerMedia,
          scheduledAt: schedule.mode === "later" ? new Date(schedule.at).toISOString() : null,
        },
      });
      toast.success(data.scheduled ? "Campaign scheduled" : `Sending to ${data.recipients.toLocaleString()} contacts`);
      router.push(`/campaigns/${data.jobId}`);
    } catch (error) {
      toast.error(error.message);
      setSubmitting(false);
    }
  }

  if (templates && templates.length === 0) {
    return (
      <Card className="rounded-lg border-dashed border-[#dcdcdc] shadow-none">
        <CardContent className="py-12 text-center">
          <p className="font-medium">No approved templates yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#737373]">WhatsApp requires an approved template to message customers. Create one, or sync templates you already have in Meta.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild className="bg-[#1a1a1a] hover:bg-black"><Link href="/templates/new">Create template</Link></Button>
            <Button asChild variant="outline"><Link href="/templates">View templates</Link></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  let step = 1;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-5">
        <Step number={step++} title="Template">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Approved template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder={templates ? "Choose a template" : "Loading…"} /></SelectTrigger>
                <SelectContent>
                  {(templates || []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name} · {languageLabel(item.language)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="campaign-name">Campaign name <span className="font-normal text-[#888]">optional</span></Label>
              <Input id="campaign-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={template?.name || "Diwali offer"} maxLength={160} />
            </div>
          </div>
          {unsupported.length ? <p className="mt-3 text-sm text-[#b42318]">{unsupported[0]}</p> : null}
        </Step>

        <Step number={step++} title="Audience" aside={estimate ? <span className="text-xs text-[#555]">{estimate.eligible.toLocaleString()} will receive it</span> : null}>
          <RadioGroup value={audienceType} onValueChange={setAudienceType} className="grid gap-2 sm:grid-cols-3">
            {[["all", "All opted-in contacts"], ["lists", "Contact lists"], ["contacts", "Specific contacts"]].map(([value, label]) => (
              <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm ${audienceType === value ? "border-[#1a1a1a]" : "border-[#e6e6e6]"}`}>
                <RadioGroupItem value={value} /> {label}
              </label>
            ))}
          </RadioGroup>

          {audienceType === "lists" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {lists.length ? lists.map((list) => {
                const checked = listIds.includes(list.id);
                return (
                  <button
                    type="button"
                    key={list.id}
                    onClick={() => setListIds(checked ? listIds.filter((id) => id !== list.id) : [...listIds, list.id])}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${checked ? "border-[#1a1a1a] bg-[#1a1a1a] text-white" : "border-[#ddd] bg-white text-[#555]"}`}
                  >
                    {list.name} <span className="opacity-60">{list.opted_in_count}</span>
                  </button>
                );
              }) : <p className="text-sm text-[#888]">No lists yet. <Link href="/contacts?tab=lists" className="underline">Create one</Link>.</p>}
            </div>
          ) : null}
          {audienceType === "contacts" ? <div className="mt-4"><ContactPicker selected={pickedContacts} onChange={setPickedContacts} /></div> : null}

          {estimate?.excluded ? (
            <p className="mt-3 text-xs text-[#737373]">{estimate.excluded.toLocaleString()} contact(s) in this audience have opted out and will be skipped.</p>
          ) : null}
          {estimate && estimate.eligible === 0 ? <p className="mt-3 text-sm text-[#b42318]">No opted-in contacts in this audience.</p> : null}
        </Step>

        {template && slots.length ? (
          <Step number={step++} title="Personalize">
            <div className="space-y-3">
              {slots.map((slot) => (
                <VariableRule
                  key={slot.key}
                  slot={slot}
                  rule={variables[slot.key]}
                  onChange={(rule) => setVariables((current) => ({ ...current, [slot.key]: rule }))}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-[#737373]">A contact whose value is empty and has no fallback is skipped rather than sent a broken message.</p>
          </Step>
        ) : null}

        {mediaFormat ? (
          <Step number={step++} title={`Header ${mediaFormat.toLowerCase()}`}>
            <RadioGroup value={media.mode} onValueChange={(mode) => setMedia({ ...media, mode })} className="flex gap-4">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="link" /> Public link</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="upload" /> Upload file</label>
            </RadioGroup>
            {media.mode === "link" ? (
              <Input className="mt-3" value={media.link} onChange={(e) => setMedia({ ...media, link: e.target.value })} placeholder="https://cdn.example.com/banner.jpg" />
            ) : (
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#ddd] bg-white px-3 py-2 text-sm font-medium hover:bg-[#f7f7f7]">
                <Upload className="size-4" /> {uploading ? "Uploading…" : media.fileName || "Choose file"}
                <input type="file" hidden accept={ACCEPT[mediaFormat]} disabled={uploading} onChange={(e) => uploadMedia(e.target.files?.[0])} />
              </label>
            )}
            <p className="mt-2 text-xs text-[#737373]">Links must be publicly reachable over HTTPS. Uploaded files stay available on WhatsApp for 30 days.</p>
          </Step>
        ) : null}

        <Step number={step++} title="Schedule">
          <RadioGroup value={schedule.mode} onValueChange={(mode) => setSchedule({ ...schedule, mode })} className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="now" /> Send now</label>
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="later" /> Schedule for later</label>
          </RadioGroup>
          {schedule.mode === "later" ? (
            <Input type="datetime-local" className="mt-3 sm:w-64" value={schedule.at} onChange={(e) => setSchedule({ ...schedule, at: e.target.value })} />
          ) : null}
        </Step>
      </div>

      <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <Card className="rounded-lg border-[#e6e6e6] shadow-none">
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <CardContent>
            {template ? (
              <WhatsAppPreview preview={preview} footnote="Shown with a sample contact (Asha Rao)." />
            ) : (
              <p className="text-sm text-[#888]">Choose a template to preview the message.</p>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-lg border-[#e6e6e6] shadow-none">
          <CardContent className="space-y-2 pt-5 text-sm">
            <div className="flex justify-between"><span className="text-[#737373]">Recipients</span><span className="font-medium">{estimate ? estimate.eligible.toLocaleString() : "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#737373]">Template</span><span className="max-w-[60%] truncate font-medium">{template?.name || "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#737373]">When</span><span className="font-medium">{schedule.mode === "now" ? "Immediately" : schedule.at ? new Date(schedule.at).toLocaleString() : "—"}</span></div>
            {missingVariable ? <p className="pt-1 text-xs text-[#9a6200]">Set a value for {missingVariable.label}.</p> : null}
            {!mediaReady ? <p className="pt-1 text-xs text-[#9a6200]">Add the header {mediaFormat?.toLowerCase()}.</p> : null}
          </CardContent>
        </Card>
        <Button onClick={submit} disabled={!canSend || submitting} className="w-full bg-[#1a1a1a] hover:bg-black">
          {schedule.mode === "now" ? <SendHorizonal className="size-4" /> : <CalendarClock className="size-4" />}
          {submitting ? "Creating campaign…" : schedule.mode === "now" ? "Send campaign" : "Schedule campaign"}
        </Button>
        <p className="text-center text-xs text-[#888]">Messages are sent in the background. You can leave this page.</p>
      </div>
    </div>
  );
}
