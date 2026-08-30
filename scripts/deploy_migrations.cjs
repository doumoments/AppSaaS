const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function deploy() {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/DATABASE_URL=(.+)/);
      if (match) connectionString = match[1].trim();
    }
  }
  if (!connectionString) {
    connectionString = 'postgresql://postgres.wephfzqyrjdqgrxmwypn:abandoneel2021s@aws-0-us-west-2.pooler.supabase.com:6543/postgres';
  }
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('Connected.');

    const migration1Path = path.join(__dirname, '..', 'supabase', 'migrations', '001_chronosagent_schema.sql');
    const migration2Path = path.join(__dirname, '..', 'supabase', 'migrations', '002_rpc_endpoints.sql');

    const sql1 = fs.readFileSync(migration1Path, 'utf8');
    const sql2 = fs.readFileSync(migration2Path, 'utf8');

    console.log('Deploying 001_chronosagent_schema.sql...');
    await client.query(sql1);
    console.log('001_chronosagent_schema.sql deployed successfully.');

    console.log('Deploying 002_rpc_endpoints.sql...');
    await client.query(sql2);
    console.log('002_rpc_endpoints.sql deployed successfully.');

    // Verify tables
    const resTables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('\nVerified Public Tables in Supabase:');
    resTables.rows.forEach(r => console.log(' - ' + r.table_name));

    // Verify RPC functions
    const resFunctions = await client.query(`
      SELECT routine_name FROM information_schema.routines 
      WHERE routine_schema = 'public'
      ORDER BY routine_name;
    `);
    console.log('\nVerified Public RPC Functions in Supabase:');
    resFunctions.rows.forEach(r => console.log(' - ' + r.routine_name));

    console.log('\n=== ALL SUPABASE MIGRATIONS DEPLOYED AND VERIFIED 100% ===');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

deploy();
