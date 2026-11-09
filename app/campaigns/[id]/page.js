"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, contactName, formatDate } from "@/lib/api-client";

const ACTIVE = ["queued", "running", "scheduled"];
const FILTERS = [
  ["", "All"],
  ["queued", "Queued"],
  ["sent", "Sent"],
  ["delivered", "Delivered"],
  ["read", "Read"],
  ["failed", "Failed"],
  ["skipped", "Skipped"],
];

// Human-readable hints for common WhatsApp delivery errors.
const ERROR_HINTS = {
  131026: "The number isn't on WhatsApp or can't receive this message.",
  131031: "Your WhatsApp Business account is restricted or locked. Check WhatsApp Manager.",
  131042: "Billing problem on your WhatsApp Business account (payment method or tax details). Fix it in Meta Business Suite → Billing, then resend.",
  131048: "Meta limited sending because of spam reports or low quality. Slow down and check your number's quality.",
  131053: "The header media couldn't be downloaded or is in an unsupported format.",
  131047: "More than 24 hours since the customer's last reply.",
  131049: "Meta limited marketing messages to this user to protect engagement.",
  131050: "The user stopped marketing messages from your business.",
  131051: "Unsupported message type.",
  132000: "Variable count doesn't match the template.",
  132001: "Template doesn't exist in this language.",
  132012: "Variable format doesn't match the template.",
  130472: "User is part of a Meta experiment and didn't receive marketing messages.",
  131056: "Too many messages to this user in a short time.",
  opted_out: "Contact opted out.",
  missing_variables: "A personalized value was empty.",
  interrupted: "Sending was interrupted; not retried to avoid duplicates.",
};

// Meta's own wording is the most specific (e.g. it says whether a 131042 is
// about tax details or the payment method), so show it first and the hint after.
function RecipientError({ code, message }) {
  const full = message ? String(message).replace(/\s*Visit https?:\/\/\S+.*$/s, "").trim() : "";
  const shown = full.length > 160 ? `${full.slice(0, 157)}…` : full;
  const hint = ERROR_HINTS[code];
  const numeric = code && !Number.isNaN(Number(code));
  return (
    <>
      {shown ? <p title={message}>{shown}</p> : null}
      {hint && hint !== full ? <p className={shown ? "mt-1 text-[#737373]" : undefined}>{shown ? `What to do: ${hint}` : hint}</p> : null}
      {!shown && !hint && code ? <p>{code}</p> : null}
      {numeric ? <p className="text-[#999]">Code {code}</p> : null}
    </>
  );
}

function Metric({ label, value, total }) {
  return (
    <div className="rounded-md border border-[#e6e6e6] p-4">
      <p className="text-xs text-[#737373]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
      {total ? <p className="text-xs text-[#999]">{Math.round((value / total) * 100)}%</p> : null}
    </div>
  );
}

