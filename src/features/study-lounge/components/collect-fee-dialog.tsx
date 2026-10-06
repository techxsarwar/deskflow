import { useState } from 'react'
import { IndianRupee } from 'lucide-react'
import { toast } from 'sonner'
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
import { Student, PaymentMode, FeeTransaction } from '../types'
import { useStudyLoungeStore } from '../store/study-lounge-store'

interface CollectFeeDialogProps {
  student: Student | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccessReceipt?: (transaction: FeeTransaction, openWhatsAppTab?: boolean) => void
}

export function CollectFeeDialog({
  student,
  open,
  onOpenChange,
  onSuccessReceipt,
}: CollectFeeDialogProps) {
  const recordPayment = useStudyLoungeStore((s) => s.recordPayment)

  const [amount, setAmount] = useState<number>(student?.amountDue || 0)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('upi')
  const [remarks, setRemarks] = useState('')
  const [openWhatsAppEditor, setOpenWhatsAppEditor] = useState<boolean>(true)

  // Sync amount when student changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && student) {
      setAmount(student.amountDue > 0 ? student.amountDue : 1000)
      setRemarks('')
      setOpenWhatsAppEditor(true)
    }
    onOpenChange(isOpen)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!student) return

    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    const txn = recordPayment(student.id, Number(amount), paymentMode, remarks)
    if (txn) {
      toast.success(`Payment of ₹${amount} recorded successfully!`)
      onOpenChange(false)

      if (onSuccessReceipt) {
        onSuccessReceipt(txn, openWhatsAppEditor)
      }
    }
  }

  if (!student) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-md max-h-[92vh] overflow-y-auto'>
        <DialogHeader>
          <div className='flex items-center gap-2 text-primary'>
            <div className='rounded-lg bg-primary/10 p-2'>
              <IndianRupee className='h-5 w-5 text-primary' />
            </div>
            <DialogTitle>Collect Student Fee</DialogTitle>
          </div>
          <DialogDescription>
            Record fee collection for <strong>{student.fullName}</strong> ({student.regNo}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Summary Box */}
          <div className='rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5'>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Membership Plan:</span>
              <span className='font-medium capitalize'>{student.membershipPlan.replace('_', ' ')}</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Total Plan Fee:</span>
              <span className='font-medium'>₹{student.planAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Already Paid:</span>
              <span className='font-medium text-emerald-600'>₹{student.amountPaid.toLocaleString('en-IN')}</span>
            </div>
            <div className='flex justify-between pt-1 border-t'>
              <span className='font-semibold'>Remaining Balance Due:</span>
              <span className='font-bold text-destructive text-base'>
                ₹{student.amountDue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Amount input */}
          <div className='space-y-2'>
            <Label htmlFor='fee-amount'>Amount Collecting (₹)</Label>
            <Input
              id='fee-amount'
              type='number'
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder='Enter amount'
              required
            />
          </div>

          {/* Payment Mode */}
          <div className='space-y-2'>
            <Label htmlFor='payment-mode'>Payment Mode</Label>
            <Select
              value={paymentMode}
              onValueChange={(val) => setPaymentMode(val as PaymentMode)}
            >
              <SelectTrigger id='payment-mode'>
                <SelectValue placeholder='Select payment mode' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='upi'>UPI (GPay / PhonePe / Paytm)</SelectItem>
                <SelectItem value='cash'>Cash at Front Desk</SelectItem>
                <SelectItem value='card'>Debit / Credit Card (POS)</SelectItem>
                <SelectItem value='bank_transfer'>Net Banking / IMPS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Remarks */}
          <div className='space-y-2'>
            <Label htmlFor='fee-remarks'>Transaction Notes / UTR / Remarks</Label>
            <Input
              id='fee-remarks'
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder='e.g., GPay Ref #98762, full monthly fee'
            />
          </div>

          {/* WhatsApp Text Editor Option */}
          <div className='rounded-lg border bg-emerald-500/5 border-emerald-500/20 p-3'>
            <label className='flex items-start gap-2.5 cursor-pointer select-none'>
              <input
                type='checkbox'
                checked={openWhatsAppEditor}
                onChange={(e) => setOpenWhatsAppEditor(e.target.checked)}
                className='mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500'
              />
              <div className='text-xs space-y-0.5'>
                <span className='font-semibold text-foreground flex items-center gap-1.5'>
                  💬 Open WhatsApp Text Editor after collection
                </span>
                <span className='text-muted-foreground block text-[11px]'>
                  Allows you to customize the message text, change phone number, or add notes before forwarding.
                </span>
              </div>
            </label>
          </div>

          <DialogFooter className='pt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type='submit' className='gap-1.5'>
              <IndianRupee className='h-4 w-4' />
              Record & Generate Receipt
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
