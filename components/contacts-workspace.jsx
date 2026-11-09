"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactImporter } from "@/components/contact-importer";
import { ContactsManager, ListsPanel } from "@/components/contacts-manager";
import { api } from "@/lib/api-client";

export function ContactsWorkspace({ initialTab = "contacts" }) {
  const [tab, setTab] = useState(initialTab);
  const [lists, setLists] = useState([]);
  const [listFilter, setListFilter] = useState("all");

  const loadLists = useCallback(() => {
    api("/api/contact-lists").then((data) => setLists(data.lists)).catch(() => {});
  }, []);

  useEffect(() => { loadLists(); }, [loadLists]);

  function changeTab(next) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs value={tab} onValueChange={changeTab}>
      <TabsList className="mb-5">
        <TabsTrigger value="contacts">All contacts</TabsTrigger>
        <TabsTrigger value="lists">Lists</TabsTrigger>
        <TabsTrigger value="import">Import</TabsTrigger>
      </TabsList>
      <TabsContent value="contacts">
        <ContactsManager lists={lists} onListsChanged={loadLists} initialListId={listFilter} />
      </TabsContent>
      <TabsContent value="lists">
        <ListsPanel lists={lists} onChanged={loadLists} onView={(id) => { setListFilter(id); changeTab("contacts"); }} />
      </TabsContent>
      <TabsContent value="import">
        <ContactImporter onImported={loadLists} />
      </TabsContent>
    </Tabs>
  );
}
