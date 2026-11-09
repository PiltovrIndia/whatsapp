import { requireSession } from "@/lib/server/auth";
import { campaignSchema } from "@/lib/server/validators";
import { estimateAudience } from "@/lib/server/send-queue";
import { handleApiError, jsonOk } from "@/lib/server/http";

const estimateSchema = campaignSchema.pick({ audience: true });

export async function POST(request) {
  try {
    const session = await requireSession();
    const { audience } = estimateSchema.parse(await request.json());
    return jsonOk(await estimateAudience(audience, session.organization_id));
  } catch (error) {
    return handleApiError(error);
  }
}
