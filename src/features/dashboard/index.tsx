import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Armchair,
  CheckCircle2,
  GraduationCap,
  IndianRupee,
  Share2,
  UserPlus,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useStudyLoungeStore } from '@/features/study-lounge/store/study-lounge-store'
import { SHIFT_DETAILS } from '@/features/study-lounge/data/mock-data'
import { ShareLinkDialog } from '@/features/study-lounge/components/share-link-dialog'
import { StudentFormDialog } from '@/features/study-lounge/components/student-form-dialog'
import { SupabaseConnectDialog } from '@/features/study-lounge/components/supabase-connect-dialog'

export function Dashboard() {
  const navigate = useNavigate()
  const students = useStudyLoungeStore((s) => s.students)
  const seats = useStudyLoungeStore((s) => s.seats)
  const transactions = useStudyLoungeStore((s) => s.transactions)

  const [shareLinkOpen, setShareLinkOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  // Calculations
  const activeStudents = students.filter((s) => s.status === 'active')
  const pendingStudents = students.filter((s) => s.status === 'pending')
  const totalRevenue = transactions.reduce((acc, t) => acc + t.amount, 0)
  const totalDues = students.reduce((acc, s) => acc + s.amountDue, 0)

  const totalSeats = seats.length
  const occupiedSeats = seats.filter((s) => s.status === 'occupied').length
  const availableSeats = totalSeats - occupiedSeats
  const occupancyPercentage = Math.round((occupiedSeats / totalSeats) * 100)

  // Shift counts
  const shiftCounts = {
    fullday: students.filter((s) => s.shift === 'fullday' && s.status === 'active').length,
    morning: students.filter((s) => s.shift === 'morning' && s.status === 'active').length,
    afternoon: students.filter((s) => s.shift === 'afternoon' && s.status === 'active').length,
    evening: students.filter((s) => s.shift === 'evening' && s.status === 'active').length,
    night: students.filter((s) => s.shift === 'night' && s.status === 'active').length,
  }

  return (
    <>
      <Header fixed>
        <div className='flex items-center gap-2 me-auto'>
          <h2 className='text-base font-semibold tracking-tight hidden sm:block'>
            Vertical Classes Library Dashboard
          </h2>
        </div>
        <Search />
        <SupabaseConnectDialog />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-6'>
        {/* Welcome & Quick Action Bar */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border bg-gradient-to-r from-primary/10 via-primary/5 to-card p-6 shadow-xs'>
          <div className='space-y-1'>
            <div className='flex items-center gap-2'>
              <Sparkles className='h-5 w-5 text-primary' />
              <h1 className='text-2xl font-bold tracking-tight'>
                Welcome back, Lounge Manager!
              </h1>
            </div>
            <p className='text-sm text-muted-foreground'>
              Here is what is happening at your study lounge today.
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-2.5'>
            <Button
              variant='outline'
              className='gap-1.5 shadow-xs'
              onClick={() => setShareLinkOpen(true)}
            >
              <Share2 className='h-4 w-4 text-primary' />
              Share Student Link
            </Button>

            <Button
              className='gap-1.5 shadow-xs'
              onClick={() => setFormOpen(true)}
            >
              <UserPlus className='h-4 w-4' />
              Enroll Student
            </Button>
          </div>
        </div>

        {/* Pending Registrations Alert (if any) */}
        {pendingStudents.length > 0 && (
          <div className='flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200'>
            <div className='flex items-center gap-3'>
              <div className='rounded-lg bg-amber-500/20 p-2'>
                <AlertCircle className='h-5 w-5 text-amber-600 dark:text-amber-400' />
              </div>
              <div>
                <p className='text-sm font-semibold'>
                  {pendingStudents.length} Online Student Registration{pendingStudents.length > 1 ? 's' : ''} Pending
                </p>
                <p className='text-xs text-amber-800/80 dark:text-amber-300/80'>
                  Students have submitted admission details online. Confirm desk allocation and approve.
                </p>
              </div>
            </div>
            <Button
              size='sm'
              className='bg-amber-600 hover:bg-amber-700 text-white shrink-0'
              onClick={() => navigate({ to: '/students' })}
            >
              Review Now
              <ArrowRight className='ml-1.5 h-3.5 w-3.5' />
            </Button>
          </div>
        )}

        {/* 4 Core KPI Cards */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {/* Card 1: Students */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Enrolled Students</CardTitle>
              <GraduationCap className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{students.length}</div>
              <div className='mt-1 flex items-center gap-1.5 text-xs text-muted-foreground'>
                <span className='font-semibold text-emerald-600'>{activeStudents.length} Active</span>
                <span>•</span>
                <span>{pendingStudents.length} Pending</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Desk Occupancy */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Desk Occupancy</CardTitle>
              <Armchair className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{occupancyPercentage}%</div>
              <div className='mt-1 flex items-center gap-1.5 text-xs text-muted-foreground'>
                <span className='font-semibold text-primary'>{occupiedSeats} Occupied</span>
                <span>•</span>
                <span className='font-semibold text-emerald-600'>{availableSeats} Vacant</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Revenue Collected */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Revenue Collected</CardTitle>
              <IndianRupee className='h-4 w-4 text-emerald-600' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-emerald-600'>
                ₹{totalRevenue.toLocaleString('en-IN')}
              </div>
              <div className='mt-1 text-xs text-muted-foreground'>
                {transactions.length} receipts generated
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Outstanding Dues */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Pending Dues</CardTitle>
              <AlertCircle className='h-4 w-4 text-destructive' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-destructive'>
                ₹{totalDues.toLocaleString('en-IN')}
              </div>
              <div className='mt-1 text-xs text-muted-foreground'>
                Across {students.filter((s) => s.amountDue > 0).length} students
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 2: Shift Distribution & Quick Highlights */}
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-7'>
          {/* Shift Slot Utilization (4 cols) */}
          <Card className='col-span-1 lg:col-span-4'>
            <CardHeader className='pb-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle className='text-base'>Shift Slot Distribution</CardTitle>
                  <CardDescription>
                    Active students attending across study lounge hours
                  </CardDescription>
                </div>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs'
                  onClick={() => navigate({ to: '/seats' })}
                >
                  View Floor Map
                  <ArrowRight className='ml-1 h-3.5 w-3.5' />
                </Button>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              {Object.entries(shiftCounts).map(([key, count]) => {
                const shift = SHIFT_DETAILS[key]
                const percentage = Math.round((count / (activeStudents.length || 1)) * 100)
                return (
                  <div key={key} className='space-y-1.5'>
                    <div className='flex items-center justify-between text-xs'>
                      <div className='flex items-center gap-2'>
                        <span className={`h-2.5 w-2.5 rounded-full ${
                          key === 'fullday'
                            ? 'bg-emerald-500'
                            : key === 'morning'
                              ? 'bg-amber-500'
                              : key === 'afternoon'
                                ? 'bg-blue-500'
                                : key === 'evening'
                                  ? 'bg-purple-500'
                                  : 'bg-indigo-500'
                        }`} />
                        <span className='font-semibold'>{shift?.label}</span>
                        <span className='text-muted-foreground'>({shift?.timing})</span>
                      </div>
                      <span className='font-mono font-medium'>{count} Students ({percentage}%)</span>
                    </div>
                    <div className='h-2 w-full overflow-hidden rounded-full bg-secondary'>
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          key === 'fullday'
                            ? 'bg-emerald-500'
                            : key === 'morning'
                              ? 'bg-amber-500'
                              : key === 'afternoon'
                                ? 'bg-blue-500'
                                : key === 'evening'
                                  ? 'bg-purple-500'
                                  : 'bg-indigo-500'
                        }`}
                        style={{ width: `${Math.max(5, percentage)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Recent Admissions (3 cols) */}
          <Card className='col-span-1 lg:col-span-3'>
            <CardHeader className='pb-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle className='text-base'>Recent Admissions</CardTitle>
                  <CardDescription>Latest registered lounge members</CardDescription>
                </div>
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-xs'
                  onClick={() => navigate({ to: '/students' })}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                {students.slice(0, 5).map((student) => (
                  <div
                    key={student.id}
                    className='flex items-center justify-between rounded-lg border p-2.5 text-xs hover:bg-muted/40 transition-colors'
                  >
                    <div className='flex items-center gap-2.5 min-w-0'>
                      <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary'>
                        {student.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className='min-w-0'>
                        <span className='font-semibold truncate block'>{student.fullName}</span>
                        <span className='text-muted-foreground font-mono text-[11px]'>
                          Desk: {student.seatNumber || 'Unassigned'} • {student.shift}
                        </span>
                      </div>
                    </div>

                    <div className='text-right shrink-0'>
                      <Badge
                        variant={student.status === 'active' ? 'default' : 'secondary'}
                        className='text-[10px] capitalize'
                      >
                        {student.status}
                      </Badge>
                      <span className='block text-[10px] text-muted-foreground mt-0.5'>
                        {student.paymentStatus === 'paid' ? 'Paid' : `Due: ₹${student.amountDue}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 3: Quick Action Promos */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          {/* Tile 1: Share Link */}
          <div className='rounded-xl border bg-card p-5 space-y-3 flex flex-col justify-between shadow-2xs'>
            <div className='space-y-1.5'>
              <div className='rounded-lg bg-primary/10 w-fit p-2 text-primary'>
                <Share2 className='h-5 w-5' />
              </div>
              <h3 className='font-bold text-base'>Public Student Registration</h3>
              <p className='text-xs text-muted-foreground'>
                Students can open this link on their mobile to pick a slot, enter details, and get an admission slip.
              </p>
            </div>
            <Button
              variant='outline'
              size='sm'
              className='w-full gap-1.5'
              onClick={() => setShareLinkOpen(true)}
            >
              Share Registration Link
              <ExternalLink className='h-3.5 w-3.5' />
            </Button>
          </div>

          {/* Tile 2: Fee Collections */}
          <div className='rounded-xl border bg-card p-5 space-y-3 flex flex-col justify-between shadow-2xs'>
            <div className='space-y-1.5'>
              <div className='rounded-lg bg-emerald-500/10 w-fit p-2 text-emerald-600'>
                <IndianRupee className='h-5 w-5' />
              </div>
              <h3 className='font-bold text-base'>Fee & Receipts Manager</h3>
              <p className='text-xs text-muted-foreground'>
                Collect membership fees via UPI/Cash, track overdue accounts, and print professional receipts.
              </p>
            </div>
            <Button
              variant='outline'
              size='sm'
              className='w-full'
              onClick={() => navigate({ to: '/fees' })}
            >
              Go to Fee Management
            </Button>
          </div>

          {/* Tile 3: Seat Occupancy Map */}
          <div className='rounded-xl border bg-card p-5 space-y-3 flex flex-col justify-between shadow-2xs'>
            <div className='space-y-1.5'>
              <div className='rounded-lg bg-purple-500/10 w-fit p-2 text-purple-600'>
                <Armchair className='h-5 w-5' />
              </div>
              <h3 className='font-bold text-base'>Interactive Floor Layout</h3>
              <p className='text-xs text-muted-foreground'>
                View all 30 desks across Silent Hall, Flexi Zone, and Executive AC Cabins in real-time.
              </p>
            </div>
            <Button
              variant='outline'
              size='sm'
              className='w-full'
              onClick={() => navigate({ to: '/seats' })}
            >
              View Desk Layout
            </Button>
          </div>
        </div>
      </Main>

      {/* Dialogs */}
      <ShareLinkDialog
        open={shareLinkOpen}
        onOpenChange={setShareLinkOpen}
      />

      <StudentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </>
  )
}
