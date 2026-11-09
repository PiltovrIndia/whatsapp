import mysql from "mysql2/promise";

const globalForDb = globalThis;

export function hasDatabaseConfig() {
  return Boolean(
    process.env.DB_HOST &&
      process.env.DB_USER &&
      process.env.DB_NAME
  );
}

export function getPool() {
  if (!hasDatabaseConfig()) {
    throw new Error(
      "MySQL is not configured. Set DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME."
    );
  }

  // Reuse the pool across hot reloads in development.
  if (!globalForDb.__engageDbPool) {
    globalForDb.__engageDbPool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || process.env.DB_PASS || "",
      database: process.env.DB_NAME || process.env.MYSQL_DB,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
      namedPlaceholders: true,
      timezone: "Z",
      dateStrings: false,
    });
  }

  return globalForDb.__engageDbPool;
}

/**
 * Runs a query with named placeholders (`:name`). Uses the text protocol so
 * array values expand correctly inside `IN (:ids)` and bulk `VALUES :rows`.
 */
export async function query(sql, params = {}) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

export async function withTransaction(work) {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Clamp an untrusted integer (e.g. page size) so it is safe to inline in SQL. */
export function safeInt(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = min } = {}) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

/** JSON columns come back parsed from MySQL 8 but as strings from MariaDB; accept both. */
export function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
