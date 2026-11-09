"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, LogOut, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, formatDate } from "@/lib/api-client";

const QUALITY = { GREEN: "High", YELLOW: "Medium", RED: "Low", UNKNOWN: "Not rated yet" };

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#f0f0f0] py-2.5 text-sm last:border-0">
      <span className="text-[#737373]">{label}</span>
      <span className="text-right font-medium">{children || "—"}</span>
    </div>
  );
}

function describeAction(event) {
  const labels = {
    "auth.login": "Signed in",
    "template.create": `Submitted template ${event.metadata?.name || ""}`,
    "template.delete": "Deleted a template",
    "campaign.create": `Started a campaign to ${event.metadata?.recipients ?? "?"} contacts`,
    "campaign.cancel": "Cancelled a campaign",
    "contacts.import": `Imported ${event.metadata?.imported ?? "?"} contacts into ${event.metadata?.list || "a list"}`,
    "contact.delete": "Deleted a contact",
    "contact.opt_out": event.metadata?.via === "keyword" ? "A contact replied STOP and was opted out" : "Opted out a contact",
    "contact.opt_in": event.metadata?.via === "keyword" ? "A contact replied START and was opted in" : "Opted in a contact",
    "contact_list.delete": "Deleted a list",
    "whatsapp.webhook_subscribe": "Subscribed webhooks",
  };
  if (labels[event.action]) return labels[event.action];
  if (event.action.startsWith("contacts.bulk.")) return `Bulk ${event.action.slice(14)} on ${event.metadata?.count ?? "?"} contacts`;
  return event.action;
}

export default function WhatsAppSettingsPage() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await api("/api/whatsapp/status"));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    api("/api/auth/me").then((data) => setUser(data.user)).catch(() => {});
    api("/api/audit-logs").then((data) => setEvents(data.events)).catch(() => {});
    check();
  }, [check]);

  async function subscribe() {
    try {
      await api("/api/whatsapp/status", { method: "POST" });
      toast.success("Webhooks subscribed");
      check();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const canManage = ["owner", "admin"].includes(user?.role);

  return (
    <AppShell
      title="Settings"
      eyebrow="Configuration"
      action={<Button variant="outline" onClick={check} disabled={checking}><RefreshCw className={`size-4 ${checking ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Re-check</span></Button>}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-lg border-[#e6e6e6] shadow-none">
          <CardHeader><CardTitle>WhatsApp connection</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!status ? (
              <p className="text-sm text-[#888]">Checking connection…</p>
            ) : (
              <>
                <div className={`flex items-start gap-3 rounded-lg p-4 ${status.connected && !status.issues.length ? "bg-[#edf6ef]" : status.connected ? "bg-[#fffaf0]" : "bg-[#fdf3f2]"}`}>
                  {status.connected && !status.issues.length
                    ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#107c41]" />
                    : <AlertTriangle className={`mt-0.5 size-5 shrink-0 ${status.connected ? "text-[#9a6200]" : "text-[#b42318]"}`} />}
                  <div>
                    <p className="text-sm font-semibold">
                      {status.connected ? (status.issues.length ? "Connected, with warnings" : "Ready to send") : "Not connected"}
                    </p>
                    {status.issues.length ? (
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-[#555]">
                        {status.issues.map((issue) => <li key={issue}>{issue}</li>)}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-[#526057]">Templates, sending and delivery receipts are working.</p>
                    )}
                  </div>
                </div>
                {status.mode ? (
                  <div>
                    <Row label="Connection">{status.mode === "platform" ? "Managed by platform" : "Workspace account"}</Row>
                    <Row label="Phone number">{status.displayPhoneNumber}</Row>
                    <Row label="Display name">{status.verifiedName}</Row>
                    <Row label="Quality rating">{status.qualityRating ? QUALITY[status.qualityRating] || status.qualityRating : null}</Row>
                    <Row label="Messaging limit">{status.messagingLimitTier?.replace("TIER_", "").replace("UNLIMITED", "Unlimited")}{status.messagingLimitTier && status.messagingLimitTier !== "TIER_UNLIMITED" ? " customers / 24h" : ""}</Row>
                    <Row label="Webhooks">{status.webhook ? (status.webhook.subscribed ? "Subscribed" : "Not subscribed") : null}</Row>
                    <Row label="Last webhook event">{status.lastWebhookAt ? formatDate(status.lastWebhookAt) : "None received yet"}</Row>
                  </div>
                ) : null}
                {canManage && status.mode === "organization" && status.webhook && !status.webhook.subscribed ? (
                  <Button variant="outline" onClick={subscribe}>Subscribe webhooks</Button>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border-[#e6e6e6] shadow-none">
          <CardHeader><CardTitle>Workspace</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Organization</Label><Input value={user?.organization_name || ""} readOnly /></div>
            <div><Label>Signed in as</Label><Input value={user ? `${user.full_name} · ${user.email}` : ""} readOnly /></div>
            <div><Label>Role</Label><Input value={user?.role || ""} readOnly className="capitalize" /></div>
            <Button type="button" variant="outline" onClick={logout}><LogOut className="size-4" /> Sign out</Button>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-[#e6e6e6] shadow-none lg:col-span-2">
          <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
          <CardContent>
            {events.length ? (
              <ul className="divide-y divide-[#f0f0f0]">
                {events.map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <span>{describeAction(event)} {event.full_name ? <span className="text-[#888]">· {event.full_name}</span> : null}</span>
                    <span className="shrink-0 text-xs text-[#999]">{formatDate(event.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[#888]">No activity yet.</p>}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
