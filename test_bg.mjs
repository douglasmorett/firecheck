import fetch from 'node-fetch';

async function testBackground() {
  console.log("Fetching submissions to find one that was ignored...");
  try {
    const pool = new (await import('pg')).default.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const { rows } = await pool.query("SELECT id, tasks, feedback_info, retry_count FROM checklist_submissions ORDER BY id DESC LIMIT 5");
    
    for (const sub of rows) {
      console.log(`Sub ${sub.id}: Retry=${sub.retry_count}, feedback=${sub.feedback_info}`);
    }

    if (rows.length > 0) {
      const targetId = rows[0].id;
      console.log(`\nCalling /api/process-audit-background for sub ${targetId}...`);
      
      const response = await fetch('https://firecheck-one.vercel.app/api/process-audit-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: targetId })
      });
      
      const result = await response.text();
      console.log(`Response status: ${response.status}`);
      console.log(`Response body: ${result}`);
    }
    
    pool.end();
  } catch (err) {
    console.error(err);
  }
}

testBackground();
