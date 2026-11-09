"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { BookOpen, Copy, Eye, EyeOff, KeyRound, RefreshCw, Send, Trash2 } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, formatDate } from "@/lib/api-client";
import { curlExample, exampleRequestBody, nodeExample } from "@/lib/api-snippets";

const EVENT_LABELS = {
  "message.sent": "Message accepted by WhatsApp",
  "message.delivered": "Message delivered",
  "message.read": "Message read",
  "message.failed": "Message failed",
  "message.received": "Customer replied (any inbound message)",
  "contact.opted_out": "Contact replied STOP",
  "contact.opted_in": "Contact replied START",
};

async function copy(text, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Couldn't copy. Select the text and copy it manually.");
  }
}

function CodeBlock({ children }) {
  return (
    <div className="relative">
      <pre className="max-h-80 overflow-auto rounded-md bg-[#111] p-4 pr-12 text-xs leading-relaxed text-[#e8e8e8]"><code>{children}</code></pre>
      <button type="button" onClick={() => copy(children)} className="absolute right-2 top-2 rounded p-1.5 text-[#bbb] hover:bg-white/10" aria-label="Copy code">
        <Copy className="size-4" />
      </button>
    </div>
  );
}

function ApiKeysCard() {
  const [keys, setKeys] = useState(null);
  const [name, setName] = useState("");
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api("/api/api-keys").then((data) => setKeys(data.keys)).catch((error) => toast.error(error.message)), []);
  useEffect(() => { load(); }, [load]);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api("/api/api-keys", { method: "POST", body: { name } });
      setCreated(result);
      setName("");
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(key) {
    if (!window.confirm(`Revoke "${key.name}"? Apps using it will stop working immediately.`)) return;
    try {
      await api(`/api/api-keys/${key.id}`, { method: "DELETE" });
      toast.success("Key revoked");
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <Card className="rounded-lg border-[#e6e6e6] shadow-none">
      <CardHeader><CardTitle>API keys</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[#555]">Keys let your own systems send approved templates. Each key has full sending access to this workspace, so keep it on your server and never in a browser or mobile app.</p>
        <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Key name, e.g. School ERP (production)" maxLength={120} />
          <Button type="submit" disabled={busy || !name.trim()}><KeyRound className="size-4" /> Create key</Button>
        </form>

        {created ? (
          <div className="rounded-lg border border-[#b7dfc2] bg-[#edf6ef] p-4">
            <p className="text-sm font-semibold">Copy your new key now. You won&apos;t be able to see it again.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1.5 text-xs">{created.key}</code>
              <Button size="sm" variant="outline" onClick={() => copy(created.key, "Key copied")}><Copy className="size-4" /> Copy</Button>
            </div>
            <button type="button" className="mt-2 text-xs text-[#526057] underline" onClick={() => setCreated(null)}>I&apos;ve stored it safely</button>
          </div>
        ) : null}

        {keys === null ? <p className="text-sm text-[#888]">Loading…</p> : keys.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Key</TableHead><TableHead>Last used</TableHead><TableHead>Created</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id} className={key.revoked_at ? "opacity-50" : undefined}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell><code className="text-xs">{key.key_prefix}…</code></TableCell>
                    <TableCell className="text-xs text-[#666]">{key.last_used_at ? formatDate(key.last_used_at) : "Never"}</TableCell>
                    <TableCell className="text-xs text-[#666]">{formatDate(key.created_at)}{key.created_by_name ? ` · ${key.created_by_name}` : ""}</TableCell>
                    <TableCell className="text-right">
                      {key.revoked_at ? <span className="text-xs text-[#999]">Revoked</span> : (
                        <Button size="sm" variant="ghost" className="text-[#b42318]" onClick={() => revoke(key)}><Trash2 className="size-4" /> Revoke</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : <p className="text-sm text-[#888]">No keys yet.</p>}
      </CardContent>
    </Card>
  );
}

function WebhookCard() {
  const [endpoint, setEndpoint] = useState(undefined);
  const [allEvents, setAllEvents] = useState([]);
  const [form, setForm] = useState({ url: "", events: [], active: true });
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deliveries, setDeliveries] = useState([]);

  const applyEndpoint = useCallback((data) => {
    setEndpoint(data.endpoint);
    setAllEvents(data.events);
    setForm(data.endpoint
      ? { url: data.endpoint.url, events: data.endpoint.events, active: data.endpoint.active }
      : { url: "", events: data.events, active: true });
  }, []);

  const loadDeliveries = useCallback(() => api("/api/webhook-endpoint/deliveries").then((data) => setDeliveries(data.deliveries)).catch(() => {}), []);

  useEffect(() => {
    api("/api/webhook-endpoint").then(applyEndpoint).catch((error) => toast.error(error.message));
    loadDeliveries();
  }, [applyEndpoint, loadDeliveries]);

  async function save(extra = {}) {
    setSaving(true);
    try {
      const data = await api("/api/webhook-endpoint", { method: "PUT", body: { ...form, ...extra } });
      applyEndpoint(data);
      toast.success(extra.rotateSecret ? "New signing secret generated" : "Webhook saved");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    try {
      const result = await api("/api/webhook-endpoint/test", { method: "POST" });
      if (result.ok) toast.success(`Test event delivered (HTTP ${result.status})`);
      else toast.error(`Test event failed: ${result.error || `HTTP ${result.status}`}`);
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function remove() {
    if (!window.confirm("Remove this webhook? Pending events won't be delivered.")) return;
    try {
      await api("/api/webhook-endpoint", { method: "DELETE" });
      applyEndpoint({ endpoint: null, events: allEvents });
      toast.success("Webhook removed");
    } catch (error) {
      toast.error(error.message);
    }
  }

  const toggleEvent = (event, checked) => setForm((current) => ({
    ...current,
    events: checked ? [...new Set([...current.events, event])] : current.events.filter((item) => item !== event),
  }));

  return (
    <Card className="rounded-lg border-[#e6e6e6] shadow-none">
      <CardHeader><CardTitle>Webhook</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[#555]">We POST signed JSON events to your URL when messages are delivered, read or fail, and when customers reply. Failed deliveries are retried for about 9 hours.</p>
        {endpoint === undefined ? <p className="text-sm text-[#888]">Loading…</p> : (
          <form onSubmit={(event) => { event.preventDefault(); save(); }} className="space-y-4">
            <div>
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input id="webhook-url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://your-app.com/whatsapp/events" />
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Events</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {allEvents.map((event) => (
                  <label key={event} className="flex items-start gap-2 text-sm">
                    <Checkbox checked={form.events.includes(event)} onCheckedChange={(checked) => toggleEvent(event, Boolean(checked))} className="mt-0.5" />
                    <span><code className="text-xs">{event}</code><span className="block text-xs text-[#777]">{EVENT_LABELS[event]}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.active} onCheckedChange={(checked) => setForm({ ...form, active: Boolean(checked) })} /> Active
            </label>

            {endpoint ? (
              <div>
                <Label>Signing secret</Label>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded border border-[#e6e6e6] bg-[#fafafa] px-2 py-1.5 text-xs">{showSecret ? endpoint.secret : "whsec_" + "•".repeat(24)}</code>
                  <Button type="button" size="icon" variant="outline" onClick={() => setShowSecret(!showSecret)} aria-label={showSecret ? "Hide secret" : "Show secret"}>{showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
                  <Button type="button" size="icon" variant="outline" onClick={() => copy(endpoint.secret, "Secret copied")} aria-label="Copy secret"><Copy className="size-4" /></Button>
                </div>
                <p className="mt-1 text-xs text-[#777]">Verify the <code>X-Piltovr-Signature</code> header with this secret. See the <Link href="/developers#webhooks" className="underline">docs</Link>.</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving || !form.url.trim() || !form.events.length}>{endpoint ? "Save changes" : "Add webhook"}</Button>
              {endpoint ? (
                <>
                  <Button type="button" variant="outline" onClick={test}><Send className="size-4" /> Send test event</Button>
                  <Button type="button" variant="outline" disabled={saving} onClick={() => window.confirm("Generate a new secret? Your receiver must switch to it right away.") && save({ rotateSecret: true })}><RefreshCw className="size-4" /> Rotate secret</Button>
                  <Button type="button" variant="ghost" className="text-[#b42318]" onClick={remove}>Remove</Button>
                </>
              ) : null}
            </div>
          </form>
        )}

        {endpoint ? (
          <div className="pt-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Recent deliveries</p>
              <Button size="sm" variant="ghost" onClick={loadDeliveries}><RefreshCw className="size-4" /> Refresh</Button>
            </div>
            {deliveries.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Status</TableHead><TableHead>Attempts</TableHead><TableHead>Last response</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {deliveries.map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell><code className="text-xs">{delivery.event_type}</code></TableCell>
                        <TableCell><StatusBadge status={delivery.status} /></TableCell>
                        <TableCell className="text-xs">{delivery.attempts}</TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs text-[#666]" title={delivery.last_error || ""}>
                          {delivery.last_status_code ? `HTTP ${delivery.last_status_code}` : delivery.last_error || "—"}
                          {delivery.status === "pending" && delivery.next_attempt_at && delivery.attempts > 0 ? ` · retry ${formatDate(delivery.next_attempt_at)}` : ""}
                        </TableCell>
                        <TableCell className="text-xs text-[#666]">{formatDate(delivery.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : <p className="text-sm text-[#888]">No events yet.</p>}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function QuickstartCard() {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("curl");
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "https://your-domain");

  useEffect(() => {
    api("/api/whatsapp/templates?status=APPROVED").then((data) => setTemplates(data.templates)).catch(() => {});
  }, []);

  const template = templates.find((item) => item.id === selectedId) || templates[0];
  const body = useMemo(() => exampleRequestBody(template || { name: "your_template", language: "en_US", components: [] }), [template]);

  return (
    <Card className="rounded-lg border-[#e6e6e6] shadow-none">
      <CardHeader><CardTitle>Quickstart</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {templates.length ? (
          <div>
            <Label htmlFor="quickstart-template">Template</Label>
            <select id="quickstart-template" className="mt-1 h-9 w-full rounded-md border border-[#e6e6e6] bg-white px-2 text-sm" value={template?.id || ""} onChange={(event) => setSelectedId(event.target.value)}>
              {templates.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.language}</option>)}
            </select>
          </div>
        ) : <p className="text-sm text-[#888]">Once a template is approved, a ready-to-run example for it appears here.</p>}
        <div className="flex gap-1 text-sm">
          {["curl", "node"].map((value) => (
            <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-md px-3 py-1 ${tab === value ? "bg-[#111] text-white" : "text-[#555] hover:bg-[#f1f1f1]"}`}>{value === "curl" ? "cURL" : "Node.js"}</button>
          ))}
        </div>
        <CodeBlock>{tab === "curl" ? curlExample(origin, body) : nodeExample(origin, body)}</CodeBlock>
        <p className="text-xs text-[#777]">
          Variables are filled in order: <code>body[0]</code> is <code>{"{{1}}"}</code>, <code>body[1]</code> is <code>{"{{2}}"}</code>. The response returns a message <code>id</code> per recipient; check it with <code>GET /api/v1/messages/{"{id}"}</code> or wait for webhook events.
        </p>
      </CardContent>
    </Card>
  );
}

export default function ApiSettingsPage() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    api("/api/auth/me").then((data) => setRole(data.user?.role || "member")).catch(() => setRole("member"));
  }, []);

  return (
    <AppShell
      title="API & webhooks"
      eyebrow="Developers"
      action={<Button asChild variant="outline"><Link href="/developers" target="_blank"><BookOpen className="size-4" /> <span className="hidden sm:inline">API docs</span></Link></Button>}
    >
      {role === null ? <p className="py-10 text-center text-sm text-[#888]">Loading…</p> : !["owner", "admin"].includes(role) ? (
        <Card className="rounded-lg border-[#e6e6e6] shadow-none"><CardContent className="py-8 text-center text-sm text-[#555]">Only workspace owners and admins can manage API keys and webhooks.</CardContent></Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-5">
            <ApiKeysCard />
            <QuickstartCard />
          </div>
          <WebhookCard />
        </div>
      )}
    </AppShell>
  );
}
