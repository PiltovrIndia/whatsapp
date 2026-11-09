import crypto from "crypto";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

const required = ["DB_HOST", "DB_USER", "DB_NAME"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  console.error("Run with `npm run db:migrate` so .env.local is loaded.");
  process.exit(1);
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS || "",
  database: process.env.DB_NAME || process.env.MYSQL_DB,
  multipleStatements: true,
  timezone: "Z",
});

await connection.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`);

const [appliedRows] = await connection.query("SELECT name, checksum FROM schema_migrations");
const applied = new Map(appliedRows.map((row) => [row.name, row.checksum]));

const migrationsDir = path.join(process.cwd(), "database", "migrations");
const files = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

let ran = 0;
try {
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");

    if (applied.has(file)) {
      if (applied.get(file) !== checksum) {
        console.warn(`! ${file} changed after it was applied. Create a new migration instead of editing it.`);
      }
      continue;
    }

    console.log(`Applying ${file}`);
    await connection.query(sql);
    await connection.query(
      "INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)",
      [file, checksum]
    );
    ran += 1;
  }
} catch (error) {
  console.error(`Migration failed: ${error.message}`);
  console.error("MySQL DDL is not transactional; inspect the schema before re-running.");
  await connection.end();
  process.exit(1);
}

await connection.end();
console.log(ran ? `Applied ${ran} migration(s).` : "Database is up to date.");
