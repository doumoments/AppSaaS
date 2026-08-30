// scripts/migrate.ts
// Direct Automated PostgreSQL Schema & RPC Migration Runner for Supabase

import fs from "fs";
import path from "path";
import pg from "pg";

const { Client } = pg;

const regions = [
  "us-west-2",
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "sa-east-1",
  "ca-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1"
];

async function runAllMigrations() {
  const projectRef = "wephfzqyrjdqgrxmwypn";
  const password = "abandoneel2021s";
  const user = `postgres.${projectRef}`;
  const database = "postgres";

  let connectedClient: pg.Client | null = null;

  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
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
      console.log(`✓ Connected to Supabase pooler in ${region}`);
      connectedClient = client;
      break;
    } catch (err: any) {
      // Continue to next region
    }
  }

  if (!connectedClient) {
    console.error("Could not connect to Supabase database.");
    process.exit(1);
  }

  try {
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    console.log(`\nApplying ${migrationFiles.length} migration(s)...`);

    for (const file of migrationFiles) {
      console.log(`\nExecuting migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      await connectedClient.query(sql);
      console.log(`✓ ${file} executed successfully!`);
    }

    // Verify RPC Functions
    const rpcRes = await connectedClient.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      ORDER BY routine_name;
    `);

    console.log("\nActive RPC Functions in Supabase:");
    rpcRes.rows.forEach((r) => console.log(`  ✓ rpc/${r.routine_name}`));

    await connectedClient.end();
  } catch (err: any) {
    console.error("Migration execution error:", err);
    await connectedClient.end();
    process.exit(1);
  }
}

runAllMigrations();
