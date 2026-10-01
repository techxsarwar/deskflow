import { useState, useEffect } from 'react'
import {
  Calendar,
  Check,
  IndianRupee,
  MessageSquare,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Student, PaymentMode } from '../types'
import { useStudyLoungeStore } from '../store/study-lounge-store'
import {
  calculateNextRenewalDate,
  buildRenewalWhatsAppMessage,
} from '../lib/membership-utils'
import { cleanWhatsAppPhone } from '../lib/receipt-utils'

interface RenewMembershipDialogProps {
  student: Student | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RenewMembershipDialog({
  student,
  open,
  onOpenChange,
}: RenewMembershipDialogProps) {
  const renewStudentMembership = useStudyLoungeStore(
    (s) => s.renewStudentMembership
  )

  const [months, setMonths] = useState<number>(1)
  const [feeAmount, setFeeAmount] = useState<number>(1000)
  const [amountPaid, setAmountPaid] = useState<number>(1000)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('upi')
  const [notes, setNotes] = useState<string>('')
  const [shareWhatsApp, setShareWhatsApp] = useState<boolean>(true)
  const [newEndDate, setNewEndDate] = useState<string>('')

  // Calculate new end date whenever student or months changes
  useEffect(() => {
    if (student && open) {
      const calculated = calculateNextRenewalDate(student.endDate, months)
      setNewEndDate(calculated)
      const cost = months * 1000
      setFeeAmount(cost)
      setAmountPaid(cost)
      setNotes(`Monthly subscription renewal for ${months} month(s)`)
    }
  }, [student, months, open])

  if (!student) return null

  const handleMonthsChange = (val: string) => {
    const m = Number(val) || 1
    setMonths(m)
    const cost = m * 1000
    setFeeAmount(cost)
    setAmountPaid(cost)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const result = renewStudentMembership(student.id, {
      durationMonths: months,
      planFee: feeAmount,
      amountPaidNow: amountPaid,
      paymentMode,
      remarks: notes || `Membership renewed for ${months} month(s)`,
    })

    if (!result) {
      toast.error('Failed to process renewal')
      return
    }

    toast.success(
      `Renewed ${student.fullName}'s membership! Valid till ${newEndDate}.`
    )

    if (shareWhatsApp && amountPaid > 0 && student.phone) {
      const msg = buildRenewalWhatsAppMessage({
        student: result.student,
        transaction: result.transaction,
        newEndDate,
        amountPaid,
      })
      const cleanPhone = cleanWhatsAppPhone(student.phone)
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      window.open(url, '_blank')
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <div className='flex items-center gap-2 text-primary'>
            <div className='rounded-lg bg-primary/10 p-2'>
              <RefreshCw className='h-5 w-5 text-primary' />
            </div>
            <DialogTitle>Renew Student Membership</DialogTitle>
          </div>
          <DialogDescription className='text-xs'>
            Extend 24/7 dedicated desk reservation and record the next monthly billing cycle.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4 py-2 text-xs'>
          {/* Student Profile Snapshot */}
          <div className='flex items-center gap-3 p-3 rounded-xl border bg-muted/30'>
            {student.photoUrl ? (
              <img
                src={student.photoUrl}
                alt={student.fullName}
                className='h-12 w-12 rounded-xl object-cover border border-primary/20 shrink-0'
              />
            ) : (
              <div className='h-12 w-12 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-sm'>
                {student.fullName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className='min-w-0 flex-1'>
              <div className='flex items-center justify-between'>
                <span className='font-bold text-sm text-foreground truncate block'>
                  {student.fullName}
                </span>
                <Badge variant='outline' className='text-[10px] font-mono'>
                  {student.regNo}
                </Badge>
              </div>
              <div className='flex items-center gap-2 text-muted-foreground mt-0.5 text-[11px]'>
                <span>Desk: <strong className='text-foreground'>{student.seatNumber || 'Unassigned'}</strong> (24/7)</span>
                <span>•</span>
                <span>Expires: <strong className='text-primary'>{student.endDate}</strong></span>
              </div>
            </div>
          </div>

          {/* Renewal Duration & New Expiry */}
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label className='text-[11px] font-semibold text-muted-foreground'>
                Renewal Period
              </Label>
              <Select
                value={String(months)}
                onValueChange={handleMonthsChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='1'>+1 Month (Standard)</SelectItem>
                  <SelectItem value='2'>+2 Months</SelectItem>
                  <SelectItem value='3'>+3 Months (Quarter)</SelectItem>
                  <SelectItem value='6'>+6 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1.5'>
              <Label className='text-[11px] font-semibold text-muted-foreground'>
                New Expiry Date
              </Label>
              <div className='h-9 rounded-md border bg-muted/40 px-3 flex items-center gap-1.5 font-mono font-bold text-primary text-xs'>
                <Calendar className='h-3.5 w-3.5' />
                <span>{newEndDate || '---'}</span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className='rounded-xl border p-3 bg-card space-y-3'>
            <div className='flex items-center justify-between border-b pb-2'>
              <h4 className='font-bold uppercase tracking-wider text-[11px] text-muted-foreground flex items-center gap-1.5'>
                <IndianRupee className='h-3.5 w-3.5 text-primary' />
                Renewal Billing & Fee
              </h4>
              <span className='font-bold text-sm text-foreground'>
                ₹{feeAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label htmlFor='renew-amount' className='text-[11px]'>
                  Amount Paid Now (₹)
                </Label>
                <Input
                  id='renew-amount'
                  type='number'
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Number(e.target.value))}
                  min={0}
                  max={feeAmount}
                  required
                />
              </div>

              <div className='space-y-1.5'>
                <Label className='text-[11px]'>Payment Mode</Label>
                <Select
                  value={paymentMode}
                  onValueChange={(v) => setPaymentMode(v as PaymentMode)}
                  disabled={amountPaid === 0}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='upi'>UPI / QR (GPay / PhonePe)</SelectItem>
                    <SelectItem value='cash'>Cash at Desk</SelectItem>
                    <SelectItem value='card'>POS Debit/Credit Card</SelectItem>
                    <SelectItem value='bank_transfer'>Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {feeAmount > amountPaid && (
              <p className='text-[11px] text-amber-600 dark:text-amber-400 font-medium'>
                ⚠️ ₹{(feeAmount - amountPaid).toLocaleString('en-IN')} will remain as balance due for this cycle.
              </p>
            )}
          </div>

          {/* WhatsApp Confirmation Toggle */}
          <label className='flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground pt-1'>
            <input
              type='checkbox'
              checked={shareWhatsApp}
              onChange={(e) => setShareWhatsApp(e.target.checked)}
              className='rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5'
            />
            <span className='flex items-center gap-1'>
              <MessageSquare className='h-3.5 w-3.5 text-emerald-600' />
              Send Renewal Pass & Receipt to Student via WhatsApp
            </span>
          </label>

          <DialogFooter className='pt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type='submit' className='gap-1.5'>
              <Check className='h-4 w-4' />
              Confirm Renewal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
