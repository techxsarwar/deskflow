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
    CREATE TABLE IF NOT EXISTS public.library_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        description TEXT,
        updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
    );

    ALTER TABLE public.library_settings ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Allow all on library_settings" ON public.library_settings;
    CREATE POLICY "Allow all on library_settings" ON public.library_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    -- Insert default Geofence Settings
    INSERT INTO public.library_settings (key, value, description)
    VALUES (
      'geofence',
      jsonb_build_object(
        'latitude', 33.617014,
        'longitude', 74.924696,
        'radius_meters', 75,
        'enabled', true,
        'name', 'Vertical Classes Library'
      ),
      'GPS Geofencing configuration for attendance check-in and check-out'
    )
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = NOW();

    -- Also check attendance_logs columns for latitude, longitude, distance_meters
    ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
    ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
    ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS distance_meters INTEGER;
    ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS check_out_latitude DOUBLE PRECISION;
    ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS check_out_longitude DOUBLE PRECISION;
    ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS check_out_distance_meters INTEGER;
  `;

  await client.query(sql);
  console.log('Successfully created library_settings and updated attendance_logs!');

  const { rows } = await client.query("SELECT * FROM public.library_settings WHERE key = 'geofence';");
  console.log('Geofence Settings:', rows);

  await client.end();
}

migrate().catch(console.error);
