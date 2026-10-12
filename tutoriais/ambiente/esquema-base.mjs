// As tabelas que o api/index.js do FireCheck PRESSUPÕE: ele só acrescenta
// colunas nelas (ALTER TABLE ... ADD COLUMN IF NOT EXISTS) e cria as demais no
// boot. Num banco vazio, sem estas, o boot para no primeiro ALTER.
//
// shopping_lists entra aqui porque o boot faz um UPDATE nela ANTES do CREATE
// (em produção a tabela já existe, então lá não aparece).
export const ESQUEMA_BASE = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT,
    store TEXT,
    plan TEXT,
    phone TEXT,
    expiration_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS checklists (
    id SERIAL PRIMARY KEY,
    store TEXT,
    title TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS checklist_submissions (
    id SERIAL PRIMARY KEY,
    employee_name TEXT,
    store TEXT,
    tasks TEXT,
    feedback_info TEXT,
    selfie TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS shopping_lists (
    id SERIAL PRIMARY KEY,
    store VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    recurrence VARCHAR(50) DEFAULT 'weekly',
    weekdays TEXT,
    scheduled_date TEXT,
    assigned_to TEXT,
    category VARCHAR(100) DEFAULT 'compras',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
  );
`;
