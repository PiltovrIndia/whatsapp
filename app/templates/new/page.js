"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { buildTemplatePayload, uniqueVariableIndexes, validateTemplateInput } from "@/lib/template-payload";
import { renderPreview } from "@/lib/message-payload";
import { TEMPLATE_LANGUAGES } from "@/lib/whatsapp-languages";

const CATEGORY_HELP = {
  MARKETING: "Promotions, offers, announcements and re-engagement.",
  UTILITY: "Updates about an existing order, account or request. Must not contain promotional content.",
  AUTHENTICATION: "One-time passcodes. Meta supplies the wording; you send the code.",
};

const ACCEPT = { IMAGE: "image/jpeg,image/png", VIDEO: "video/mp4", DOCUMENT: "application/pdf" };

const INITIAL = {
  name: "",
  language: "en_US",
  category: "UTILITY",
  headerType: "NONE",
  headerText: "",
  headerExample: "",
  headerHandle: "",
  headerFileName: "",
  bodyText: "Hi {{1}}, your order {{2}} is ready for dispatch.",
  examples: { 1: "Asha", 2: "#1042" },
  footerText: "",
  buttons: [],
  auth: { addSecurityRecommendation: true, codeExpirationMinutes: 10, otpButtonText: "Copy code" },
};

export default function NewTemplatePage() {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [touched, setTouched] = useState(false);

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));
  const isAuth = form.category === "AUTHENTICATION";
  const bodyVars = uniqueVariableIndexes(form.bodyText);
  const headerHasVar = /\{\{\s*1\s*\}\}/.test(form.headerText);
  const problems = useMemo(() => validateTemplateInput(form), [form]);

  const preview = useMemo(() => {
    const { components } = buildTemplatePayload(form);
    const values = { "header:1": form.headerExample };
    for (const [key, value] of Object.entries(form.examples)) values[`body:${key}`] = value;
    if (isAuth) values["body:1"] = "123456";
    return renderPreview(components, values);
  }, [form, isAuth]);

  function addVariable() {
    const next = (bodyVars.at(-1) || 0) + 1;
    set({ bodyText: `${form.bodyText}${form.bodyText.endsWith(" ") || !form.bodyText ? "" : " "}{{${next}}}` });
  }

  function updateButton(index, patch) {
    set({ buttons: form.buttons.map((button, i) => (i === index ? { ...button, ...patch } : button)) });
  }

  function addButton(type) {
    const defaults = {
      QUICK_REPLY: { type, text: "" },
      URL: { type, text: "", url: "https://", urlExample: "" },
      PHONE_NUMBER: { type, text: "Call us", phoneNumber: "+" },
    };
    set({ buttons: [...form.buttons, defaults[type]] });
  }

  async function uploadSample(file) {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("format", form.headerType);
      const data = await api("/api/whatsapp/templates/media", { method: "POST", form: formData });
      set({ headerHandle: data.handle, headerFileName: data.fileName });
      toast.success("Sample uploaded");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setTouched(true);
    if (problems.length) {
      toast.error(problems[0]);
      return;
    }
    setSubmitting(true);
    try {
      const examples = Object.fromEntries(bodyVars.map((index) => [String(index), form.examples[index] || ""]));
      // headerFileName is UI-only state; the API doesn't accept it.
      const { headerFileName, ...rest } = form;
      const data = await api("/api/whatsapp/templates", {
        method: "POST",
        body: {
          ...rest,
          examples,
          auth: isAuth
            ? { ...form.auth, codeExpirationMinutes: form.auth.codeExpirationMinutes ? Number(form.auth.codeExpirationMinutes) : undefined }
            : undefined,
        },
      });
      toast.success(
        data.status === "APPROVED"
          ? "Template approved. It's ready to send."
          : "Template submitted to WhatsApp for review."
      );
      router.push("/templates");
    } catch (error) {
      toast.error(error.message);
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="New template"
      eyebrow="WhatsApp approval"
      action={<Button asChild variant="ghost"><Link href="/templates"><ArrowLeft className="size-4" /> Templates</Link></Button>}
    >
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <Card className="rounded-lg border-[#e6e6e6] shadow-none">
            <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Template name</Label>
                <Input
                  id="name"
                  value={form.name}
                  placeholder="order_ready_update"
                  onChange={(e) => set({ name: e.target.value.toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "") })}
                />
                <p className="mt-1 text-xs text-[#888]">Lowercase letters, numbers and underscores. A deleted name can&apos;t be reused for 30 days.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(category) => set({ category })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTILITY">Utility</SelectItem>
                      <SelectItem value="MARKETING">Marketing</SelectItem>
                      <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Language</Label>
                  <Select value={form.language} onValueChange={(language) => set({ language })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_LANGUAGES.map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="rounded-md bg-[#f7f7f7] p-3 text-xs leading-5 text-[#555]">{CATEGORY_HELP[form.category]}</p>
            </CardContent>
          </Card>

          {isAuth ? (
            <Card className="rounded-lg border-[#e6e6e6] shadow-none">
              <CardHeader><CardTitle>Passcode message</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-md border border-[#e6e6e6] p-3">
                  <div>
                    <p className="text-sm font-medium">Add security recommendation</p>
                    <p className="text-xs text-[#737373]">Appends “For your security, do not share this code.”</p>
                  </div>
                  <Switch
                    checked={form.auth.addSecurityRecommendation}
                    onCheckedChange={(value) => set({ auth: { ...form.auth, addSecurityRecommendation: value } })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="expiry">Code expires after (minutes)</Label>
                    <Input id="expiry" type="number" min={1} max={90} value={form.auth.codeExpirationMinutes}
                      onChange={(e) => set({ auth: { ...form.auth, codeExpirationMinutes: e.target.value } })} />
                  </div>
                  <div>
                    <Label htmlFor="otpText">Copy button text</Label>
                    <Input id="otpText" maxLength={25} value={form.auth.otpButtonText}
                      onChange={(e) => set({ auth: { ...form.auth, otpButtonText: e.target.value } })} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="rounded-lg border-[#e6e6e6] shadow-none">
                <CardHeader><CardTitle>Header <span className="text-sm font-normal text-[#888]">optional</span></CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Select value={form.headerType} onValueChange={(headerType) => set({ headerType, headerHandle: "", headerFileName: "" })}>
                    <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="TEXT">Text</SelectItem>
                      <SelectItem value="IMAGE">Image</SelectItem>
                      <SelectItem value="VIDEO">Video</SelectItem>
                      <SelectItem value="DOCUMENT">Document (PDF)</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.headerType === "TEXT" ? (
                    <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                      <div>
                        <Label htmlFor="headerText">Header text</Label>
                        <Input id="headerText" maxLength={60} value={form.headerText} onChange={(e) => set({ headerText: e.target.value })} placeholder="Order update for {{1}}" />
                      </div>
                      {headerHasVar ? (
                        <div>
                          <Label htmlFor="headerExample">Sample for {"{{1}}"}</Label>
                          <Input id="headerExample" value={form.headerExample} onChange={(e) => set({ headerExample: e.target.value })} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {["IMAGE", "VIDEO", "DOCUMENT"].includes(form.headerType) ? (
                    <div className="rounded-md border border-dashed border-[#d5d5d5] p-4">
                      <p className="text-sm font-medium">Sample {form.headerType.toLowerCase()} for review</p>
                      <p className="mt-0.5 text-xs text-[#737373]">Meta uses this sample during review. You choose the actual file each time you send.</p>
                      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#ddd] bg-white px-3 py-2 text-sm font-medium hover:bg-[#f7f7f7]">
                        <Upload className="size-4" /> {uploading ? "Uploading…" : form.headerFileName || "Choose file"}
                        <input type="file" hidden accept={ACCEPT[form.headerType]} disabled={uploading} onChange={(e) => uploadSample(e.target.files?.[0])} />
                      </label>
                      {form.headerHandle ? <span className="ml-3 text-xs text-[#107c41]">Uploaded</span> : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="rounded-lg border-[#e6e6e6] shadow-none">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Body</CardTitle>
                  <Button type="button" size="sm" variant="outline" onClick={addVariable}><Plus className="size-3.5" /> Add variable</Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Textarea rows={6} maxLength={1024} value={form.bodyText} onChange={(e) => set({ bodyText: e.target.value })} />
                    <p className="mt-1 text-right text-xs text-[#999]">{form.bodyText.length}/1024</p>
                  </div>
                  {bodyVars.length ? (
                    <div>
                      <p className="mb-2 text-xs text-[#737373]">Sample values help Meta understand the message. Use realistic examples, not real customer data.</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {bodyVars.map((index) => (
                          <div key={index}>
                            <Label htmlFor={`ex-${index}`}>Sample for {`{{${index}}}`}</Label>
                            <Input id={`ex-${index}`} value={form.examples[index] || ""} onChange={(e) => set({ examples: { ...form.examples, [index]: e.target.value } })} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <Label htmlFor="footer">Footer <span className="font-normal text-[#888]">optional</span></Label>
                    <Input id="footer" maxLength={60} value={form.footerText} onChange={(e) => set({ footerText: e.target.value })} placeholder="Reply STOP to opt out" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-lg border-[#e6e6e6] shadow-none">
                <CardHeader><CardTitle>Buttons <span className="text-sm font-normal text-[#888]">optional</span></CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {form.buttons.map((button, index) => (
                    <div key={index} className="space-y-3 rounded-md border border-[#e6e6e6] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                          {button.type === "QUICK_REPLY" ? "Quick reply" : button.type === "URL" ? "Visit website" : "Call phone number"}
                        </span>
                        <Button type="button" variant="ghost" size="icon" aria-label="Remove button" onClick={() => set({ buttons: form.buttons.filter((_, i) => i !== index) })}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>Button text</Label>
                          <Input maxLength={25} value={button.text} onChange={(e) => updateButton(index, { text: e.target.value })} />
                        </div>
                        {button.type === "URL" ? (
                          <div>
                            <Label>URL</Label>
                            <Input value={button.url} onChange={(e) => updateButton(index, { url: e.target.value })} placeholder="https://example.com/orders/{{1}}" />
                          </div>
                        ) : null}
                        {button.type === "PHONE_NUMBER" ? (
                          <div>
                            <Label>Phone number</Label>
                            <Input value={button.phoneNumber} onChange={(e) => updateButton(index, { phoneNumber: e.target.value })} placeholder="+14155550123" />
                          </div>
                        ) : null}
                      </div>
                      {button.type === "URL" && /\{\{\s*1\s*\}\}/.test(button.url || "") ? (
                        <div>
                          <Label>Sample value for {"{{1}}"}</Label>
                          <Input value={button.urlExample} onChange={(e) => updateButton(index, { urlExample: e.target.value })} placeholder="1042" />
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={form.buttons.length >= 10} onClick={() => addButton("QUICK_REPLY")}><Plus className="size-3.5" /> Quick reply</Button>
                    <Button type="button" variant="outline" size="sm" disabled={form.buttons.filter((b) => b.type === "URL").length >= 2} onClick={() => addButton("URL")}><Plus className="size-3.5" /> Website</Button>
                    <Button type="button" variant="outline" size="sm" disabled={form.buttons.some((b) => b.type === "PHONE_NUMBER")} onClick={() => addButton("PHONE_NUMBER")}><Plus className="size-3.5" /> Phone</Button>
                  </div>
                  {form.category === "MARKETING" && !form.buttons.some((b) => b.type === "QUICK_REPLY") ? (
                    <p className="text-xs text-[#737373]">Tip: a “Stop promotions” quick reply lets customers opt out. Replies of STOP are handled automatically.</p>
                  ) : null}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card className="rounded-lg border-[#e6e6e6] shadow-none">
            <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
            <CardContent>
              <WhatsAppPreview preview={preview} footnote="Variables show your sample values." />
            </CardContent>
          </Card>

          {touched && problems.length ? (
            <Card className="rounded-lg border-[#f1c7c3] bg-[#fdf3f2] shadow-none">
              <CardContent className="pt-5">
                <p className="text-sm font-semibold text-[#7a271a]">Fix these before submitting</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#7a271a]">
                  {problems.map((problem) => <li key={problem}>{problem}</li>)}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Button disabled={submitting || uploading} className="w-full bg-[#1a1a1a] hover:bg-black">
            {submitting ? "Submitting to WhatsApp…" : "Submit for review"}
          </Button>
          <p className="text-center text-xs text-[#888]">Meta reviews every template. Most decisions arrive within minutes.</p>
        </div>
      </form>
    </AppShell>
  );
}
