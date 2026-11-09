import crypto from "crypto";
import { cookies } from "next/headers";
import { query, withTransaction } from "@/lib/server/db";
import { sha256 } from "@/lib/server/crypto";

export const SESSION_COOKIE = "wm_session";
const SESSION_DAYS = 14;

function newId() {
  return crypto.randomUUID();
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [scheme, salt, hash] = String(storedHash).split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;

  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  );
}

export async function createSession(userId, organizationId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const sessionId = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO sessions (id, user_id, organization_id, expires_at)
     VALUES (:id, :userId, :organizationId, :expiresAt)`,
    { id: sessionId, userId, organizationId, expiresAt }
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await query("DELETE FROM sessions WHERE id = :id", { id: sha256(token) });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await query(
    `SELECT
       s.id AS session_id,
       s.organization_id,
       u.id AS user_id,
       u.email,
       u.full_name,
       o.name AS organization_name,
       m.role
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     INNER JOIN organizations o ON o.id = s.organization_id
     INNER JOIN memberships m
       ON m.user_id = u.id AND m.organization_id = o.id
     WHERE s.id = :sessionId AND s.expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    { sessionId: sha256(token) }
  );

  return rows[0] || null;
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }

  return session;
}

export async function registerUser({ email, password, fullName, organizationName }) {
  const userId = newId();
  const organizationId = newId();
  const passwordHash = hashPassword(password);

  await withTransaction(async (connection) => {
    await connection.execute(
      `INSERT INTO users (id, email, password_hash, full_name)
       VALUES (:id, :email, :passwordHash, :fullName)`,
      { id: userId, email: email.toLowerCase(), passwordHash, fullName }
    );

    await connection.execute(
      `INSERT INTO organizations (id, name)
       VALUES (:id, :name)`,
      { id: organizationId, name: organizationName }
    );

    await connection.execute(
      `INSERT INTO memberships (id, user_id, organization_id, role)
       VALUES (:id, :userId, :organizationId, 'owner')`,
      { id: newId(), userId, organizationId }
    );

    await connection.execute(
      `INSERT INTO contact_lists (id, organization_id, name)
       VALUES (:id, :organizationId, 'All Contacts')`,
      { id: newId(), organizationId }
    );
  });

  await createSession(userId, organizationId);
  return { userId, organizationId };
}

export function requireRole(session, roles) {
  if (!roles.includes(session.role)) {
    const error = new Error("You do not have permission to perform this action.");
    error.status = 403;
    throw error;
  }
}

export async function listWorkspaces(userId) {
  return query(
    `SELECT o.id, o.name, m.role
     FROM memberships m
     INNER JOIN organizations o ON o.id = m.organization_id
     WHERE m.user_id = :userId
     ORDER BY o.name ASC`,
    { userId }
  );
}

export async function switchWorkspace(session, organizationId) {
  const [membership] = await query(
    `SELECT organization_id FROM memberships
     WHERE user_id = :userId AND organization_id = :organizationId
     LIMIT 1`,
    { userId: session.user_id, organizationId }
  );
  if (!membership) {
    const error = new Error("Workspace not found.");
    error.status = 404;
    throw error;
  }

  await query(
    "UPDATE sessions SET organization_id = :organizationId WHERE id = :sessionId",
    { organizationId, sessionId: session.session_id }
  );
}

export async function purgeExpiredSessions() {
  await query("DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP() LIMIT 1000");
}

export function publicSession(session) {
  if (!session) return null;
  const { session_id, ...rest } = session;
  return rest;
}
