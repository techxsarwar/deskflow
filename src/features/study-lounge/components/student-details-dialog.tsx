import {
  Calendar,
  Clock,
  Mail,
  MapPin,
  Phone,
  Armchair,
  BookOpen,
  IndianRupee,
  ShieldAlert,
  CheckCircle2,
  Lock,
  RefreshCw,
  FileText,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Student } from '../types'
import { SHIFT_DETAILS } from '../data/mock-data'
import { getMembershipLifecycle } from '../lib/membership-utils'

interface StudentDetailsDialogProps {
  student: Student | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCollectFee?: (student: Student) => void
  onApprove?: (student: Student) => void
  onRenew?: (student: Student) => void
  onReleaseSeat?: (student: Student) => void
  onOpenMonthlyReport?: (student: Student) => void
}

export function StudentDetailsDialog({
  student,
  open,
  onOpenChange,
  onCollectFee,
  onApprove,
  onRenew,
  onReleaseSeat,
  onOpenMonthlyReport,
}: StudentDetailsDialogProps) {
  if (!student) return null

  const shiftInfo = SHIFT_DETAILS[student.shift] || {
    label: student.shift,
    timing: 'Standard Shift',
    badgeColor: 'bg-primary/10 text-primary',
  }

  const lifecycle = getMembershipLifecycle(student)

  const handleWhatsApp = () => {
    const cleanNumber = student.phone.replace(/[^0-9]/g, '')
    window.open(`https://wa.me/${cleanNumber}`, '_blank')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <div className='flex items-center justify-between'>
            <DialogTitle>Student Profile & ID Card</DialogTitle>
            <div className='flex items-center gap-1.5'>
              <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${lifecycle.badgeColor}`}>
                {lifecycle.label}
              </span>
              <Badge
                variant={
                  student.status === 'active'
                    ? 'default'
                    : student.status === 'pending'
                      ? 'secondary'
                      : 'destructive'
                }
                className='capitalize'
              >
                {student.status}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className='space-y-4'>
          {/* ID Card Header */}
          <div className='flex items-center gap-4 rounded-xl border bg-gradient-to-br from-primary/5 via-card to-background p-4'>
            {student.photoUrl ? (
              <img
                src={student.photoUrl}
                alt={student.fullName}
                className='h-16 w-16 shrink-0 rounded-2xl object-cover shadow-md border-2 border-primary/20'
              />
            ) : (
              <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-md'>
                {student.fullName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>
            )}
            <div className='min-w-0 flex-1'>
              <h3 className='truncate text-lg font-bold'>{student.fullName}</h3>
              <p className='font-mono text-xs text-muted-foreground'>{student.regNo}</p>
              <div className='mt-1 flex flex-wrap items-center gap-1.5'>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${shiftInfo.badgeColor}`}>
                  {shiftInfo.label}
                </span>
                <span className='inline-flex items-center gap-1 rounded-md border bg-secondary/50 px-2 py-0.5 text-xs font-medium'>
                  <Armchair className='h-3 w-3' /> Desk: {student.seatNumber || 'Unassigned'}
                </span>
                {student.lockerNumber && (
                  <span className='inline-flex items-center gap-1 rounded-md border bg-secondary/50 px-2 py-0.5 text-xs font-medium'>
                    <Lock className='h-3 w-3' /> {student.lockerNumber}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs'>
            <div className='rounded-lg border bg-card p-3 space-y-2'>
              <h4 className='font-semibold text-muted-foreground uppercase tracking-wider text-[11px]'>
                Study & Shift Info
              </h4>
              <div className='flex items-center gap-2'>
                <BookOpen className='h-3.5 w-3.5 text-primary shrink-0' />
                <span className='truncate font-medium'>{student.studyGoal || 'General Studies'}</span>
              </div>
              <div className='flex items-center gap-2'>
                <Clock className='h-3.5 w-3.5 text-primary shrink-0' />
                <span className='text-muted-foreground'>{shiftInfo.timing}</span>
              </div>
              <div className='flex items-center gap-2'>
                <Calendar className='h-3.5 w-3.5 text-primary shrink-0' />
                <span>Valid: {student.startDate} to {student.endDate}</span>
              </div>
            </div>

            <div className='rounded-lg border bg-card p-3 space-y-2'>
              <h4 className='font-semibold text-muted-foreground uppercase tracking-wider text-[11px]'>
                Contact & Emergency
              </h4>
              <div className='flex items-center gap-2'>
                <Phone className='h-3.5 w-3.5 text-primary shrink-0' />
                <span className='font-mono'>{student.phone}</span>
              </div>
              <div className='flex items-center gap-2'>
                <Mail className='h-3.5 w-3.5 text-primary shrink-0' />
                <span className='truncate'>{student.email}</span>
              </div>
              <div className='flex items-center gap-2 text-amber-600 dark:text-amber-400'>
                <ShieldAlert className='h-3.5 w-3.5 shrink-0' />
                <span className='truncate font-medium'>SOS: {student.emergencyContact}</span>
              </div>
            </div>
          </div>

          {student.address && (
            <div className='flex items-start gap-2 rounded-lg border bg-muted/20 p-3 text-xs'>
              <MapPin className='h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5' />
              <span className='text-muted-foreground'>{student.address}</span>
            </div>
          )}

          {/* Fee & Payment Card */}
          <div className='rounded-xl border bg-muted/40 p-3.5'>
            <div className='flex items-center justify-between mb-2'>
              <span className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                Fee Status
              </span>
              <Badge
                variant={
                  student.paymentStatus === 'paid'
                    ? 'default'
                    : student.paymentStatus === 'partial'
                      ? 'secondary'
                      : 'destructive'
                }
                className='text-[10px] capitalize'
              >
                {student.paymentStatus}
              </Badge>
            </div>
            <div className='grid grid-cols-3 gap-2 text-center text-xs'>
              <div className='rounded-md bg-background p-2 border'>
                <span className='text-muted-foreground block text-[10px]'>Plan Fee</span>
                <span className='font-bold text-sm'>₹{student.planAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className='rounded-md bg-background p-2 border'>
                <span className='text-muted-foreground block text-[10px]'>Paid</span>
                <span className='font-bold text-sm text-emerald-600'>₹{student.amountPaid.toLocaleString('en-IN')}</span>
              </div>
              <div className='rounded-md bg-background p-2 border'>
                <span className='text-muted-foreground block text-[10px]'>Due</span>
                <span className='font-bold text-sm text-destructive'>₹{student.amountDue.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className='flex flex-wrap items-center justify-between gap-2 pt-2 border-t'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='gap-1.5'
              onClick={handleWhatsApp}
            >
              <Phone className='h-3.5 w-3.5 text-emerald-600' />
              Message on WhatsApp
            </Button>

            {onOpenMonthlyReport && (
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='gap-1.5 border-primary/30 text-primary hover:bg-primary/10'
                onClick={() => {
                  onOpenChange(false)
                  onOpenMonthlyReport(student)
                }}
              >
                <FileText className='h-3.5 w-3.5' />
                Monthly Audit PDF
              </Button>
            )}

            <div className='flex flex-wrap items-center gap-2'>
              {onRenew && (
                <Button
                  size='sm'
                  variant='outline'
                  className='gap-1.5 text-primary border-primary/30 hover:bg-primary/10'
                  onClick={() => {
                    onOpenChange(false)
                    onRenew(student)
                  }}
                >
                  <RefreshCw className='h-3.5 w-3.5' />
                  Renew (+1 Mo)
                </Button>
              )}

              {lifecycle.isEligibleForRelease && onReleaseSeat && (
                <Button
                  size='sm'
                  variant='outline'
                  className='gap-1.5 text-amber-600 border-amber-500/40 hover:bg-amber-500/10'
                  onClick={() => {
                    onOpenChange(false)
                    onReleaseSeat(student)
                  }}
                >
                  <Armchair className='h-3.5 w-3.5' />
                  Release Desk
                </Button>
              )}

              {student.status === 'pending' && onApprove && (
                <Button
                  size='sm'
                  className='bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5'
                  onClick={() => {
                    onOpenChange(false)
                    onCollectFee ? onCollectFee(student) : onApprove(student)
                  }}
                >
                  <CheckCircle2 className='h-4 w-4' />
                  Verify & Pay
                </Button>
              )}

              {student.amountDue > 0 && onCollectFee && student.status !== 'pending' && (
                <Button
                  size='sm'
                  className='gap-1.5'
                  onClick={() => {
                    onOpenChange(false)
                    onCollectFee(student)
                  }}
                >
                  <IndianRupee className='h-4 w-4' />
                  Collect Due (₹{student.amountDue})
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