export default function CampaignDetailPage({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [resending, setResending] = useState(false);
  const router = useRouter();

  const load = useCallback(() => {
    const query = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (filter) query.set("status", filter);
    api(`/api/campaigns/${id}?${query}`).then(setData).catch((error) => toast.error(error.message));
  }, [id, filter, page]);

  useEffect(() => { load(); }, [load]);

  const active = data && ACTIVE.includes(data.campaign.status);
  useEffect(() => {
    // Keep polling for a while after completion so delivery and read receipts appear.
    const recent = data?.campaign.completed_at && Date.now() - new Date(data.campaign.completed_at).getTime() < 10 * 60 * 1000;
    if (!active && !recent) return undefined;
    const timer = setInterval(load, active ? 3000 : 10000);
    return () => clearInterval(timer);
  }, [active, data?.campaign.completed_at, load]);

  async function cancel() {
    if (!window.confirm("Cancel this campaign? Messages already sent can't be recalled.")) return;
    try {
      await api(`/api/campaigns/${id}/cancel`, { method: "POST" });
      toast.success("Campaign cancelled");
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function resend() {
    const count = data.campaign.stats.failed;
    if (!window.confirm(`Resend to ${count} failed recipient${count === 1 ? "" : "s"}? This creates a new campaign with the same template and values. Opted-out contacts are skipped.`)) return;
    setResending(true);
    try {
      const result = await api(`/api/campaigns/${id}/resend`, { method: "POST" });
      toast.success(`Resending to ${result.recipients} recipient${result.recipients === 1 ? "" : "s"}`);
      router.push(`/campaigns/${result.jobId}`);
    } catch (error) {
      toast.error(error.message);
      setResending(false);
    }
  }

  if (!data) {
    return <AppShell title="Campaign" eyebrow="Campaigns"><p className="py-10 text-center text-sm text-[#888]">Loading…</p></AppShell>;
  }

  const { campaign, recipients, total } = data;
  const { stats } = campaign;
  const processed = stats.total - stats.pending;
  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <AppShell
      title={campaign.name || campaign.template_name}
      eyebrow="Campaign"
      action={
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link href="/campaigns"><ArrowLeft className="size-4" /> All campaigns</Link></Button>
          {active ? <Button variant="outline" className="text-[#b42318]" onClick={cancel}>Cancel</Button> : null}
          {!active && stats.failed > 0 ? (
            <Button onClick={resend} disabled={resending}>
              <RotateCcw className="size-4" /> {resending ? "Resending…" : `Resend to ${stats.failed} failed`}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        <Card className="rounded-lg border-[#e6e6e6] shadow-none">
          <CardContent className="space-y-5 pt-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <StatusBadge status={campaign.status} />
              <span className="text-[#737373]">Template <span className="font-medium text-[#1a1a1a]">{campaign.template_name}</span></span>
              {campaign.scheduled_at ? <span className="text-[#737373]">{campaign.status === "scheduled" ? "Sends" : "Scheduled"} {formatDate(campaign.scheduled_at)}</span> : null}
              {campaign.completed_at ? <span className="text-[#737373]">Finished {formatDate(campaign.completed_at)}</span> : null}
              {campaign.created_by_name ? <span className="text-[#737373]">By {campaign.created_by_name}</span> : null}
            </div>
            <div>
              <Progress value={stats.total ? (processed / stats.total) * 100 : 0} className="h-2" />
              <p className="mt-1.5 text-xs text-[#737373]">
                {processed.toLocaleString()} of {stats.total.toLocaleString()} processed
                {stats.pending ? ` · ${stats.pending.toLocaleString()} waiting` : ""}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Metric label="Sent" value={stats.sent} total={stats.total} />
              <Metric label="Delivered" value={stats.delivered} total={stats.sent} />
              <Metric label="Read" value={stats.read} total={stats.delivered} />
              <Metric label="Failed" value={stats.failed} total={stats.total} />
              <Metric label="Skipped" value={stats.skipped + stats.cancelled} total={stats.total} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-[#e6e6e6] shadow-none">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Recipients</CardTitle>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setFilter(value); setPage(1); }}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${filter === value ? "border-[#1a1a1a] bg-[#1a1a1a] text-white" : "border-[#e0e0e0] text-[#555] hover:bg-[#f6f6f6]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Updated</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-[#888]">No recipients with this status.</TableCell></TableRow>
                ) : recipients.map((recipient) => (
                  <TableRow key={recipient.id}>
                    <TableCell className="pl-6">
                      <p className="text-sm font-medium">{contactName({ ...recipient, phone: recipient.phone })}</p>
                      <p className="font-mono text-xs text-[#888]">{recipient.phone}</p>
                    </TableCell>
                    <TableCell><StatusBadge status={recipient.status} /></TableCell>
                    <TableCell className="hidden text-xs text-[#737373] md:table-cell">{formatDate(recipient.read_at || recipient.delivered_at || recipient.sent_at || recipient.failed_at || recipient.updated_at)}</TableCell>
                    <TableCell className="max-w-[360px] text-xs text-[#555]">
                      {recipient.error_code || recipient.error_message ? (
                        <>
                          <RecipientError code={recipient.error_code} message={recipient.error_message} />
                        </>
                      ) : recipient.attempts > 1 ? `Sent after ${recipient.attempts} attempts` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {pages > 1 ? (
          <div className="flex items-center justify-end gap-2 text-sm text-[#737373]">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span>Page {page} of {pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
