import { clearSession } from "@/lib/server/auth";
import { handleApiError, jsonOk } from "@/lib/server/http";

export async function POST() {
  try {
    await clearSession();
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
