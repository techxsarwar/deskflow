const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:aT2iH2xPGENELiPo@db.zjiwelixfwvssgbuldsn.supabase.co:5432/postgres';

async function migrate() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to PostgreSQL!');

  const sql = `
    CREATE TABLE IF NOT EXISTS public.attendance_logs (
        id TEXT PRIMARY KEY DEFAULT ('ATT-' || FLOOR(RANDOM() * 900000 + 100000)::TEXT),
        student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
        student_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        seat_number TEXT,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        check_in_time TIMESTAMPTZ DEFAULT NOW(),
        check_out_time TIMESTAMPTZ,
        duration_minutes INTEGER,
        status TEXT NOT NULL DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'checked_out')),
        created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
    );

    ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Allow all on attendance_logs" ON public.attendance_logs;
    CREATE POLICY "Allow all on attendance_logs" ON public.attendance_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  `;

  await client.query(sql);
  console.log('Successfully created and configured attendance_logs table!');

  try {
    await client.query('ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;');
    console.log('Added to realtime replication!');
  } catch (e) {
    console.log('Realtime replication note:', e.message);
  }

  await client.end();
}

migrate().catch(console.error);
