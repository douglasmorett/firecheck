import pg from 'pg';
const { Pool } = pg;
const p = new Pool({connectionString: 'postgresql://neondb_owner:npg_YymnUpK7OED8@ep-green-fog-anfbkql2-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require', ssl: {rejectUnauthorized: false}}); 

async function run() {
  await p.query(`
    INSERT INTO users (name, email, password, role, store, status, plan, expiration_date) 
    VALUES ('Funcionario Demo', 'demo@firecheck.com', 'demo123', 'employee', 'Duga Burguer', 'active', 'mensal', NOW() + INTERVAL '30 days') 
    ON CONFLICT (email) DO UPDATE SET password='demo123'
  `);
  
  await p.query(`
    INSERT INTO checklists (store, title, tasks, created_at)
    VALUES (
      'Duga Burguer', 
      'Auditoria de Fechamento', 
      '[{"id": "1", "title": "Pia Limpa", "requiresPhoto": true, "assignee": "Equipe Toda"}, {"id": "2", "title": "Chapa Desligada", "requiresPhoto": true, "assignee": "Equipe Toda"}]', 
      NOW()
    )
  `);
  console.log('Demo user and checklist created.');
  p.end();
}
run().catch(console.error);
