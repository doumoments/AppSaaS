// scripts/migrate.ts
import fs from "fs";
import path from "path";
import pg from "pg";

const { Client } = pg;

const regions = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "sa-east-1",
  "ca-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-central-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-south-1"
];

async function runMigration() {
  const projectRef = "wephfzqyrjdqgrxmwypn";
  const password = "abandoneel2021s";
  const user = `postgres.${projectRef}`;
  const database = "postgres";

  let connectedClient: pg.Client | null = null;

  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    console.log(`Checking region pooler: ${host}...`);

    try {
      const client = new Client({
        user,
        password,
        host,
        port: 6543,
        database,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 3500,
      });

      await client.connect();
      console.log(`\n🎉 SUCCESS! Connected to pooler region: ${region}`);
      connectedClient = client;
      break;
    } catch (err: any) {
      // Ignore not found errors and try next region
    }
  }

  if (!connectedClient) {
    console.error("Could not find matching pooler region automatically.");
    process.exit(1);
  }

  try {
    const migrationSqlPath = path.join(process.cwd(), "supabase", "migrations", "001_initial_schema.sql");
    const sql = fs.readFileSync(migrationSqlPath, "utf8");

    console.log("Applying 001_initial_schema.sql to Supabase PostgreSQL database...");
    await connectedClient.query(sql);
    console.log("✓ SQL migration successfully applied to Supabase!");

    const res = await connectedClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log("\nTables now active in Supabase public schema:");
    res.rows.forEach((row) => console.log(`  ✓ ${row.table_name}`));

    await connectedClient.end();
  } catch (err: any) {
    console.error("Migration execution error:", err);
    await connectedClient.end();
    process.exit(1);
  }
}

runMigration();
