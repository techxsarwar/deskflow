const { Client } = require('pg');
require('dotenv').config({ path: 'd:\\shadcn-admin\\.env' });
require('dotenv').config({ path: 'd:\\shadcn-admin\\bot\\.env' });

const connectionString = process.env.DATABASE_URL;

async function setupTriggers() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase PostgreSQL!');

  const sql = `
    -- 1. Function: Cascading sync when student details (name, phone, seat) update
    CREATE OR REPLACE FUNCTION public.sync_student_details_cascade()
    RETURNS TRIGGER AS $$
    BEGIN
        -- If full_name changed, cascade to seats, fee_transactions, and attendance_logs
        IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
            UPDATE public.seats
            SET current_student_name = NEW.full_name
            WHERE current_student_id = NEW.id;

            UPDATE public.fee_transactions
            SET student_name = NEW.full_name
            WHERE student_id = NEW.id;

            UPDATE public.attendance_logs
            SET student_name = NEW.full_name
            WHERE student_id = NEW.id;
        END IF;

        -- If phone changed, cascade to attendance_logs
        IF NEW.phone IS DISTINCT FROM OLD.phone THEN
            UPDATE public.attendance_logs
            SET phone = NEW.phone
            WHERE student_id = NEW.id;
        END IF;

        -- If seat_number changed, synchronize seat allocation
        IF NEW.seat_number IS DISTINCT FROM OLD.seat_number THEN
            -- Free previous seat if assigned
            IF OLD.seat_number IS NOT NULL AND OLD.seat_number != 'Unassigned' THEN
                UPDATE public.seats
                SET status = 'available', current_student_id = NULL, current_student_name = NULL, shift = NULL
                WHERE seat_number = OLD.seat_number AND current_student_id = NEW.id;
            END IF;

            -- Assign new seat
            IF NEW.seat_number IS NOT NULL AND NEW.seat_number != 'Unassigned' THEN
                UPDATE public.seats
                SET status = 'occupied', current_student_id = NEW.id, current_student_name = NEW.full_name, shift = NEW.shift
                WHERE seat_number = NEW.seat_number;
            END IF;
        END IF;

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_student_details ON public.students;
    CREATE TRIGGER trg_sync_student_details
    AFTER UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_student_details_cascade();

    -- 2. Function: Auto-assign seat on student INSERT
    CREATE OR REPLACE FUNCTION public.on_student_insert_assign_seat()
    RETURNS TRIGGER AS $$
    BEGIN
        IF NEW.seat_number IS NOT NULL AND NEW.seat_number != 'Unassigned' THEN
            UPDATE public.seats
            SET status = 'occupied', current_student_id = NEW.id, current_student_name = NEW.full_name, shift = NEW.shift
            WHERE seat_number = NEW.seat_number;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_student_insert_seat ON public.students;
    CREATE TRIGGER trg_student_insert_seat
    AFTER INSERT ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.on_student_insert_assign_seat();

    -- 3. Function: Auto-free seat on student DELETE
    CREATE OR REPLACE FUNCTION public.on_student_delete_free_seat()
    RETURNS TRIGGER AS $$
    BEGIN
        UPDATE public.seats
        SET status = 'available', current_student_id = NULL, current_student_name = NULL, shift = NULL
        WHERE current_student_id = OLD.id;
        RETURN OLD;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_student_delete ON public.students;
    CREATE TRIGGER trg_student_delete
    AFTER DELETE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.on_student_delete_free_seat();
  `;

  await client.query(sql);
  console.log('🎉 Successfully created all database data-integrity triggers!');

  // Verify triggers
  const trigRes = await client.query(`
    SELECT trigger_name, event_manipulation, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'students';
  `);
  console.log('\nActive Triggers on students table:');
  trigRes.rows.forEach(t => console.log(`  - ${t.trigger_name} [${t.event_manipulation} ON ${t.event_object_table}]`));

  await client.end();
}

setupTriggers().catch(console.error);
