import { requireSession } from "@/lib/server/auth";
import { cancelCampaign } from "@/lib/server/send-queue";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";

export async function POST(request, { params }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const result = await cancelCampaign(id, session.organization_id);
    if (!result) throw httpError(404, "Campaign not found.");
    if (result !== "cancelled") throw httpError(409, `This campaign is already ${result.replaceAll("_", " ")}.`);
    await audit(session, "campaign.cancel", { jobId: id });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
