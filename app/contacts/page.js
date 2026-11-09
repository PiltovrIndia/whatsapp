import { AppShell } from "@/components/app-shell";
import { ContactsWorkspace } from "@/components/contacts-workspace";

export default async function ContactsPage({ searchParams }) {
  const { tab } = await searchParams;
  const initialTab = ["contacts", "lists", "import"].includes(tab) ? tab : "contacts";
  return (
    <AppShell title="Contacts" eyebrow="Customer data">
      <ContactsWorkspace initialTab={initialTab} />
    </AppShell>
  );
}
