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
  console.log('Connected to PostgreSQL database!');

  const sql = `
    CREATE TABLE IF NOT EXISTS public.student_breaks (
        id TEXT PRIMARY KEY DEFAULT ('BRK-' || FLOOR(RANDOM() * 900000 + 100000)::TEXT),
        student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
        student_name TEXT NOT NULL,
        seat_number TEXT,
        phone TEXT NOT NULL,
        telegram_chat_id BIGINT,
        break_type TEXT DEFAULT 'restroom',
        duration_minutes INTEGER NOT NULL DEFAULT 15,
        grace_minutes INTEGER NOT NULL DEFAULT 5,
        started_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
        expected_return TIMESTAMPTZ NOT NULL,
        auto_return TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'auto_completed')),
        created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_student_breaks_active ON public.student_breaks(student_id, status);
    CREATE INDEX IF NOT EXISTS idx_student_breaks_status ON public.student_breaks(status);

    ALTER TABLE public.student_breaks ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Allow all on student_breaks" ON public.student_breaks;
    CREATE POLICY "Allow all on student_breaks" ON public.student_breaks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  `;

  await client.query(sql);
  console.log('Successfully created public.student_breaks table with indexes and RLS!');

  try {
    await client.query('ALTER PUBLICATION supabase_realtime ADD TABLE public.student_breaks;');
    console.log('Added student_breaks to realtime replication!');
  } catch (e) {
    console.log('Realtime note:', e.message);
  }

  await client.end();
}

migrate().catch(console.error);
