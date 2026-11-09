import { AppShell } from "@/components/app-shell";
import { CampaignBuilder } from "@/components/campaign-builder";

export default async function SendPage({ searchParams }) {
  const { template } = await searchParams;
  return (
    <AppShell title="New campaign" eyebrow="Campaigns">
      <CampaignBuilder initialTemplateId={typeof template === "string" ? template : ""} />
    </AppShell>
  );
}
