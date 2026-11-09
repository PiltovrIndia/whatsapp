import crypto from "crypto";
import { query } from "@/lib/server/db";

/** Best-effort audit trail; never fails the calling request. */
export async function audit(session, action, metadata = {}) {
  try {
    await query(
      `INSERT INTO audit_logs (id, organization_id, user_id, action, metadata_json)
       VALUES (:id, :organizationId, :userId, :action, :metadata)`,
      {
        id: crypto.randomUUID(),
        organizationId: session?.organization_id || null,
        userId: session?.user_id || null,
        action,
        metadata: JSON.stringify(metadata),
      }
    );
  } catch (error) {
    console.error("audit log failed", error);
  }
}
