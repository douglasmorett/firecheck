import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    const storesRes = await pool.query("SELECT DISTINCT store FROM users WHERE LOWER(store) LIKE '%baixinho%'");
    console.log("Stores found:", storesRes.rows);
    
    let storeName = storesRes.rows[0]?.store;
    if (!storeName) {
      console.log("No store found with 'baixinho', trying to find users...");
      const userRes = await pool.query("SELECT * FROM users WHERE LOWER(name) LIKE '%baixinho%' OR LOWER(email) LIKE '%baixinho%'");
      console.log("Users:", userRes.rows);
      storeName = userRes.rows[0]?.store;
    }

    if (storeName) {
      console.log("\n--- Checklists for", storeName, "---");
      const { rows: checklists } = await pool.query("SELECT id, title, recurrence, weekdays FROM checklists WHERE store = $1", [storeName]);
      console.table(checklists);

      console.log("\n--- Submissions ---");
      const { rows: subs } = await pool.query("SELECT id, checklist_id, created_at, employee_name FROM checklist_submissions WHERE store = $1 ORDER BY created_at DESC LIMIT 10", [storeName]);
      console.table(subs);

      // We will clear today's submissions or all submissions for the daily checklists so they can do it today.
    }
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
