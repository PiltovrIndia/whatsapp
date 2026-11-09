"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, formatDate } from "@/lib/api-client";

const ACTIVE = ["queued", "running", "scheduled"];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(() => {
    api(`/api/campaigns?page=${page}&pageSize=20`)
      .then((data) => { setCampaigns(data.campaigns); setTotal(data.total); })
      .catch((error) => toast.error(error.message));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!campaigns?.some((campaign) => ACTIVE.includes(campaign.status))) return undefined;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [campaigns, load]);

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <AppShell
      title="Campaigns"
      eyebrow="Sending"
      action={<Button asChild className="bg-[#1a1a1a] hover:bg-black"><Link href="/send"><Plus className="size-4" /> New campaign</Link></Button>}
    >
      {campaigns === null ? (
        <p className="py-10 text-center text-sm text-[#888]">Loading campaigns…</p>
      ) : campaigns.length === 0 ? (
        <Card className="rounded-lg border-dashed border-[#dcdcdc] shadow-none">
          <CardContent className="py-12 text-center">
            <p className="font-medium">No campaigns yet</p>
            <p className="mt-1 text-sm text-[#737373]">Send an approved template to your opted-in contacts.</p>
            <Button asChild className="mt-5 bg-[#1a1a1a] hover:bg-black"><Link href="/send">Create campaign</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="rounded-lg border-[#e6e6e6] py-0 shadow-none">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-48">Progress</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Delivered</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Read</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Failed</TableHead>
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => {
                    const done = campaign.stats.total - campaign.stats.pending;
                    return (
                      <TableRow key={campaign.id}>
                        <TableCell className="pl-4">
                          <Link href={`/campaigns/${campaign.id}`} className="font-medium hover:underline">{campaign.name || campaign.template_name}</Link>
                          <p className="text-xs text-[#888]">{campaign.template_name}{campaign.created_by_name ? ` · ${campaign.created_by_name}` : ""}</p>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={campaign.status} />
                          {campaign.status === "scheduled" ? <p className="mt-1 text-[11px] text-[#888]">{formatDate(campaign.scheduled_at)}</p> : null}
                        </TableCell>
                        <TableCell>
                          <Progress value={campaign.stats.total ? (done / campaign.stats.total) * 100 : 0} className="h-1.5" />
                          <p className="mt-1 text-[11px] text-[#888]">{done.toLocaleString()} / {campaign.stats.total.toLocaleString()} processed</p>
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{campaign.stats.delivered.toLocaleString()}</TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{campaign.stats.read.toLocaleString()}</TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{(campaign.stats.failed + campaign.stats.skipped).toLocaleString()}</TableCell>
                        <TableCell className="hidden text-xs text-[#737373] lg:table-cell">{formatDate(campaign.created_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {pages > 1 ? (
            <div className="mt-4 flex items-center justify-end gap-2 text-sm text-[#737373]">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span>Page {page} of {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
