"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Plus, RefreshCw, Send } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, formatDate } from "@/lib/api-client";
import { languageLabel } from "@/lib/whatsapp-languages";

const FILTERS = [
  ["all", "All"],
  ["APPROVED", "Approved"],
  ["PENDING", "In review"],
  ["REJECTED", "Rejected"],
];
const REVIEW_STATUSES = ["PENDING", "IN_APPEAL"];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/whatsapp/templates");
      setTemplates(data.templates);
      return data.templates;
    } catch (error) {
      toast.error(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = useCallback(async ({ silent = false } = {}) => {
    setSyncing(true);
    try {
      const data = await api("/api/whatsapp/templates/sync", { method: "POST" });
      await load();
      if (!silent) toast.success(`Synced ${data.synced} template${data.synced === 1 ? "" : "s"} from WhatsApp`);
    } catch (error) {
      if (!silent) toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  }, [load]);

  useEffect(() => {
    // Pick up approval decisions for templates still in review.
    load().then((list) => {
      if (list.some((template) => REVIEW_STATUSES.includes(template.status))) sync({ silent: true });
    });
  }, [load, sync]);

  const visible = useMemo(() => templates.filter((template) => {
    if (filter === "all") return true;
    if (filter === "PENDING") return REVIEW_STATUSES.includes(template.status);
    return template.status === filter;
  }), [templates, filter]);

  async function remove(template) {
    if (!window.confirm(`Delete "${template.name}" from WhatsApp? Its name can't be reused for 30 days, and queued campaigns using it are cancelled.`)) return;
    try {
      await api(`/api/whatsapp/templates/${template.id}`, { method: "DELETE" });
      toast.success("Template deleted");
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function refresh(template) {
    try {
      const data = await api(`/api/whatsapp/templates/${template.id}?refresh=1`);
      toast.success(`Status: ${data.template.status.toLowerCase()}`);
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <AppShell
      title="Templates"
      eyebrow="WhatsApp approval"
      action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => sync()} disabled={syncing}>
            <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Sync</span>
          </Button>
          <Button asChild className="bg-[#1a1a1a] hover:bg-black"><Link href="/templates/new"><Plus className="size-4" /> New template</Link></Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(([value, label]) => {
          const count = value === "all" ? templates.length
            : value === "PENDING" ? templates.filter((t) => REVIEW_STATUSES.includes(t.status)).length
              : templates.filter((t) => t.status === value).length;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${filter === value ? "border-[#1a1a1a] bg-[#1a1a1a] text-white" : "border-[#e0e0e0] bg-white text-[#555] hover:bg-[#f6f6f6]"}`}
            >
              {label} <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-[#888]">Loading templates…</p>
      ) : visible.length === 0 ? (
        <Card className="rounded-lg border-dashed border-[#dcdcdc] shadow-none">
          <CardContent className="py-12 text-center">
            <p className="font-medium">{templates.length ? "No templates match this filter." : "No templates yet"}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-[#737373]">
              WhatsApp only lets businesses start conversations with templates Meta has approved. Create one, and it usually gets reviewed within minutes.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button asChild className="bg-[#1a1a1a] hover:bg-black"><Link href="/templates/new">Create template</Link></Button>
              <Button variant="outline" onClick={() => sync()}>Import from WhatsApp</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((template) => (
            <Card key={template.id} className="flex flex-col rounded-lg border-[#e6e6e6] shadow-none">
              <CardContent className="flex flex-1 flex-col pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold" title={template.name}>{template.name}</p>
                    <p className="mt-0.5 text-xs text-[#888]">{languageLabel(template.language)} · {template.category.toLowerCase()}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={template.status} />
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded p-1 hover:bg-[#f1f1f1]" aria-label="Template actions"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {template.status === "APPROVED" ? <DropdownMenuItem asChild><Link href={`/send?template=${template.id}`}>Use in campaign</Link></DropdownMenuItem> : null}
                        <DropdownMenuItem onClick={() => refresh(template)}>Refresh status</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-[#b42318]" onClick={() => remove(template)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <p className="mt-3 line-clamp-4 flex-1 whitespace-pre-wrap text-sm text-[#444]">{template.bodyText}</p>

                {template.status === "REJECTED" ? (
                  <div className="mt-3 rounded-md bg-[#fdf3f2] p-2.5 text-xs text-[#7a271a]">
                    <p className="font-semibold">Rejected{template.rejectedReason ? `: ${template.rejectedReason.replaceAll("_", " ").toLowerCase()}` : ""}</p>
                    <p className="mt-0.5">Edit the wording and submit it again under a new name.</p>
                  </div>
                ) : null}
                {REVIEW_STATUSES.includes(template.status) ? (
                  <p className="mt-3 text-xs text-[#9a6200]">Meta is reviewing this template. Approval usually takes a few minutes, occasionally up to 24 hours.</p>
                ) : null}

                <div className="mt-4 flex items-center justify-between border-t border-[#f0f0f0] pt-3">
                  <span className="text-xs text-[#999]">Updated {formatDate(template.updatedAt)}</span>
                  {template.status === "APPROVED" ? (
                    <Button asChild size="sm" variant="outline"><Link href={`/send?template=${template.id}`}><Send className="size-3.5" /> Send</Link></Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
