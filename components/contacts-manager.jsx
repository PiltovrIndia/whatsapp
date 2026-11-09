"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, contactName, formatDate } from "@/lib/api-client";

const PAGE_SIZE = 50;
const EMPTY_FORM = { firstName: "", lastName: "", phone: "", email: "", company: "", optIn: true, attributes: [], listIds: [] };

function ContactDialog({ open, onOpenChange, contact, lists, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Reset the form each time the dialog opens (adjusting state during render
  // avoids an extra effect-driven render).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setForm(contact
      ? {
          firstName: contact.first_name || "",
          lastName: contact.last_name || "",
          phone: contact.phone || "",
          email: contact.email || "",
          company: contact.company || "",
          optIn: Boolean(contact.opt_in),
          attributes: Object.entries(contact.attributes || {}).map(([key, value]) => ({ key, value })),
          listIds: [],
        }
      : EMPTY_FORM);
  }

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    const attributes = Object.fromEntries(
      form.attributes
        .filter((row) => row.key.trim())
        .map((row) => [row.key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 64), row.value])
    );
    const body = {
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      email: form.email || null,
      company: form.company,
      optIn: form.optIn,
      attributes,
      ...(contact ? {} : { listIds: form.listIds }),
    };
    try {
      if (contact) await api(`/api/contacts/${contact.id}`, { method: "PATCH", body });
      else await api("/api/contacts", { method: "POST", body });
      toast.success(contact ? "Contact updated" : "Contact added");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{contact ? "Edit contact" : "Add contact"}</DialogTitle>
            <DialogDescription>Phone numbers need a country code, e.g. +919876543210.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="c-first">First name</Label><Input id="c-first" value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} /></div>
            <div><Label htmlFor="c-last">Last name</Label><Input id="c-last" value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} /></div>
            <div><Label htmlFor="c-phone">Phone *</Label><Input id="c-phone" required value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+919876543210" /></div>
            <div><Label htmlFor="c-email">Email</Label><Input id="c-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label htmlFor="c-company">Company</Label><Input id="c-company" value={form.company} onChange={(e) => set({ company: e.target.value })} /></div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-[#e6e6e6] p-3">
            <div>
              <p className="text-sm font-medium">Opted in to WhatsApp messages</p>
              <p className="text-xs text-[#737373]">Only opted-in contacts receive campaigns.</p>
            </div>
            <Switch checked={form.optIn} onCheckedChange={(optIn) => set({ optIn })} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Custom attributes</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => set({ attributes: [...form.attributes, { key: "", value: "" }] })}><Plus className="size-3.5" /> Add</Button>
            </div>
            <p className="mb-2 text-xs text-[#737373]">Use attributes such as order_id to personalize templates.</p>
            <div className="space-y-2">
              {form.attributes.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <Input placeholder="key" value={row.key} onChange={(e) => set({ attributes: form.attributes.map((r, i) => i === index ? { ...r, key: e.target.value } : r) })} />
                  <Input placeholder="value" value={row.value} onChange={(e) => set({ attributes: form.attributes.map((r, i) => i === index ? { ...r, value: e.target.value } : r) })} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove attribute" onClick={() => set({ attributes: form.attributes.filter((_, i) => i !== index) })}><X className="size-4" /></Button>
                </div>
              ))}
            </div>
          </div>

          {!contact && lists.length ? (
            <div>
              <Label>Add to lists</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {lists.map((list) => {
                  const checked = form.listIds.includes(list.id);
                  return (
                    <button
                      type="button"
                      key={list.id}
                      onClick={() => set({ listIds: checked ? form.listIds.filter((id) => id !== list.id) : [...form.listIds, list.id] })}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${checked ? "border-[#1a1a1a] bg-[#1a1a1a] text-white" : "border-[#ddd] bg-white text-[#555]"}`}
                    >
                      {list.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={saving} className="bg-[#1a1a1a] hover:bg-black">{saving ? "Saving…" : "Save contact"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ContactsManager({ lists, onListsChanged, initialListId = "all" }) {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [listId, setListId] = useState(initialListId);
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState({ open: false, contact: null });
  const [bulkList, setBulkList] = useState("");

  const [prevInitialListId, setPrevInitialListId] = useState(initialListId);
  if (initialListId !== prevInitialListId) {
    setPrevInitialListId(initialListId);
    setListId(initialListId);
  }

  // New filters start from page 1 with nothing selected.
  const filterKey = `${debounced}|${listId}|${status}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
    setSelected([]);
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debounced) params.set("q", debounced);
    if (listId !== "all") params.set("listId", listId);
    if (status !== "all") params.set("status", status);
    try {
      const data = await api(`/api/contacts?${params}`);
      setContacts(data.contacts);
      setTotal(data.total);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [page, debounced, listId, status]);

  // Fetch whenever the query changes; state updates happen after the request resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const listNames = useMemo(() => Object.fromEntries(lists.map((list) => [list.id, list.name])), [lists]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allSelected = contacts.length > 0 && contacts.every((contact) => selected.includes(contact.id));

  async function bulk(action, extra = {}) {
    if (action === "delete" && !window.confirm(`Delete ${selected.length} contact(s)? Their message history is removed too.`)) return;
    try {
      const data = await api("/api/contacts/bulk", { method: "POST", body: { action, contactIds: selected, ...extra } });
      toast.success(`Updated ${data.affected} contact(s)`);
      setSelected([]);
      load();
      onListsChanged();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function rowAction(contact, action) {
    try {
      if (action === "delete") {
        if (!window.confirm(`Delete ${contactName(contact)}?`)) return;
        await api(`/api/contacts/${contact.id}`, { method: "DELETE" });
        toast.success("Contact deleted");
      } else {
        await api(`/api/contacts/${contact.id}`, { method: "PATCH", body: { optIn: action === "optIn" } });
        toast.success(action === "optIn" ? "Contact opted in" : "Contact opted out");
      }
      load();
      onListsChanged();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email or company" className="bg-white pl-9" />
        </div>
        <Select value={listId} onValueChange={setListId}>
          <SelectTrigger className="bg-white md:w-48"><SelectValue placeholder="All lists" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All lists</SelectItem>
            {lists.map((list) => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="bg-white md:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any consent</SelectItem>
            <SelectItem value="opted_in">Opted in</SelectItem>
            <SelectItem value="opted_out">Opted out</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setDialog({ open: true, contact: null })} className="bg-[#1a1a1a] hover:bg-black"><Plus className="size-4" /> Add contact</Button>
      </div>

      {selected.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e6e6e6] bg-white p-3 text-sm">
          <span className="mr-2 font-medium">{selected.length} selected</span>
          <Select value={bulkList} onValueChange={setBulkList}>
            <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Choose list" /></SelectTrigger>
            <SelectContent>{lists.map((list) => <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!bulkList} onClick={() => bulk("addToList", { listId: bulkList })}>Add to list</Button>
          <Button size="sm" variant="outline" disabled={!bulkList} onClick={() => bulk("removeFromList", { listId: bulkList })}>Remove from list</Button>
          <Button size="sm" variant="outline" onClick={() => bulk("optIn")}>Opt in</Button>
          <Button size="sm" variant="outline" onClick={() => bulk("optOut")}>Opt out</Button>
          <Button size="sm" variant="outline" className="text-[#b42318]" onClick={() => bulk("delete")}><Trash2 className="size-3.5" /> Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
        </div>
      ) : null}

      <Card className="rounded-lg border-[#e6e6e6] py-0 shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-4">
                    <Checkbox
                      aria-label="Select all on this page"
                      checked={allSelected}
                      onCheckedChange={(checked) => setSelected(checked ? contacts.map((c) => c.id) : [])}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Lists</TableHead>
                  <TableHead>Consent</TableHead>
                  <TableHead className="hidden md:table-cell">Added</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !contacts.length ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-[#888]">Loading contacts…</TableCell></TableRow>
                ) : contacts.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-[#888]">{debounced || listId !== "all" || status !== "all" ? "No contacts match these filters." : "No contacts yet. Import a file or add one manually."}</TableCell></TableRow>
                ) : contacts.map((contact) => (
                  <TableRow key={contact.id} data-state={selected.includes(contact.id) ? "selected" : undefined}>
                    <TableCell className="pl-4">
                      <Checkbox
                        aria-label={`Select ${contactName(contact)}`}
                        checked={selected.includes(contact.id)}
                        onCheckedChange={(checked) => setSelected((current) => checked ? [...current, contact.id] : current.filter((id) => id !== contact.id))}
                      />
                    </TableCell>
                    <TableCell>
                      <button type="button" className="text-left font-medium hover:underline" onClick={() => setDialog({ open: true, contact })}>
                        {`${contact.first_name || ""} ${contact.last_name || ""}`.trim() || <span className="text-[#999]">No name</span>}
                      </button>
                      {contact.company ? <p className="text-xs text-[#888]">{contact.company}</p> : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{contact.phone}</TableCell>
                    <TableCell className="hidden max-w-[200px] truncate text-sm md:table-cell">{contact.email || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {contact.list_ids.slice(0, 3).map((id) => listNames[id] ? <span key={id} className="rounded bg-[#f1f1f1] px-1.5 py-0.5 text-[11px] text-[#555]">{listNames[id]}</span> : null)}
                        {contact.list_ids.length > 3 ? <span className="text-[11px] text-[#888]">+{contact.list_ids.length - 3}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.opt_in
                        ? <span className="text-xs font-medium text-[#107c41]">Opted in</span>
                        : <span className="text-xs font-medium text-[#b42318]" title={contact.opted_out_at ? `Opted out ${formatDate(contact.opted_out_at)}` : undefined}>Opted out</span>}
                    </TableCell>
                    <TableCell className="hidden text-xs text-[#737373] md:table-cell">{formatDate(contact.created_at, { time: false })}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 hover:bg-[#f1f1f1]" aria-label="Contact actions"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDialog({ open: true, contact })}>Edit</DropdownMenuItem>
                          {contact.opt_in
                            ? <DropdownMenuItem onClick={() => rowAction(contact, "optOut")}>Opt out</DropdownMenuItem>
                            : <DropdownMenuItem onClick={() => rowAction(contact, "optIn")}>Opt in</DropdownMenuItem>}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-[#b42318]" onClick={() => rowAction(contact, "delete")}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-[#737373]">
        <span>{total.toLocaleString()} contact{total === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>

      <ContactDialog
        open={dialog.open}
        contact={dialog.contact}
        lists={lists}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        onSaved={() => { load(); onListsChanged(); }}
      />
    </div>
  );
}

export function ListsPanel({ lists, onChanged, onView }) {
  const [name, setName] = useState("");

  async function create(event) {
    event.preventDefault();
    try {
      await api("/api/contact-lists", { method: "POST", body: { name } });
      setName("");
      toast.success("List created");
      onChanged();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function rename(list) {
    const next = window.prompt("Rename list", list.name);
    if (!next || next === list.name) return;
    try {
      await api(`/api/contact-lists/${list.id}`, { method: "PATCH", body: { name: next } });
      onChanged();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function remove(list) {
    if (!window.confirm(`Delete the list "${list.name}"? Contacts stay in your workspace.`)) return;
    try {
      await api(`/api/contact-lists/${list.id}`, { method: "DELETE" });
      toast.success("List deleted");
      onChanged();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New list name, e.g. VIP customers" className="max-w-sm bg-white" />
        <Button disabled={!name.trim()} className="bg-[#1a1a1a] hover:bg-black"><Plus className="size-4" /> Create list</Button>
      </form>
      <Card className="rounded-lg border-[#e6e6e6] py-0 shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">List</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead className="text-right">Opted in</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lists.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-[#888]">No lists yet.</TableCell></TableRow>
              ) : lists.map((list) => (
                <TableRow key={list.id}>
                  <TableCell className="pl-4"><button type="button" className="font-medium hover:underline" onClick={() => onView(list.id)}>{list.name}</button></TableCell>
                  <TableCell className="text-right tabular-nums">{list.member_count.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{list.opted_in_count.toLocaleString()}</TableCell>
                  <TableCell className="hidden text-xs text-[#737373] md:table-cell">{formatDate(list.created_at, { time: false })}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded p-1 hover:bg-[#f1f1f1]" aria-label="List actions"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(list.id)}>View contacts</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => rename(list)}>Rename</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-[#b42318]" onClick={() => remove(list)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
