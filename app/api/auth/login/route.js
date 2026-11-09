import { loginSchema } from "@/lib/server/validators";
import { createSession, purgeExpiredSessions, verifyPassword } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { clientIp, handleApiError, jsonError, jsonOk } from "@/lib/server/http";
import { enforceRateLimit, resetRateLimit } from "@/lib/server/rate-limit";
import { audit } from "@/lib/server/audit";

export async function POST(request) {
  try {
    const { email, password } = loginSchema.parse(await request.json());
    const normalizedEmail = email.toLowerCase();
    const ip = clientIp(request);
    const emailBucket = `login:email:${normalizedEmail}`;

    await enforceRateLimit(`login:ip:${ip}`, { limit: 50, windowSeconds: 15 * 60 });
    await enforceRateLimit(emailBucket, {
      limit: 10,
      windowSeconds: 15 * 60,
      message: "Too many sign-in attempts for this account. Try again in 15 minutes.",
    });

    const users = await query(
      `SELECT
         u.id,
         u.email,
         u.password_hash,
         m.organization_id
       FROM users u
       INNER JOIN memberships m ON m.user_id = u.id
       WHERE u.email = :email
       ORDER BY FIELD(m.role, 'owner', 'admin', 'member'), m.created_at ASC
       LIMIT 1`,
      { email: normalizedEmail }
    );

    const user = users[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return jsonError("Invalid email or password.", 401);
    }

    await resetRateLimit(emailBucket);
    await createSession(user.id, user.organization_id);
    await audit({ organization_id: user.organization_id, user_id: user.id }, "auth.login", { ip });
    purgeExpiredSessions().catch(() => {});
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
