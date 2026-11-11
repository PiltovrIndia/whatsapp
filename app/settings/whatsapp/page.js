"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ExternalLink, LogOut, MessageCircle, Plus, RefreshCw, Smartphone, Unplug } from "lucide-react";
import { EmbeddedSignupButton } from "@/components/embedded-signup-button";
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
    "campaign.resend": `Resent a campaign to ${event.metadata?.recipients ?? "?"} failed recipient(s)`,
    "contacts.import": `Imported ${event.metadata?.imported ?? "?"} contacts into ${event.metadata?.list || "a list"}`,
    "contact.delete": "Deleted a contact",
    "contact.opt_out": event.metadata?.via === "keyword" ? "A contact replied STOP and was opted out" : "Opted out a contact",
    "contact.opt_in": event.metadata?.via === "keyword" ? "A contact replied START and was opted in" : "Opted in a contact",
    "contact_list.delete": "Deleted a list",
    "whatsapp.webhook_subscribe": "Subscribed webhooks",
    "whatsapp.connect": `Connected WhatsApp number ${event.metadata?.displayPhoneNumber || ""}`,
    "whatsapp.disconnect": `Disconnected WhatsApp number ${event.metadata?.displayPhoneNumber || ""}`,
  };
  if (labels[event.action]) return labels[event.action];
  if (event.action.startsWith("contacts.bulk.")) return `Bulk ${event.action.slice(14)} on ${event.metadata?.count ?? "?"} contacts`;
  return event.action;
}

const NEEDS = [
  "A Facebook account (you'll log in to Meta in a popup)",
  "Your business name, website and address",
  "A phone number that can receive an SMS or call, and isn't on WhatsApp already (for a new number)",
  "A payment method for Meta's message charges, added in Meta afterwards",
];

function ConnectOptions({ status, canManage, onConnected }) {
  if (!canManage) {
    return <p className="text-sm text-[#666]">Ask a workspace owner or admin to connect your business&apos;s WhatsApp number.</p>;
  }
  if (!status.signup?.configured) {
    return (
      <p className="rounded-lg bg-[#fffaf0] p-3 text-sm text-[#7a5200]">
        Connecting your own number isn&apos;t available yet: Embedded Signup isn&apos;t configured on this server
        (<code>NEXT_PUBLIC_META_APP_ID</code> and <code>NEXT_PUBLIC_META_CONFIG_ID</code>).
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col rounded-lg border border-[#e6e6e6] p-4">
          <Plus className="size-5 text-[#107c41]" />
          <p className="mt-2 text-sm font-semibold">Use a new number</p>
          <p className="mt-1 flex-1 text-xs leading-5 text-[#666]">A number that isn&apos;t on WhatsApp yet. You&apos;ll verify it by SMS or call. Sending only through TxtIt and the API.</p>
          <EmbeddedSignupButton onboardingType="cloud" onConnected={onConnected} className="mt-3 bg-[#1a1a1a] hover:bg-black">Connect new number</EmbeddedSignupButton>
        </div>
        <div className="flex flex-col rounded-lg border border-[#e6e6e6] p-4">
          <Smartphone className="size-5 text-[#107c41]" />
          <p className="mt-2 text-sm font-semibold">Use my WhatsApp Business app number</p>
          <p className="mt-1 flex-1 text-xs leading-5 text-[#666]">Keep chatting in the WhatsApp Business app on your phone while TxtIt sends templates from the same number.</p>
          <EmbeddedSignupButton onboardingType="coexistence" onConnected={onConnected} variant="outline" className="mt-3">Connect app number</EmbeddedSignupButton>
        </div>
      </div>
      <div className="rounded-lg bg-[#fafafa] p-3">
        <p className="text-xs font-semibold text-[#444]">What you&apos;ll need</p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs leading-5 text-[#666]">
          {NEEDS.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
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
    // Fetch on mount: state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  async function disconnect() {
    const number = status?.displayPhoneNumber || "this number";
    if (!window.confirm(`Disconnect ${number}? The number stays yours in Meta, but this workspace will stop sending from it${status?.signup?.platformAvailable ? " and go back to the shared TxtIt number" : ""}. Messages already queued for it will fail.`)) return;
    try {
      await api("/api/whatsapp/connection", { method: "DELETE" });
      toast.success("Number disconnected");
      check();
    } catch (error) {
      toast.error(error.message);
    }
  }

  function connected() {
    check();
    api("/api/audit-logs").then((data) => setEvents(data.events)).catch(() => {});
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const canManage = ["owner", "admin"].includes(user?.role);
  const isOwn = status?.mode === "organization";
  const onShared = status?.mode === "platform";

  return (
    <AppShell
      title="Settings"
      eyebrow="Configuration"
      action={<Button variant="outline" onClick={check} disabled={checking}><RefreshCw className={`size-4 ${checking ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Re-check</span></Button>}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {status && !isOwn ? (
          <Card className="rounded-lg border-[#1a1a1a] shadow-none lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageCircle className="size-5 text-[#107c41]" /> Connect your own WhatsApp number</CardTitle>
              <p className="text-sm text-[#666]">
                {onShared
                  ? "You're sending from the shared TxtIt number, so customers see TxtIt instead of your business. Connect your own number to send under your business name, with your own templates and limits."
                  : "Connect your business's WhatsApp number to start sending."}
                {" "}It takes about five minutes in a Meta popup. Meta bills message charges directly to your WhatsApp account.
              </p>
            </CardHeader>
            <CardContent><ConnectOptions status={status} canManage={canManage} onConnected={connected} /></CardContent>
          </Card>
        ) : null}
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
                    <Row label="Connection">{onShared ? "Shared TxtIt number" : status.account?.onboardingType === "coexistence" ? "Your number (WhatsApp Business app + TxtIt)" : "Your number"}</Row>
                    {isOwn ? <Row label="WhatsApp account">{status.account?.wabaName}</Row> : null}
                    <Row label="Phone number">{status.displayPhoneNumber}</Row>
                    <Row label="Display name">{status.verifiedName}</Row>
                    <Row label="Quality rating">{status.qualityRating ? QUALITY[status.qualityRating] || status.qualityRating : null}</Row>
                    <Row label="Messaging limit">{status.messagingLimitTier?.replace("TIER_", "").replace("UNLIMITED", "Unlimited")}{status.messagingLimitTier && status.messagingLimitTier !== "TIER_UNLIMITED" ? " customers / 24h" : ""}</Row>
                    <Row label="Webhooks">{status.webhook ? (status.webhook.subscribed ? "Subscribed" : "Not subscribed") : null}</Row>
                    <Row label="Last webhook event">{status.lastWebhookAt ? formatDate(status.lastWebhookAt) : "None received yet"}</Row>
                    {isOwn ? <Row label="Connected">{status.account?.connectedAt ? formatDate(status.account.connectedAt) : null}</Row> : null}
                  </div>
                ) : null}
                {isOwn && status.account?.healthProblems?.length ? (
                  <a href="https://business.facebook.com/billing_hub/accounts" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1a1a1a] underline underline-offset-4">
                    Open Meta billing &amp; payments <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
                {isOwn && user?.role === "owner" ? (
                  <div className="border-t border-[#f0f0f0] pt-4">
                    <Button variant="outline" onClick={disconnect} className="text-[#b42318] hover:text-[#b42318]"><Unplug className="size-4" /> Disconnect number</Button>
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
