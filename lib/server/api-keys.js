import crypto from "crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { query } from "@/lib/server/db";
import { httpError } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { apiKeyPrefix, generateApiKey, hashApiKey, looksLikeApiKey } from "@/lib/api-utils";

const RATE_LIMIT_PER_MINUTE = Number(process.env.API_RATE_LIMIT_PER_MINUTE || 600);

/** Creates a key and returns the plaintext once; only its hash is stored. */
export async function createApiKey(session, name) {
  const key = generateApiKey();
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO api_keys (id, organization_id, name, key_prefix, key_hash, created_by)
     VALUES (:id, :organizationId, :name, :prefix, :hash, :createdBy)`,
    {
      id,
      organizationId: session.organization_id,
      name,
      prefix: apiKeyPrefix(key),
      hash: hashApiKey(key),
      createdBy: session.user_id,
    }
  );
  return { id, key, prefix: apiKeyPrefix(key) };
}

export async function listApiKeys(organizationId) {
  return query(
    `SELECT k.id, k.name, k.key_prefix, k.last_used_at, k.revoked_at, k.created_at, u.full_name AS created_by_name
     FROM api_keys k LEFT JOIN users u ON u.id = k.created_by
     WHERE k.organization_id = :organizationId
     ORDER BY k.revoked_at IS NULL DESC, k.created_at DESC`,
    { organizationId }
  );
}

export async function revokeApiKey(organizationId, id) {
  const result = await query(
    "UPDATE api_keys SET revoked_at = UTC_TIMESTAMP() WHERE id = :id AND organization_id = :organizationId AND revoked_at IS NULL",
    { id, organizationId }
  );
  return result.affectedRows > 0;
}

/** Resolves `Authorization: Bearer pk_live_…` to an API session, or throws 401. */
export async function authenticateApiKey(request) {
  const header = request.headers.get("authorization") || "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!looksLikeApiKey(key)) {
    throw httpError(401, "Missing or malformed API key. Send it as 'Authorization: Bearer pk_live_…'.", { code: "unauthorized" });
  }

  const [row] = await query(
    `SELECT id, organization_id, created_by, last_used_at
     FROM api_keys WHERE key_hash = :hash AND revoked_at IS NULL LIMIT 1`,
    { hash: hashApiKey(key) }
  );
  if (!row) throw httpError(401, "This API key is invalid or has been revoked.", { code: "unauthorized" });

  if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > 60_000) {
    await query("UPDATE api_keys SET last_used_at = UTC_TIMESTAMP() WHERE id = :id", { id: row.id });
  }

  return { organization_id: row.organization_id, user_id: row.created_by, api_key_id: row.id };
}

const DEFAULT_CODES = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  422: "invalid_request",
  429: "rate_limited",
  502: "upstream_error",
  503: "unavailable",
};

export function apiErrorResponse(error) {
  if (error instanceof ZodError) {
    const issue = error.issues?.[0];
    const path = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    return NextResponse.json({ error: { code: "invalid_request", message: `${path}${issue?.message || "Invalid request."}` } }, { status: 422 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: { code: "invalid_json", message: "The request body must be valid JSON." } }, { status: 400 });
  }
  if (error?.status) {
    const body = { error: { code: error.meta?.code || DEFAULT_CODES[error.status] || "error", message: error.message } };
    if (error.meta?.results) body.messages = error.meta.results;
    return NextResponse.json(body, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: { code: "internal_error", message: "Unexpected server error." } }, { status: 500 });
}

/** Wraps a /api/v1 handler with API-key auth, per-key rate limiting and JSON errors. */
export function withApiKey(handler) {
  return async (request, context) => {
    try {
      const apiSession = await authenticateApiKey(request);
      await enforceRateLimit(`api:${apiSession.api_key_id}`, {
        limit: RATE_LIMIT_PER_MINUTE,
        windowSeconds: 60,
        message: `Rate limit exceeded (${RATE_LIMIT_PER_MINUTE} requests per minute per key).`,
      }).catch((error) => {
        if (error.status === 429) error.meta = { code: "rate_limited" };
        throw error;
      });
      return await handler(request, context, apiSession);
    } catch (error) {
      return apiErrorResponse(error);
    }
  };
}
