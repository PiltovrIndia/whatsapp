import { NextResponse } from "next/server";
import { withApiKey } from "@/lib/server/api-keys";
import { getApiMessage } from "@/lib/server/api-messages";
import { httpError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** GET /api/v1/messages/{id} — current status of one message. */
export const GET = withApiKey(async (request, { params }, apiSession) => {
  const { id } = await params;
  const message = await getApiMessage(apiSession.organization_id, id);
  if (!message) throw httpError(404, "Message not found.", { code: "not_found" });
  return NextResponse.json(message);
});
