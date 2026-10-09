const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const connectionString = process.env.DATABASE_URL;

async function migrate() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase PostgreSQL!');

  try {
    await client.query('BEGIN;');

    console.log('1. Vacating seat for duplicate pending registration STU-004-3422...');
    await client.query(`
      UPDATE public.seats 
      SET status = 'available', current_student_id = null, current_student_name = null, shift = null
      WHERE current_student_id = 'STU-004-3422';
    `);

    console.log('2. Removing duplicate pending student STU-004-3422...');
    await client.query(`DELETE FROM public.students WHERE id = 'STU-004-3422';`);

    console.log('3. Cleaning and normalizing all student phone numbers...');
    await client.query(`
      UPDATE public.students 
      SET phone = REGEXP_REPLACE(phone, '\\D', '', 'g');
    `);
    await client.query(`
      UPDATE public.students
      SET phone = SUBSTRING(phone FROM 3)
      WHERE LENGTH(phone) = 12 AND phone LIKE '91%';
    `);

    console.log('4. Dropping old primary key on students(id)...');
    await client.query(`ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_pkey CASCADE;`);

    console.log('5. Ensuring id remains UNIQUE NOT NULL...');
    await client.query(`ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_id_unique;`);
    await client.query(`ALTER TABLE public.students ADD CONSTRAINT students_id_unique UNIQUE (id);`);

    console.log('6. SETTING PRIMARY KEY TO PHONE NUMBER ON public.students...');
    await client.query(`ALTER TABLE public.students ADD CONSTRAINT students_pkey PRIMARY KEY (phone);`);

    console.log('7. Restoring foreign key constraints on dependent tables...');
    await client.query(`
      ALTER TABLE public.fee_transactions 
      DROP CONSTRAINT IF EXISTS fee_transactions_student_id_fkey;
      ALTER TABLE public.fee_transactions 
      ADD CONSTRAINT fee_transactions_student_id_fkey 
      FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
    `);

    await client.query(`
      ALTER TABLE public.seats 
      DROP CONSTRAINT IF EXISTS seats_current_student_id_fkey;
      ALTER TABLE public.seats 
      ADD CONSTRAINT seats_current_student_id_fkey 
      FOREIGN KEY (current_student_id) REFERENCES public.students(id) ON DELETE SET NULL;
    `);

    await client.query(`
      ALTER TABLE public.attendance_logs 
      DROP CONSTRAINT IF EXISTS attendance_logs_student_id_fkey;
      ALTER TABLE public.attendance_logs 
      ADD CONSTRAINT attendance_logs_student_id_fkey 
      FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
    `);

    await client.query('COMMIT;');
    console.log('🎉 MIGRATION SUCCESSFUL: PRIMARY KEY is now set to PHONE NUMBER!');

    // Verification
    const conRes = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'public.students'::regclass;
    `);
    console.log('\nUpdated Students Constraints:');
    conRes.rows.forEach(r => console.log(`  - ${r.conname} [${r.contype}]: ${r.def}`));

    const countRes = await client.query(`SELECT count(*) FROM public.students;`);
    console.log('\nRemaining Unique Students in DB:', countRes.rows[0].count);

    const students = await client.query(`SELECT id, reg_no, full_name, phone, seat_number, status FROM public.students;`);
    console.log('\nAll Students now in DB:');
    students.rows.forEach(s => console.log(`  🔑 PK Phone: ${s.phone} | ID: ${s.id} | ${s.full_name} | Desk: ${s.seat_number} | Status: ${s.status}`));

    const desk2 = await client.query(`SELECT seat_number, status, current_student_id, current_student_name FROM public.seats WHERE seat_number = 'Black Hall - Desk 2';`);
    console.log('\nBlack Hall - Desk 2 Status:', desk2.rows[0]);

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Migration failed and rolled back:', err);
  } finally {
    await client.end();
  }
}

migrate();
