-- ==============================================================================
-- Vertical Classes Library - Supabase PostgreSQL Database Schema
-- Run this script in your Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Students Table
CREATE TABLE IF NOT EXISTS public.students (
    phone TEXT PRIMARY KEY,
    id TEXT UNIQUE NOT NULL DEFAULT ('STU-' || LPAD(FLOOR(RANDOM() * 900 + 100)::TEXT, 3, '0')),
    reg_no TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    emergency_contact TEXT,
    address TEXT,
    study_goal TEXT,
    shift TEXT NOT NULL DEFAULT 'fullday' CHECK (shift IN ('morning', 'afternoon', 'evening', 'night', 'fullday')),
    seat_type TEXT NOT NULL DEFAULT 'dedicated' CHECK (seat_type IN ('dedicated', 'flexible')),
    seat_number TEXT DEFAULT 'Unassigned',
    locker_number TEXT,
    membership_plan TEXT NOT NULL DEFAULT 'monthly' CHECK (membership_plan IN ('daily_pass', 'monthly', 'quarterly', 'half_yearly', 'yearly')),
    plan_amount INTEGER NOT NULL DEFAULT 1000,
    amount_paid INTEGER NOT NULL DEFAULT 0,
    amount_due INTEGER NOT NULL DEFAULT 1000,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid', 'partial', 'pending', 'overdue')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'expired', 'inactive')),
    registered_via TEXT NOT NULL DEFAULT 'online_link' CHECK (registered_via IN ('online_link', 'admin_desk')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    notes TEXT
);

-- 3. Fee Transactions Table
CREATE TABLE IF NOT EXISTS public.fee_transactions (
    id TEXT PRIMARY KEY DEFAULT ('TXN-' || FLOOR(RANDOM() * 900000 + 100000)::TEXT),
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    reg_no TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_mode TEXT NOT NULL DEFAULT 'upi' CHECK (payment_mode IN ('upi', 'cash', 'card', 'bank_transfer')),
    receipt_number TEXT UNIQUE NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- 4. Seats Table (30 Desks: 20 Dedicated, 10 Flexible - No Cabins)
CREATE TABLE IF NOT EXISTS public.seats (
    id TEXT PRIMARY KEY,
    seat_number TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'dedicated' CHECK (type IN ('dedicated', 'flexible')),
    section TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance')),
    current_student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
    current_student_name TEXT,
    shift TEXT
);

-- 5. Seed Initial 30 Clean Vacant Seats (20 Dedicated, 10 Flexible)
INSERT INTO public.seats (id, seat_number, type, section, status)
SELECT 
    'SEAT-' || 'D-' || LPAD(s::TEXT, 2, '0'),
    'D-' || LPAD(s::TEXT, 2, '0'),
    'dedicated',
    'Main Silent Hall A',
    'available'
FROM generate_series(1, 20) AS s
ON CONFLICT (seat_number) DO NOTHING;

INSERT INTO public.seats (id, seat_number, type, section, status)
SELECT 
    'SEAT-' || 'F-' || LPAD(s::TEXT, 2, '0'),
    'F-' || LPAD(s::TEXT, 2, '0'),
    'flexible',
    'Flexi Open Zone B',
    'available'
FROM generate_series(1, 10) AS s
ON CONFLICT (seat_number) DO NOTHING;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
-- Allow public / anon users to submit registration form:
CREATE POLICY "Allow public insert to students" 
ON public.students FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- Allow reading students:
CREATE POLICY "Allow read students" 
ON public.students FOR SELECT 
TO anon, authenticated 
USING (true);

-- Allow updating students:
CREATE POLICY "Allow update students" 
ON public.students FOR UPDATE 
TO anon, authenticated 
USING (true);

-- Allow deleting students:
CREATE POLICY "Allow delete students" 
ON public.students FOR DELETE 
TO anon, authenticated 
USING (true);

-- Allow all operations for fee transactions:
CREATE POLICY "Allow all on fee_transactions" 
ON public.fee_transactions FOR ALL 
TO anon, authenticated 
USING (true);

-- Allow all operations for seats:
CREATE POLICY "Allow all on seats" 
ON public.seats FOR ALL 
TO anon, authenticated 
USING (true);

-- 8. Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fee_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.seats;

