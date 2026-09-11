import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ensureSchema, seedCatalogue } from "../lib/seed-db";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  await ensureSchema(db);
  await seedCatalogue(db);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
