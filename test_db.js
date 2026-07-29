import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query("SELECT id, name, email, store, role, phone, whatsapp_phone FROM users");
    console.log('Total users:', res.rows.length);
    const matched = res.rows.filter(u => 
      (u.phone && u.phone.includes('9201')) || 
      (u.whatsapp_phone && u.whatsapp_phone.includes('9201')) ||
      (u.name && (u.name.toLowerCase().includes('leite') || u.name.toLowerCase().includes('mecanica') || u.name.toLowerCase().includes('auto'))) ||
      (u.store && (u.store.toLowerCase().includes('leite') || u.store.toLowerCase().includes('mecanica') || u.store.toLowerCase().includes('auto')))
    );
    console.log('MATCHED USERS:', matched);

    const allLists = await pool.query("SELECT * FROM shopping_lists");
    console.log('Total shopping lists:', allLists.rows.length, allLists.rows);

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

check();
