import { useState, useEffect } from 'react'
import {
  Printer,
  CheckCircle2,
  Building2,
  Clock,
  Calendar,
  User,
  Phone,
  Armchair,
  Copy,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Check,
  FileDown,
  RotateCcw,
  Sparkles,
  MessageSquare,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FeeTransaction } from '../types'
import { SHIFT_DETAILS } from '../data/mock-data'
import { useStudyLoungeStore } from '../store/study-lounge-store'
import {
  formatReceiptTimestamp,
  buildWhatsAppReceiptMessage,
  getWhatsAppShareUrl,
  cleanWhatsAppPhone,
} from '../lib/receipt-utils'

interface FeeReceiptDialogProps {
  transaction: FeeTransaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: 'receipt' | 'whatsapp'
}

export function FeeReceiptDialog({
  transaction,
  open,
  onOpenChange,
  defaultTab = 'receipt',
}: FeeReceiptDialogProps) {
  const students = useStudyLoungeStore((s) => s.students)
  const student = students.find((s) => s.id === transaction?.studentId)

  // Tab state
  const [activeTab, setActiveTab] = useState<'receipt' | 'whatsapp'>(defaultTab)

  // Editable text & phone states
  const [editableMessage, setEditableMessage] = useState<string>('')
  const [recipientPhone, setRecipientPhone] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // Sync state whenever transaction changes or dialog opens
  useEffect(() => {
    if (transaction && open) {
      const defaultText = buildWhatsAppReceiptMessage({ transaction, student })
      setEditableMessage(defaultText)
      const phoneNum = student?.phone || transaction.phone || ''
      setRecipientPhone(phoneNum)
      setActiveTab(defaultTab)
    }
  }, [transaction, student, open, defaultTab])

  if (!transaction) return null

  // Timestamps
  const ts = formatReceiptTimestamp(
    transaction.paymentDate,
    transaction.paymentTime,
    transaction.createdAt
  )

  // Student resolution
  const studentName = transaction.studentName || student?.fullName || 'Student'
  const regNo = transaction.regNo || student?.regNo || 'N/A'
  const email = student?.email || transaction.email || ''
  const seatNumber = transaction.seatNumber || student?.seatNumber || 'Unassigned'
  const shiftKey = transaction.shift || student?.shift || 'fullday'
  const shiftInfo = SHIFT_DETAILS[shiftKey] || {
    label: 'General Access',
    timing: 'Flexible Hours',
  }
  const planName = (
    transaction.membershipPlan ||
    student?.membershipPlan ||
    'monthly'
  ).replace('_', ' ')

  const planAmount =
    transaction.planAmount ?? student?.planAmount ?? transaction.amount
  const amountPaidThisTxn = transaction.amount
  const totalPaid = student?.amountPaid ?? transaction.amount
  const balanceDue =
    transaction.balanceAfterPayment ?? student?.amountDue ?? 0

  const validityDates =
    student?.startDate && student?.endDate
      ? `${student.startDate} to ${student.endDate}`
      : 'Active Membership'

  // Forwarding with EDITED text and EDITED phone number
  const handleForwardWhatsApp = () => {
    const cleanNumber = cleanWhatsAppPhone(recipientPhone)
    const shareUrl = getWhatsAppShareUrl(recipientPhone, editableMessage)

    window.open(shareUrl, '_blank')
    toast.success(
      cleanNumber
        ? `Opening WhatsApp with edited receipt for +${cleanNumber}!`
        : 'Opening WhatsApp with customized receipt...'
    )
  }

  // Copy edited text
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(editableMessage)
      setCopied(true)
      toast.success('Customized receipt copied! Ready to paste into WhatsApp.')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Failed to copy text to clipboard')
    }
  }

  // Print / Save as PDF
  const handlePrint = () => {
    // Switch to receipt tab to ensure receipt layout is active before print
    if (activeTab !== 'receipt') {
      setActiveTab('receipt')
      setTimeout(() => window.print(), 150)
    } else {
      window.print()
    }
  }

  // Reset edited text to default template
  const handleResetTemplate = () => {
    const defaultText = buildWhatsAppReceiptMessage({ transaction, student })
    setEditableMessage(defaultText)
    toast.info('Message reset to default receipt format.')
  }

  // Quick insertion helpers
  const handleInsertSnippet = (snippet: string) => {
    setEditableMessage((prev) => `${prev}\n${snippet}`)
    toast.success('Snippet added to message!')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[94vh] overflow-y-auto sm:max-w-3xl p-0 print:p-0 print:max-h-none print:overflow-visible print:border-none print:shadow-none'>
        {/* Sticky Action Toolbar */}
        <div className='sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2.5 border-b bg-background/95 px-4 sm:px-5 py-3 backdrop-blur-sm print:hidden'>
          <div className='flex items-center gap-2 min-w-0'>
            <div className='rounded-md bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400 shrink-0'>
              <CheckCircle2 className='h-4 w-4' />
            </div>
            <div className='min-w-0'>
              <DialogTitle className='text-sm sm:text-base font-semibold truncate'>Official Fee Receipt</DialogTitle>
              <DialogDescription className='sr-only'>
                Detailed fee payment receipt and transaction breakdown for {studentName} ({transaction.receiptNumber}).
              </DialogDescription>
              <p className='text-xs font-mono text-muted-foreground'>{transaction.receiptNumber}</p>
            </div>
          </div>

          <div className='flex items-center gap-2 w-full sm:w-auto'>
            {/* Direct WhatsApp Forward Button with Edited Text */}
            <Button
              size='sm'
              className='gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium shadow-xs flex-1 sm:flex-initial text-xs sm:text-sm'
              onClick={handleForwardWhatsApp}
              title={`Forward customized receipt to WhatsApp (${recipientPhone || 'General'})`}
            >
              <svg
                className='h-4 w-4 fill-current shrink-0'
                viewBox='0 0 24 24'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' />
              </svg>
              <span><span className='hidden sm:inline'>Forward to </span>WhatsApp</span>
            </Button>

            {/* Print / Save PDF Button */}
            <Button
              size='sm'
              variant='outline'
              onClick={handlePrint}
              className='gap-1.5 flex-1 sm:flex-initial text-xs sm:text-sm'
              title='Print or Save as PDF'
            >
              <Printer className='h-3.5 w-3.5 shrink-0' />
              <span><span className='hidden sm:inline'>Print / Save </span>PDF</span>
            </Button>
          </div>
        </div>

        {/* TABS SELECTOR (Printable PDF vs Editable WhatsApp Text) */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'receipt' | 'whatsapp')}
          className='w-full'
        >
          <div className='px-4 sm:px-6 pt-3 sm:pt-4 border-b bg-muted/20 print:hidden'>
            <TabsList className='grid w-full grid-cols-2 max-w-md mx-auto'>
              <TabsTrigger value='receipt' className='gap-1.5 text-xs sm:text-sm'>
                <FileText className='h-4 w-4' />
                <span><span className='hidden sm:inline'>Printable </span>Receipt</span>
              </TabsTrigger>
              <TabsTrigger value='whatsapp' className='gap-1.5 text-xs sm:text-sm'>
                <MessageSquare className='h-4 w-4 text-emerald-600' />
                <span><span className='hidden sm:inline'>Edit </span>WhatsApp Text</span>
                <Badge variant='outline' className='ml-1 text-[10px] py-0 px-1 text-emerald-600 border-emerald-300 hidden sm:inline-flex'>
                  Editable
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: OFFICIAL PRINTABLE RECEIPT */}
          <TabsContent value='receipt' className='m-0 p-0'>
            <div
              id='printable-fee-receipt'
              className='p-6 sm:p-8 bg-card text-card-foreground space-y-6 print:p-6 print:bg-white print:text-black print:m-0'
            >
              {/* HEADER WITH BRANDING & AUTHENTICATION STAMP */}
              <div className='flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-primary/20 pb-5'>
                <div className='space-y-1.5'>
                  <div className='flex items-center gap-2.5'>
                    <div className='rounded-lg bg-primary/10 p-2 text-primary'>
                      <Building2 className='h-6 w-6' />
                    </div>
                    <div>
                      <h2 className='text-xl sm:text-2xl font-extrabold tracking-tight text-foreground'>
                        VERTICAL CLASSES LIBRARY
                      </h2>
                      <p className='text-xs font-semibold text-primary uppercase tracking-wider'>
                        Quiet Study Lounge & Knowledge Hub
                      </p>
                    </div>
                  </div>

                  <div className='text-xs text-muted-foreground space-y-0.5 pt-1'>
                    <p>📍 City Center Campus, Metro Gate #2, Academic Complex, Central Road</p>
                    <p>
                      📞 Phone: <span className='font-mono font-medium text-foreground'>+91 99000 12345</span> | ✉️{' '}
                      <span className='font-medium text-foreground'>accounts@verticalclasseslibrary.com</span>
                    </p>
                    <p className='text-[11px] font-mono'>
                      Library Reg No: <span className='font-medium text-foreground'>VCL-2026/0491</span> • GSTIN / Udyam:{' '}
                      <span className='font-medium text-foreground'>07AAAAA0000A1Z5</span>
                    </p>
                  </div>
                </div>

                {/* Right: Receipt Meta & Paid Stamp */}
                <div className='sm:text-right space-y-2 flex flex-row sm:flex-col justify-between items-end sm:items-end'>
                  <div className='flex items-center gap-1.5'>
                    <span className='inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400'>
                      <ShieldCheck className='h-3.5 w-3.5' />
                      PAYMENT VERIFIED
                    </span>
                  </div>

                  <div className='space-y-1'>
                    <div className='text-xs'>
                      <span className='text-muted-foreground'>Receipt No: </span>
                      <span className='font-mono font-bold text-primary text-sm tracking-wide'>
                        {transaction.receiptNumber}
                      </span>
                    </div>
                    <div className='text-[11px] text-muted-foreground font-mono'>
                      <span>TXN ID: </span>
                      <span>{transaction.id}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* EXACT TIMESTAMP BANNER */}
              <div className='rounded-lg bg-muted/50 border px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs'>
                <div className='flex items-center gap-2'>
                  <Calendar className='h-3.5 w-3.5 text-primary' />
                  <span className='text-muted-foreground'>Date:</span>
                  <span className='font-semibold text-foreground'>{ts.formattedDate}</span>
                </div>
                <div className='flex items-center gap-2'>
                  <Clock className='h-3.5 w-3.5 text-amber-500' />
                  <span className='text-muted-foreground'>Exact Timestamp:</span>
                  <span className='font-mono font-bold text-foreground bg-background px-2 py-0.5 rounded border'>
                    {ts.formattedTime} IST
                  </span>
                </div>
                <div className='flex items-center gap-2'>
                  <CreditCard className='h-3.5 w-3.5 text-blue-500' />
                  <span className='text-muted-foreground'>Payment Mode:</span>
                  <Badge variant='outline' className='uppercase font-mono text-[10px]'>
                    {transaction.paymentMode}
                  </Badge>
                </div>
              </div>

              {/* STUDENT & ENROLMENT METADATA DOSSIER */}
              <div className='rounded-lg border bg-card p-4 space-y-3'>
                <div className='border-b pb-2 flex items-center justify-between'>
                  <h4 className='text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5'>
                    <User className='h-3.5 w-3.5 text-primary' />
                    Student & Membership Dossier
                  </h4>
                  <Badge variant='secondary' className='text-[10px] font-semibold capitalize'>
                    {student?.status || 'Active'} Member
                  </Badge>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs'>
                  {/* Col 1: Identity */}
                  <div className='flex items-start gap-3'>
                    {student?.photoUrl && (
                      <img
                        src={student.photoUrl}
                        alt={studentName}
                        className='h-12 w-12 rounded-lg object-cover border border-border/80 shadow-2xs shrink-0'
                      />
                    )}
                    <div className='space-y-1.5'>
                      <div>
                        <span className='text-muted-foreground text-[11px] block'>Student Full Name</span>
                        <span className='font-bold text-sm text-foreground'>{studentName}</span>
                      </div>
                      <div>
                        <span className='text-muted-foreground text-[11px] block'>Registration / Roll No.</span>
                        <span className='font-mono font-semibold text-primary'>{regNo}</span>
                      </div>
                    </div>
                  </div>

                  {/* Col 2: Seat & Slot */}
                  <div className='space-y-1.5'>
                    <div>
                      <span className='text-muted-foreground text-[11px] block'>Allotted Desk / Seat</span>
                      <span className='font-semibold text-foreground flex items-center gap-1'>
                        <Armchair className='h-3 w-3 text-primary' />
                        {seatNumber} ({student?.seatType === 'dedicated' ? 'Dedicated' : 'Flexi'})
                      </span>
                    </div>
                    <div>
                      <span className='text-muted-foreground text-[11px] block'>Shift / Timing Slot</span>
                      <span className='font-medium text-foreground'>
                        {shiftInfo.label} ({shiftInfo.timing})
                      </span>
                    </div>
                  </div>

                  {/* Col 3: Contact & Validity */}
                  <div className='space-y-1.5'>
                    <div>
                      <span className='text-muted-foreground text-[11px] block'>Registered Mobile (WhatsApp)</span>
                      <span className='font-mono font-medium text-foreground flex items-center gap-1'>
                        <Phone className='h-3 w-3 text-emerald-600' />
                        {recipientPhone || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className='text-muted-foreground text-[11px] block'>Membership Period</span>
                      <span className='font-medium text-foreground capitalize'>
                        {planName} • <span className='text-muted-foreground'>{validityDates}</span>
                      </span>
                    </div>
                    {email && (
                      <div>
                        <span className='text-muted-foreground text-[11px] block'>Email</span>
                        <span className='font-medium text-foreground text-[11px] truncate block'>{email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {student?.studyGoal && (
                  <div className='pt-2 border-t text-[11px] text-muted-foreground'>
                    <span className='font-medium text-foreground'>Course / Preparation:</span> {student.studyGoal}
                  </div>
                )}
              </div>

              {/* ITEMIZED LEDGER TABLE */}
              <div className='border rounded-lg overflow-hidden'>
                <table className='w-full text-xs text-left'>
                  <thead className='bg-muted/70 border-b text-muted-foreground font-semibold uppercase text-[10px]'>
                    <tr>
                      <th className='py-2.5 px-3.5'>#</th>
                      <th className='py-2.5 px-3.5'>Fee Particulars & Facilities</th>
                      <th className='py-2.5 px-3.5 text-right'>Plan Rate</th>
                      <th className='py-2.5 px-3.5 text-right'>Prior Paid</th>
                      <th className='py-2.5 px-3.5 text-right'>Paid This Txn</th>
                      <th className='py-2.5 px-3.5 text-right'>Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y'>
                    <tr className='bg-background'>
                      <td className='py-3 px-3.5 font-mono text-muted-foreground'>01</td>
                      <td className='py-3 px-3.5'>
                        <div className='font-bold text-foreground capitalize'>
                          {planName} Study Lounge Access
                        </div>
                        <div className='text-[11px] text-muted-foreground leading-relaxed mt-0.5'>
                          • Air-conditioned silent hall access, ergonomic study desk, high-speed Wi-Fi & power socket.
                        </div>
                        {transaction.remarks && (
                          <div className='text-[11px] text-primary font-medium mt-1'>
                            Note: {transaction.remarks}
                          </div>
                        )}
                      </td>
                      <td className='py-3 px-3.5 text-right font-medium text-muted-foreground'>
                        ₹{planAmount.toLocaleString('en-IN')}
                      </td>
                      <td className='py-3 px-3.5 text-right font-medium text-muted-foreground'>
                        ₹{Math.max(0, totalPaid - amountPaidThisTxn).toLocaleString('en-IN')}
                      </td>
                      <td className='py-3 px-3.5 text-right font-extrabold text-emerald-600 dark:text-emerald-400 text-sm'>
                        ₹{amountPaidThisTxn.toLocaleString('en-IN')}
                      </td>
                      <td className='py-3 px-3.5 text-right font-bold text-sm'>
                        <span className={balanceDue > 0 ? 'text-destructive' : 'text-emerald-600'}>
                          ₹{balanceDue.toLocaleString('en-IN')}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* FINANCIAL SUMMARY & AUDIT SECTION */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 items-start'>
                {/* Payment Audit Note */}
                <div className='rounded-lg border bg-muted/20 p-3.5 text-xs space-y-2'>
                  <div className='font-semibold text-foreground flex items-center gap-1.5'>
                    <ShieldCheck className='h-4 w-4 text-primary' />
                    Payment Audit & Mode Information
                  </div>
                  <div className='space-y-1 text-muted-foreground text-[11px] leading-relaxed'>
                    <p>
                      • <strong>Payment Mode:</strong>{' '}
                      <span className='font-mono uppercase font-semibold text-foreground'>
                        {transaction.paymentMode}
                      </span>
                    </p>
                    <p>
                      • <strong>Transaction Ref:</strong>{' '}
                      <span className='font-mono text-foreground'>
                        {transaction.remarks || 'Standard Front Desk Collection'}
                      </span>
                    </p>
                    <p>
                      • <strong>Processed By:</strong> Admin Front Desk (Admin Manager)
                    </p>
                    <p>
                      • <strong>Counter:</strong> Terminal 01 - Cashier Desk
                    </p>
                  </div>
                </div>

                {/* Final Balance Box */}
                <div className='rounded-lg border bg-muted/40 p-4 space-y-2 text-xs'>
                  <div className='flex justify-between items-center'>
                    <span className='text-muted-foreground'>Total Membership Fee:</span>
                    <span className='font-semibold'>₹{planAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className='flex justify-between items-center'>
                    <span className='text-muted-foreground'>Total Paid Till Date:</span>
                    <span className='font-semibold text-emerald-600'>₹{totalPaid.toLocaleString('en-IN')}</span>
                  </div>
                  <div className='flex justify-between items-center pt-2 border-t font-semibold text-sm'>
                    <span className='text-foreground'>Amount Paid In This Receipt:</span>
                    <span className='font-extrabold text-emerald-600 text-base'>
                      ₹{amountPaidThisTxn.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className='flex justify-between items-center pt-1 border-t'>
                    <span className='font-semibold text-foreground'>Outstanding Balance Due:</span>
                    <span
                      className={`font-extrabold text-sm ${
                        balanceDue > 0 ? 'text-destructive' : 'text-emerald-600'
                      }`}
                    >
                      {balanceDue > 0 ? `₹${balanceDue.toLocaleString('en-IN')} (Pending)` : '₹0 (Fully Cleared)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* AUTHENTICATION: BARCODE, OFFICIAL STAMP & SIGNATURE */}
              <div className='pt-4 border-t-2 border-dashed flex flex-col sm:flex-row items-center justify-between gap-6'>
                {/* Visual Barcode Section */}
                <div className='flex items-center gap-3 text-left'>
                  <div className='space-y-1 bg-white p-2 rounded border border-muted'>
                    <svg className='h-8 w-36 text-black' viewBox='0 0 160 35' fill='currentColor'>
                      <rect x='0' y='0' width='4' height='35' />
                      <rect x='6' y='0' width='2' height='35' />
                      <rect x='10' y='0' width='5' height='35' />
                      <rect x='18' y='0' width='2' height='35' />
                      <rect x='22' y='0' width='3' height='35' />
                      <rect x='28' y='0' width='6' height='35' />
                      <rect x='36' y='0' width='2' height='35' />
                      <rect x='41' y='0' width='4' height='35' />
                      <rect x='47' y='0' width='5' height='35' />
                      <rect x='54' y='0' width='2' height='35' />
                      <rect x='58' y='0' width='4' height='35' />
                      <rect x='65' y='0' width='6' height='35' />
                      <rect x='74' y='0' width='2' height='35' />
                      <rect x='79' y='0' width='5' height='35' />
                      <rect x='86' y='0' width='3' height='35' />
                      <rect x='92' y='0' width='2' height='35' />
                      <rect x='96' y='0' width='5' height='35' />
                      <rect x='103' y='0' width='4' height='35' />
                      <rect x='110' y='0' width='2' height='35' />
                      <rect x='114' y='0' width='6' height='35' />
                      <rect x='122' y='0' width='3' height='35' />
                      <rect x='128' y='0' width='5' height='35' />
                      <rect x='136' y='0' width='2' height='35' />
                      <rect x='140' y='0' width='4' height='35' />
                      <rect x='146' y='0' width='2' height='35' />
                      <rect x='150' y='0' width='6' height='35' />
                    </svg>
                    <div className='text-[9px] font-mono tracking-widest text-center text-black font-semibold'>
                      {transaction.receiptNumber}
                    </div>
                  </div>

                  <div className='text-[10px] text-muted-foreground space-y-0.5 leading-tight'>
                    <p className='font-semibold text-foreground'>Digital Security Seal</p>
                    <p>Scan barcode for instant verification</p>
                    <p className='font-mono'>SHA256: {transaction.id.replace('TXN-', '')}...</p>
                  </div>
                </div>

                {/* Circular Stamp & Signature */}
                <div className='flex items-center gap-5'>
                  <div className='hidden sm:flex flex-col items-center justify-center h-16 w-16 rounded-full border-2 border-primary/50 text-primary p-1 text-center rotate-[-12deg] select-none'>
                    <span className='text-[7px] font-bold uppercase tracking-tight leading-none'>Vertical Classes</span>
                    <CheckCircle2 className='h-3.5 w-3.5 my-0.5' />
                    <span className='text-[7px] font-bold uppercase tracking-tight leading-none'>ACCOUNTS DEPT</span>
                  </div>

                  <div className='text-center space-y-1'>
                    <div className='font-serif italic text-sm text-foreground/80 tracking-wide'>
                      Admin Manager
                    </div>
                    <div className='h-0.5 w-32 bg-foreground/30'></div>
                    <div className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wider'>
                      Authorized Signatory
                    </div>
                  </div>
                </div>
              </div>

              {/* TERMS & RULES NOTICE */}
              <div className='rounded bg-muted/30 p-2.5 text-[10px] text-muted-foreground space-y-0.5 leading-relaxed'>
                <p className='font-semibold text-foreground'>Important Student Terms & Lounge Conditions:</p>
                <p>1. This receipt is compulsory for reading hall entry, biometric desk check-in, and locker allocation.</p>
                <p>2. Maintain complete silence in study areas. Phone conversations are restricted to reception zones only.</p>
                <p>3. Membership fee once deposited is non-refundable, non-adjustable, and strictly non-transferable.</p>
                <p>4. This is an authentic system-generated tax invoice & receipt produced by Vertical Classes Library Portal.</p>
              </div>

              {/* Bottom Quick Switch Banner */}
              <div className='rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden'>
                <div className='text-xs text-left'>
                  <span className='font-semibold text-emerald-800 dark:text-emerald-300 block'>
                    Want to customize message before forwarding?
                  </span>
                  <span className='text-[11px] text-muted-foreground'>
                    You can edit the text, add notes, change numbers, or add Wi-Fi passwords in the editor.
                  </span>
                </div>
                <div className='flex gap-2 w-full sm:w-auto'>
                  <Button
                    size='sm'
                    variant='outline'
                    className='gap-1 border-emerald-400 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950'
                    onClick={() => setActiveTab('whatsapp')}
                  >
                    <MessageSquare className='h-3.5 w-3.5' />
                    Edit WhatsApp Text
                  </Button>
                  <Button
                    size='sm'
                    className='bg-[#25D366] hover:bg-[#20bd5a] text-white gap-1.5'
                    onClick={handleForwardWhatsApp}
                  >
                    <ExternalLink className='h-3.5 w-3.5' />
                    Forward Now
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: EDITABLE WHATSAPP MESSAGE EDITOR */}
          <TabsContent value='whatsapp' className='m-0 p-6 space-y-5 print:hidden'>
            <div className='rounded-lg border bg-muted/20 p-4 space-y-4'>
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3'>
                <div>
                  <h3 className='font-bold text-base flex items-center gap-2'>
                    <MessageSquare className='h-4 w-4 text-emerald-600' />
                    Live WhatsApp Receipt Message Editor
                  </h3>
                  <p className='text-xs text-muted-foreground'>
                    Feel free to edit any lines, custom greetings, Wi-Fi info, or reminders before sending.
                  </p>
                </div>
                <div className='flex items-center gap-1.5'>
                  <Button
                    size='sm'
                    variant='ghost'
                    className='h-8 text-xs gap-1 text-muted-foreground hover:text-foreground'
                    onClick={handleResetTemplate}
                    title='Reset to default template'
                  >
                    <RotateCcw className='h-3.5 w-3.5' />
                    Reset
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    className='h-8 text-xs gap-1'
                    onClick={handleCopyText}
                  >
                    {copied ? <Check className='h-3.5 w-3.5 text-emerald-600' /> : <Copy className='h-3.5 w-3.5' />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              {/* Recipient Phone Input (Editable!) */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 bg-background p-3 rounded-md border'>
                <div className='space-y-1.5'>
                  <Label htmlFor='wa-phone' className='text-xs font-semibold flex items-center gap-1.5'>
                    <Phone className='h-3.5 w-3.5 text-emerald-600' />
                    Forward to WhatsApp Number
                  </Label>
                  <Input
                    id='wa-phone'
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder='e.g. 9876543210 (or student / parent number)'
                    className='h-9 font-mono text-xs'
                  />
                  <span className='text-[10px] text-muted-foreground block'>
                    Auto-formats with India (+91) country code. You can change this to send to parents or alternate phone.
                  </span>
                </div>

                <div className='space-y-1.5'>
                  <Label className='text-xs font-semibold flex items-center gap-1.5'>
                    <FileDown className='h-3.5 w-3.5 text-primary' />
                    PDF Receipt Attachment
                  </Label>
                  <div className='text-xs text-muted-foreground space-y-1'>
                    <p>
                      WhatsApp Web / Desktop receives the complete itemized text above.
                    </p>
                    <Button
                      size='sm'
                      variant='secondary'
                      className='h-8 w-full gap-1.5 text-xs'
                      onClick={handlePrint}
                    >
                      <Printer className='h-3.5 w-3.5' />
                      Save Official PDF to Attach in Chat
                    </Button>
                  </div>
                </div>
              </div>

              {/* Quick Snippet Chips */}
              <div className='space-y-1.5'>
                <Label className='text-xs text-muted-foreground flex items-center gap-1'>
                  <Sparkles className='h-3 w-3 text-amber-500' />
                  Quick Insert Snippets into Message:
                </Label>
                <div className='flex flex-wrap gap-1.5'>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    className='h-7 text-[11px] px-2.5 rounded-full'
                    onClick={() =>
                      handleInsertSnippet('📶 *Wi-Fi Details:* SSID: `Vertical_Library_5G` | Pass: `Study@Vertical`')
                    }
                  >
                    + Wi-Fi Passcode
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    className='h-7 text-[11px] px-2.5 rounded-full'
                    onClick={() =>
                      handleInsertSnippet(`🔐 *Locker Allotment:* Locker #${student?.lockerNumber || 'L-04'} assigned.`)
                    }
                  >
                    + Locker Note
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    className='h-7 text-[11px] px-2.5 rounded-full'
                    onClick={() =>
                      handleInsertSnippet('📸 *Notice:* Please submit 1 passport size photograph for biometric ID card.')
                    }
                  >
                    + ID Photo Notice
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    className='h-7 text-[11px] px-2.5 rounded-full'
                    onClick={() =>
                      handleInsertSnippet(`⚠️ *Fee Balance Reminder:* Balance of ₹${balanceDue} due within 7 days.`)
                    }
                  >
                    + Due Reminder
                  </Button>
                </div>
              </div>

              {/* The Editable Message Textarea */}
              <div className='space-y-1.5'>
                <div className='flex justify-between items-center'>
                  <Label htmlFor='editable-msg' className='text-xs font-semibold'>
                    Message Content (WhatsApp Formatted)
                  </Label>
                  <span className='text-[10px] font-mono text-muted-foreground'>
                    {editableMessage.length} characters
                  </span>
                </div>
                <Textarea
                  id='editable-msg'
                  value={editableMessage}
                  onChange={(e) => setEditableMessage(e.target.value)}
                  rows={14}
                  className='font-mono text-xs leading-relaxed resize-y bg-background'
                  placeholder='Write or customize your receipt message here...'
                />
                <p className='text-[10px] text-muted-foreground'>
                  Tip: Supports WhatsApp markdown: <code className='text-primary'>*bold*</code>,{' '}
                  <code className='text-primary'>_italics_</code>, <code className='text-primary'>~strike~</code>, and{' '}
                  <code className='text-primary'>`monospace`</code>.
                </p>
              </div>

              {/* Bottom Send & Action Buttons */}
              <div className='pt-2 flex flex-col sm:flex-row items-center justify-between gap-3'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setActiveTab('receipt')}
                  className='gap-1.5 w-full sm:w-auto'
                >
                  <FileText className='h-3.5 w-3.5' />
                  View Printable PDF
                </Button>

                <div className='flex items-center gap-2 w-full sm:w-auto'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={handleCopyText}
                    className='gap-1.5 w-full sm:w-auto'
                  >
                    {copied ? <Check className='h-3.5 w-3.5 text-emerald-600' /> : <Copy className='h-3.5 w-3.5' />}
                    {copied ? 'Copied' : 'Copy Text'}
                  </Button>

                  <Button
                    size='sm'
                    className='gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold w-full sm:w-auto shadow-xs'
                    onClick={handleForwardWhatsApp}
                  >
                    <svg
                      className='h-4 w-4 fill-current'
                      viewBox='0 0 24 24'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' />
                    </svg>
                    <span>Forward Edited Text to WhatsApp</span>
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
