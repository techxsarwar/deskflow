const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Error: DATABASE_URL is not set in environment.');
  process.exit(1);
}

async function migrate() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase PostgreSQL!');

  const sql = `
    CREATE TABLE IF NOT EXISTS public.admin_accounts (
        id TEXT PRIMARY KEY DEFAULT ('ADM-' || FLOOR(RANDOM() * 9000 + 1000)::TEXT),
        phone TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        telegram_chat_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'superadmin',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
    );

    ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Allow all on admin_accounts" ON public.admin_accounts;
    CREATE POLICY "Allow all on admin_accounts" ON public.admin_accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    -- Insert default Superadmin Sarwar Altaf Dar
    INSERT INTO public.admin_accounts (phone, name, telegram_chat_id, role, is_active)
    VALUES ('9149847965', 'Sarwar Altaf Dar', '8707444480', 'superadmin', true)
    ON CONFLICT (phone) DO UPDATE
    SET telegram_chat_id = EXCLUDED.telegram_chat_id,
        name = EXCLUDED.name,
        is_active = true;
  `;

  await client.query(sql);
  console.log('Successfully created and seeded admin_accounts table in Supabase!');

  const { rows } = await client.query('SELECT * FROM public.admin_accounts;');
  console.log('Active Admins:', rows);

  await client.end();
}

migrate().catch(console.error);
