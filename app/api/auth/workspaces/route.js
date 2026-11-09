import { z } from "zod";
import { listWorkspaces, requireSession, switchWorkspace } from "@/lib/server/auth";
import { handleApiError, jsonOk } from "@/lib/server/http";

export async function GET() {
  try {
    const session = await requireSession();
    const workspaces = await listWorkspaces(session.user_id);
    return jsonOk({ workspaces, currentId: session.organization_id });
  } catch (error) {
    return handleApiError(error);
  }
}

const switchSchema = z.object({ organizationId: z.string().min(1) });

export async function POST(request) {
  try {
    const session = await requireSession();
    const { organizationId } = switchSchema.parse(await request.json());
    await switchWorkspace(session, organizationId);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
