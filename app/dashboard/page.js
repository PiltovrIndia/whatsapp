import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { MessagesChart } from "@/components/messages-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/server/auth";
import { getDashboard } from "@/lib/server/dashboard";

export const dynamic = "force-dynamic";

function percent(part, whole) {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 100)}%`;
}

function Stat({ label, value, hint }) {
  return (
    <Card className="rounded-lg border-[#e6e6e6] shadow-none">
      <CardContent className="pt-5">
        <p className="text-xs font-medium text-[#737373]">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold tracking-[-.02em]">{value}</p>
        {hint ? <p className="mt-1 text-xs text-[#888]">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/dashboard");

  let data;
  try {
    data = await getDashboard(session.organization_id);
  } catch (error) {
    console.error(error);
    return (
      <AppShell title="Overview" eyebrow={session.organization_name}>
        <Card className="rounded-lg border-[#f1c7c3] bg-[#fdf3f2] shadow-none">
          <CardContent className="pt-6 text-sm text-[#7a271a]">
            The dashboard could not load. Check that the database is reachable and migrations are applied (<code>npm run db:migrate</code>).
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const checklist = [
    { label: "Workspace created", done: true, href: null },
    { label: "Connect your WhatsApp number", done: data.ownNumberConnected, href: "/settings/whatsapp" },
    { label: "Import opted-in contacts", done: data.contacts.optedIn > 0, href: "/contacts?tab=import" },
    { label: "Get a template approved by WhatsApp", done: data.templates.approved > 0, href: "/templates/new" },
    { label: "Send your first campaign", done: data.campaigns > 0, href: "/send" },
  ];
  const nextStep = checklist.find((item) => !item.done);
  const { messages } = data;

  return (
    <AppShell
      title="Overview"
      eyebrow={session.organization_name}
      action={<Button asChild className="bg-[#1a1a1a] hover:bg-black"><Link href="/send">New campaign</Link></Button>}
    >
      <div className="space-y-5">
        {nextStep ? (
          <Card className="rounded-lg border-[#e6e6e6] shadow-none">
            <CardHeader><CardTitle>Get set up</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {checklist.map((item) => {
                const body = (
                  <div className={`flex h-full items-start gap-3 rounded-md border p-4 ${item === nextStep ? "border-[#1a1a1a]" : "border-[#e6e6e6]"}`}>
                    {item.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#107c41]" /> : <Circle className="mt-0.5 size-5 shrink-0 text-[#b5b5b5]" />}
                    <span className={`text-sm font-medium ${item.done ? "text-[#737373] line-through" : ""}`}>{item.label}</span>
                  </div>
                );
                return item.href && !item.done
                  ? <Link key={item.label} href={item.href} className="block hover:opacity-80">{body}</Link>
                  : <div key={item.label}>{body}</div>;
              })}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Opted-in contacts" value={data.contacts.optedIn.toLocaleString()} hint={`${data.contacts.total.toLocaleString()} total · ${data.contacts.optedOut.toLocaleString()} opted out`} />
          <Stat label="Approved templates" value={data.templates.approved} hint={`${data.templates.pending} in review · ${data.templates.rejected} rejected`} />
          <Stat label="Delivery rate (14 days)" value={percent(messages.delivered, messages.accepted)} hint={`${messages.delivered.toLocaleString()} of ${messages.accepted.toLocaleString()} delivered`} />
          <Stat label="Read rate (14 days)" value={percent(messages.read, messages.delivered)} hint={`${messages.failed.toLocaleString()} failed · ${messages.inbound.toLocaleString()} replies`} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Card className="rounded-lg border-[#e6e6e6] shadow-none">
            <CardHeader>
              <CardTitle>Messages sent</CardTitle>
              <p className="text-xs text-[#737373]">Outbound WhatsApp messages per day, last 14 days</p>
            </CardHeader>
            <CardContent><MessagesChart series={messages.series} /></CardContent>
          </Card>

          <Card className="rounded-lg border-[#e6e6e6] shadow-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent campaigns</CardTitle>
              <Link href="/campaigns" className="text-xs font-medium text-[#555] hover:text-[#1a1a1a]">View all</Link>
            </CardHeader>
            <CardContent>
              {data.recentCampaigns.length ? (
                <ul className="divide-y divide-[#efefef]">
                  {data.recentCampaigns.map((job) => (
                    <li key={job.id}>
                      <Link href={`/campaigns/${job.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{job.name || job.template_name}</p>
                          <p className="text-xs text-[#888]">
                            {job.stats.sent.toLocaleString()} sent · {job.stats.delivered.toLocaleString()} delivered · {job.stats.failed.toLocaleString()} failed
                          </p>
                        </div>
                        <StatusBadge status={job.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-sm text-[#737373]">No campaigns yet.</p>
                  <Button asChild variant="outline" size="sm" className="mt-3"><Link href="/send">Create a campaign <ArrowRight className="size-4" /></Link></Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
