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
  `;
  await client.query(sql);

  // Insert default Superadmin from environment variables
  const adminPhone = (process.env.ADMIN_PHONE || '9999999999').replace(/[^0-9]/g, '');
  const adminName = process.env.ADMIN_NAME || 'Lead Administrator';
  const adminChatId = (process.env.ADMIN_CHAT_ID || '0000000000').toString();

    const insertSql = `
      INSERT INTO public.admin_accounts (phone, name, telegram_chat_id, role, is_active)
      VALUES ($1, $2, $3, 'superadmin', true)
      ON CONFLICT (phone) DO UPDATE
      SET telegram_chat_id = EXCLUDED.telegram_chat_id,
          name = EXCLUDED.name,
          is_active = true;
    `;
    await client.query(insertSql, [adminPhone, adminName, adminChatId]);
  console.log('Successfully created and seeded admin_accounts table in Supabase!');

  const { rows } = await client.query('SELECT * FROM public.admin_accounts;');
  console.log('Active Admins:', rows);

  await client.end();
}

migrate().catch(console.error);
