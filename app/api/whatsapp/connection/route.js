import { requireRole, requireSession } from "@/lib/server/auth";
import { disconnectWorkspace } from "@/lib/server/embedded-signup";
import { handleApiError, jsonOk } from "@/lib/server/http";

/** Disconnects the workspace's own number; it falls back to the shared number. */
export async function DELETE() {
  try {
    const session = await requireSession();
    requireRole(session, ["owner"]);
    return jsonOk(await disconnectWorkspace(session));
  } catch (error) {
    return handleApiError(error);
  }
}
