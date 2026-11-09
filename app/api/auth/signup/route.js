import { signupSchema } from "@/lib/server/validators";
import { registerUser } from "@/lib/server/auth";
import { clientIp, handleApiError, jsonError, jsonOk } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export async function POST(request) {
  try {
    const payload = signupSchema.parse(await request.json());
    await enforceRateLimit(`signup:ip:${clientIp(request)}`, { limit: 10, windowSeconds: 60 * 60 });
    const result = await registerUser(payload);
    return jsonOk({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return jsonError("An account with this email already exists. Sign in instead.", 409);
    }
    return handleApiError(error);
  }
}
