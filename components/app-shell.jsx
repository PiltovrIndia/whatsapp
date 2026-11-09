"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Check,
  ChevronsUpDown,
  ContactRound,
  LogOut,
  Menu,
  MessageSquareText,
  Send,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { api } from "@/lib/api-client";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/contacts", label: "Contacts", icon: ContactRound },
  { href: "/templates", label: "Templates", icon: MessageSquareText },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/settings/whatsapp", label: "Settings", icon: Settings },
];

function NavLinks({ pathname, onNavigate }) {
  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          || (item.href === "/campaigns" && pathname.startsWith("/send"));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active ? "bg-[#f0f0f0] text-[#1a1a1a]" : "text-[#707070] hover:bg-[#f6f6f6] hover:text-[#1a1a1a]"}`}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function WorkspaceMenu() {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);

  useEffect(() => {
    api("/api/auth/me").then((data) => setUser(data.user)).catch(() => {});
    api("/api/auth/workspaces").then((data) => setWorkspaces(data.workspaces || [])).catch(() => {});
  }, []);

  async function switchTo(organizationId) {
    await api("/api/auth/workspaces", { method: "POST", body: { organizationId } });
    window.location.assign("/dashboard");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg border border-[#e7e7e7] bg-[#fafafa] p-2.5 text-left hover:bg-[#f3f3f3]">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#075e54] text-xs font-bold uppercase text-white">
          {(user?.organization_name || "?").slice(0, 2)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold">{user?.organization_name || "Workspace"}</span>
          <span className="block truncate text-[11px] text-[#888]">{user?.email || ""}</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-[#999]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {workspaces.length > 1 ? (
          <>
            <DropdownMenuLabel className="text-xs text-[#888]">Switch workspace</DropdownMenuLabel>
            {workspaces.map((workspace) => (
              <DropdownMenuItem key={workspace.id} onClick={() => switchTo(workspace.id)}>
                <span className="flex-1 truncate">{workspace.name}</span>
                {workspace.id === user?.organization_id ? <Check className="size-4" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem asChild><Link href="/settings/whatsapp"><Settings className="size-4" /> Settings</Link></DropdownMenuItem>
        <DropdownMenuItem onClick={logout}><LogOut className="size-4" /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex h-10 items-center gap-2.5 px-2 font-semibold">
      <span className="flex size-8 items-center justify-center rounded-lg bg-[#1a1a1a] text-sm font-bold text-white">e</span>
      <span>Engage</span>
    </Link>
  );
}

export function AppShell({ children, title, eyebrow, action }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#1a1a1a]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] border-r border-[#e6e6e6] bg-white p-4 lg:flex lg:flex-col">
        <Brand />
        <p className="mb-2 mt-9 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-[#999]">Workspace</p>
        <NavLinks pathname={pathname} />
        <div className="mt-auto"><WorkspaceMenu /></div>
      </aside>

      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-10 border-b border-[#e6e6e6] bg-white/90 px-4 backdrop-blur-md md:px-5">
          <div className="mx-auto flex min-h-16 max-w-[1200px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger className="flex size-9 items-center justify-center rounded-lg border border-[#e6e6e6] lg:hidden" aria-label="Open navigation">
                  <Menu className="size-4" />
                </SheetTrigger>
                <SheetContent side="left" className="flex w-[260px] flex-col p-4">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <Brand />
                  <div className="mt-6"><NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} /></div>
                  <div className="mt-auto"><WorkspaceMenu /></div>
                </SheetContent>
              </Sheet>
              <div className="min-w-0">
                {eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#888]">{eyebrow}</p> : null}
                <h1 className="truncate text-base font-semibold tracking-[-.01em]">{title}</h1>
              </div>
            </div>
            {action}
          </div>
        </header>
        <main className="mx-auto max-w-[1200px] px-4 py-6 md:px-7 md:py-9">{children}</main>
      </div>
    </div>
  );
}

export function StepStatus({ label, status }) {
  const styles = {
    done: "border-[#107c41]/30 bg-[#edf6ef] text-[#107c41]",
    active: "border-[#dadada] bg-white text-[#1a1a1a]",
    pending: "border-[#e5e5e5] bg-[#fafafa] text-[#888]",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${styles[status]}`}>{label}</span>;
}

const STATUS_TONES = {
  APPROVED: "bg-[#edf6ef] text-[#107c41] border-[#107c41]/25",
  completed: "bg-[#edf6ef] text-[#107c41] border-[#107c41]/25",
  delivered: "bg-[#edf6ef] text-[#107c41] border-[#107c41]/25",
  read: "bg-[#e8f3fb] text-[#0b6aa2] border-[#0b6aa2]/25",
  sent: "bg-[#f3f3f3] text-[#444] border-[#ddd]",
  PENDING: "bg-[#fff7e6] text-[#9a6200] border-[#e8b54a]/40",
  IN_APPEAL: "bg-[#fff7e6] text-[#9a6200] border-[#e8b54a]/40",
  queued: "bg-[#fff7e6] text-[#9a6200] border-[#e8b54a]/40",
  scheduled: "bg-[#f1effd] text-[#5b4bc4] border-[#5b4bc4]/25",
  running: "bg-[#e8f3fb] text-[#0b6aa2] border-[#0b6aa2]/25",
  sending: "bg-[#e8f3fb] text-[#0b6aa2] border-[#0b6aa2]/25",
  REJECTED: "bg-[#fdecec] text-[#b42318] border-[#b42318]/25",
  failed: "bg-[#fdecec] text-[#b42318] border-[#b42318]/25",
  completed_with_errors: "bg-[#fff7e6] text-[#9a6200] border-[#e8b54a]/40",
  PAUSED: "bg-[#fdecec] text-[#b42318] border-[#b42318]/25",
  DISABLED: "bg-[#fdecec] text-[#b42318] border-[#b42318]/25",
};

export function StatusBadge({ status }) {
  const tone = STATUS_TONES[status] || "bg-[#f3f3f3] text-[#555] border-[#ddd]";
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {String(status || "unknown").replaceAll("_", " ").toLowerCase()}
    </span>
  );
}
