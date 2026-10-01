import { useState, useEffect } from 'react'
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  LogOut,
  Sparkles,
  KeyRound,
  Globe,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  getSupabaseConfig,
  setSupabaseConfig,
  clearSupabaseConfig,
} from '@/lib/supabase'
import { supabaseService } from '../lib/supabase-service'
import { useStudyLoungeStore } from '../store/study-lounge-store'

export function SupabaseConnectDialog() {
  const [open, setOpen] = useState(false)
  const isSupabaseConnected = useStudyLoungeStore((s) => s.isSupabaseConnected)
  const isLoadingSupabase = useStudyLoungeStore((s) => s.isLoadingSupabase)
  const lastSyncTime = useStudyLoungeStore((s) => s.lastSyncTime)
  const syncWithSupabase = useStudyLoungeStore((s) => s.syncWithSupabase)

  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success?: boolean
    message?: string
  } | null>(null)

  const config = getSupabaseConfig()

  useEffect(() => {
    if (open) {
      const cfg = getSupabaseConfig()
      setUrl(cfg.url)
      setAnonKey(cfg.anonKey)
      setTestResult(null)
    }
  }, [open])

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanUrl = url.trim()
    const cleanKey = anonKey.trim()

    if (!cleanUrl || !cleanKey) {
      toast.error('Please enter both Supabase URL and Anon Key.')
      return
    }

    if (!cleanUrl.startsWith('https://')) {
      toast.error('Supabase URL must start with https://')
      return
    }

    setIsTesting(true)
    setTestResult(null)

    // Save into localStorage
    setSupabaseConfig(cleanUrl, cleanKey)

    // Test connection
    const res = await supabaseService.testConnection()
    setIsTesting(false)
    setTestResult(res)

    if (res.success) {
      toast.success('Successfully connected to Supabase!')
      await syncWithSupabase()
    } else {
      toast.error(res.message || 'Connection failed.')
    }
  }

  const handleDisconnect = () => {
    clearSupabaseConfig()
    setUrl('')
    setAnonKey('')
    setTestResult(null)
    useStudyLoungeStore.setState({ isSupabaseConnected: false })
    toast.info('Supabase disconnected. Operating on local storage.')
  }

  const handleManualSync = async () => {
    const success = await syncWithSupabase()
    if (success) {
      toast.success('Database synchronized successfully!')
    } else {
      toast.error('Failed to synchronize with Supabase.')
    }
  }

  const handleCopySchema = async () => {
    const schemaText = `-- ==============================================================================
-- Vertical Classes Library - Supabase PostgreSQL Database Schema
-- Run this script in your Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY DEFAULT ('STU-' || LPAD(FLOOR(RANDOM() * 900 + 100)::TEXT, 3, '0')),
    reg_no TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
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

INSERT INTO public.seats (id, seat_number, type, section, status)
SELECT 'SEAT-' || 'D-' || LPAD(s::TEXT, 2, '0'), 'D-' || LPAD(s::TEXT, 2, '0'), 'dedicated', 'Main Silent Hall A', 'available'
FROM generate_series(1, 20) AS s ON CONFLICT (seat_number) DO NOTHING;

INSERT INTO public.seats (id, seat_number, type, section, status)
SELECT 'SEAT-' || 'F-' || LPAD(s::TEXT, 2, '0'), 'F-' || LPAD(s::TEXT, 2, '0'), 'flexible', 'Flexi Open Zone B', 'available'
FROM generate_series(1, 10) AS s ON CONFLICT (seat_number) DO NOTHING;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert to students" ON public.students FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow read students" ON public.students FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow update students" ON public.students FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow delete students" ON public.students FOR DELETE TO anon, authenticated USING (true);
CREATE POLICY "Allow all on fee_transactions" ON public.fee_transactions FOR ALL TO anon, authenticated USING (true);
CREATE POLICY "Allow all on seats" ON public.seats FOR ALL TO anon, authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fee_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.seats;`

    try {
      await navigator.clipboard.writeText(schemaText)
      toast.success('SQL schema copied to clipboard! Paste it into Supabase SQL Editor.')
    } catch {
      toast.info('Schema is also saved at supabase/schema.sql in this project.')
    }
  }

  const isConnected = isSupabaseConnected || (config.isValid && testResult?.success)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className={`h-8 gap-1.5 font-medium text-xs rounded-full border transition-all shrink-0 max-sm:px-2.5 ${
            isConnected
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
          }`}
          title={isConnected ? 'Supabase Connected' : 'Connect Supabase'}
        >
          <Database className='h-3.5 w-3.5 shrink-0' />
          {isConnected ? (
            <>
              <span className='hidden sm:inline-flex items-center gap-1.5'>
                <span className='h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse' />
                Supabase Connected
              </span>
              <span className='sm:hidden h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse' />
            </>
          ) : (
            <>
              <span className='hidden sm:inline-flex items-center gap-1.5'>
                <span className='h-1.5 w-1.5 rounded-full bg-amber-500' />
                Connect Supabase
              </span>
              <span className='sm:hidden h-1.5 w-1.5 rounded-full bg-amber-500' />
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <div className='flex items-center gap-2 text-primary'>
            <Database className='h-5 w-5' />
            <DialogTitle>Supabase Database Integration</DialogTitle>
          </div>
          <DialogDescription>
            Connect Vertical Classes Library to your cloud PostgreSQL database for persistent, real-time records.
          </DialogDescription>
        </DialogHeader>

        {/* Current Status Box */}
        <div
          className={`rounded-xl border p-4 flex items-center justify-between text-xs ${
            isConnected
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-200'
              : 'border-muted bg-muted/30 text-muted-foreground'
          }`}
        >
          <div className='flex items-center gap-2.5'>
            {isConnected ? (
              <CheckCircle2 className='h-5 w-5 text-emerald-600 shrink-0' />
            ) : (
              <AlertCircle className='h-5 w-5 text-amber-500 shrink-0' />
            )}
            <div>
              <p className='font-semibold text-foreground text-sm'>
                {isConnected ? 'Connected to Supabase' : 'Running on Local Storage'}
              </p>
              <p className='text-muted-foreground text-[11px]'>
                {isConnected
                  ? `Live cloud sync active ${lastSyncTime ? `• Last synced at ${lastSyncTime}` : ''}`
                  : 'Data is saved in browser memory. Connect Supabase to sync across devices.'}
              </p>
            </div>
          </div>

          {isConnected && (
            <Button
              variant='outline'
              size='sm'
              onClick={handleManualSync}
              disabled={isLoadingSupabase}
              className='h-7 text-xs gap-1 shrink-0'
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingSupabase ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          )}
        </div>

        {/* Form to enter/update credentials */}
        <form onSubmit={handleTestAndSave} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='supa-url' className='text-xs font-medium flex items-center gap-1.5'>
              <Globe className='h-3.5 w-3.5 text-muted-foreground' />
              Supabase Project URL
            </Label>
            <Input
              id='supa-url'
              placeholder='https://your-project-id.supabase.co'
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className='font-mono text-xs'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='supa-key' className='text-xs font-medium flex items-center gap-1.5'>
              <KeyRound className='h-3.5 w-3.5 text-muted-foreground' />
              Supabase Anon Public API Key
            </Label>
            <Input
              id='supa-key'
              type='password'
              placeholder='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              required
              className='font-mono text-xs'
            />
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className='h-4 w-4 shrink-0 text-emerald-600' />
              ) : (
                <AlertCircle className='h-4 w-4 shrink-0 text-rose-600' />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className='flex gap-2 pt-2'>
            <Button
              type='submit'
              disabled={isTesting}
              className='flex-1 gap-1.5 text-xs'
            >
              {isTesting ? (
                <>
                  <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  Connecting...
                </>
              ) : (
                <>
                  <Sparkles className='h-3.5 w-3.5' />
                  Test & Connect
                </>
              )}
            </Button>

            {config.isValid && (
              <Button
                type='button'
                variant='outline'
                onClick={handleDisconnect}
                className='text-xs gap-1.5 text-rose-600 hover:text-rose-700'
              >
                <LogOut className='h-3.5 w-3.5' />
                Disconnect
              </Button>
            )}
          </div>
        </form>

        {/* Quick Setup Instructions & SQL Copy */}
        <div className='rounded-xl border bg-muted/30 p-3.5 space-y-2.5 text-xs'>
          <div className='flex items-center justify-between'>
            <span className='font-semibold text-foreground flex items-center gap-1.5'>
              <Sparkles className='h-3.5 w-3.5 text-primary' /> How to get your Supabase keys:
            </span>
            <Button
              variant='outline'
              size='sm'
              onClick={handleCopySchema}
              className='h-6 text-[11px] gap-1 px-2'
            >
              <Copy className='h-3 w-3' />
              Copy Schema SQL
            </Button>
          </div>

          <ol className='list-decimal list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed'>
            <li>
              Go to your{' '}
              <a
                href='https://supabase.com/dashboard'
                target='_blank'
                rel='noreferrer'
                className='text-primary underline font-medium inline-flex items-center gap-0.5'
              >
                Supabase Dashboard <ExternalLink className='h-2.5 w-2.5 inline' />
              </a>{' '}
              and select your project.
            </li>
            <li>
              Navigate to <strong>SQL Editor</strong> &rarr; click <strong>New Query</strong>, click the <strong>Copy Schema SQL</strong> button above, paste it and click <strong>Run</strong>.
            </li>
            <li>
              Navigate to <strong>Project Settings &rarr; API</strong>, copy the <strong>Project URL</strong> and <strong>anon public</strong> key, and paste them into the fields above or into your <code>.env</code> file.
            </li>
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  )
}
