import { getCurrentSession, publicSession } from "@/lib/server/auth";
import { handleApiError, jsonOk } from "@/lib/server/http";

export async function GET() {
  try {
    const session = await getCurrentSession();
    return jsonOk({ user: publicSession(session) });
  } catch (error) {
    return handleApiError(error);
  }
}
