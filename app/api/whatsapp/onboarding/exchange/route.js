import { requireRole, requireSession } from "@/lib/server/auth";
import { onboardingExchangeSchema } from "@/lib/server/validators";
import { connectWorkspace } from "@/lib/server/embedded-signup";
import { handleApiError, jsonOk } from "@/lib/server/http";

/** Finishes Embedded Signup with the code and ids the Meta popup returned. */
export async function POST(request) {
  try {
    const session = await requireSession();
    requireRole(session, ["owner", "admin"]);
    const payload = onboardingExchangeSchema.parse(await request.json());
    const result = await connectWorkspace(session, payload);
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}
