import { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Copy,
  Printer,
  Sparkles,
  RotateCcw,
  Check,
  Building2,
  AlertTriangle,
  Calendar,
  CreditCard,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Student } from '../types'
import { buildCommunityDueBroadcastMessage } from '../lib/receipt-utils'

interface BroadcastDueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: Student[] // Selected students to include
}

export function BroadcastDueDialog({
  open,
  onOpenChange,
  students,
}: BroadcastDueDialogProps) {
  // Default deadline: 3 days from today
  const defaultDeadline = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }, [])

  const [deadlineDate, setDeadlineDate] = useState<string>(defaultDeadline)
  const [upiId, setUpiId] = useState<string>('verticalclasses@upi')
  const [editableMessage, setEditableMessage] = useState<string>('')
  const [copied, setCopied] = useState<boolean>(false)

  // Re-generate message whenever students, deadline, or upiId changes on modal open
  useEffect(() => {
    if (open) {
      const msg = buildCommunityDueBroadcastMessage({
        students,
        deadlineDate,
        upiId,
      })
      setEditableMessage(msg)
    }
  }, [open, students, deadlineDate, upiId])

  const totalDueSum = useMemo(
    () => students.reduce((acc, s) => acc + s.amountDue, 0),
    [students]
  )

  const handleForwardToWhatsAppGroup = () => {
    if (!editableMessage) return
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(editableMessage)}`
    window.open(url, '_blank')
    toast.success('Opening WhatsApp! Select your Community Group or Announcement Channel to share.')
  }

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(editableMessage)
      setCopied(true)
      toast.success('Community reminder copied! Paste directly into your WhatsApp group.')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleResetTemplate = () => {
    const msg = buildCommunityDueBroadcastMessage({
      students,
      deadlineDate,
      upiId,
    })
    setEditableMessage(msg)
    toast.info('Message reset to default format.')
  }

  const handleInsertSnippet = (snippet: string) => {
    setEditableMessage((prev) => `${prev}\n\n${snippet}`)
    toast.success('Added notice snippet!')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[92vh] overflow-y-auto sm:max-w-2xl p-0 print:p-0 print:max-h-none print:overflow-visible print:border-none print:shadow-none'>
        {/* Header */}
        <div className='sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-6 py-4 backdrop-blur-sm print:hidden'>
          <div className='flex items-center gap-2.5'>
            <div className='rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400'>
              <AlertTriangle className='h-5 w-5' />
            </div>
            <div>
              <DialogTitle className='text-base font-semibold'>
                WhatsApp Community Due Reminder
              </DialogTitle>
              <DialogDescription className='text-xs text-muted-foreground'>
                Format & broadcast pending dues notice to your WhatsApp Community or batch group.
              </DialogDescription>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <Button
              size='sm'
              className='gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium shadow-xs'
              onClick={handleForwardToWhatsAppGroup}
            >
              <svg className='h-4 w-4 fill-current' viewBox='0 0 24 24'>
                <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' />
              </svg>
              <span>Share to WhatsApp Group</span>
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={handlePrint}
              className='gap-1.5'
              title='Print official notice for physical library board'
            >
              <Printer className='h-3.5 w-3.5' />
              <span className='hidden sm:inline'>Print Notice</span>
            </Button>
          </div>
        </div>

        <div className='p-6 space-y-5 print:p-6 print:m-0'>
          {/* Top Overview Ribbon */}
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 print:hidden'>
            <div className='rounded-lg border bg-muted/40 p-3'>
              <span className='text-xs text-muted-foreground block'>Included Members</span>
              <span className='text-xl font-bold flex items-center gap-1.5'>
                <Users className='h-4 w-4 text-primary' />
                {students.length} Students
              </span>
            </div>

            <div className='rounded-lg border bg-muted/40 p-3'>
              <span className='text-xs text-muted-foreground block'>Total Pending Balance</span>
              <span className='text-xl font-bold text-destructive'>
                ₹{totalDueSum.toLocaleString('en-IN')}
              </span>
            </div>

            <div className='col-span-2 sm:col-span-1 rounded-lg border bg-emerald-500/10 border-emerald-500/20 p-3'>
              <span className='text-xs text-emerald-800 dark:text-emerald-300 block'>Broadcast Channel</span>
              <span className='text-sm font-semibold text-emerald-700 dark:text-emerald-400'>
                WhatsApp Community Group
              </span>
            </div>
          </div>

          {/* Configuration Inputs */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/20 p-3.5 rounded-lg border print:hidden'>
            <div className='space-y-1.5'>
              <Label htmlFor='broadcast-deadline' className='text-xs font-semibold flex items-center gap-1.5'>
                <Calendar className='h-3.5 w-3.5 text-amber-500' />
                Clearance Deadline Date
              </Label>
              <Input
                id='broadcast-deadline'
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                placeholder='e.g., 05 Oct 2026'
                className='h-8 text-xs font-medium'
              />
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='broadcast-upi' className='text-xs font-semibold flex items-center gap-1.5'>
                <CreditCard className='h-3.5 w-3.5 text-blue-500' />
                UPI ID for Instant Payment
              </Label>
              <Input
                id='broadcast-upi'
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder='e.g., library@upi'
                className='h-8 text-xs font-mono'
              />
            </div>
          </div>

          {/* Quick Snippets */}
          <div className='space-y-1.5 print:hidden'>
            <Label className='text-xs text-muted-foreground flex items-center gap-1'>
              <Sparkles className='h-3 w-3 text-amber-500' />
              Quick Add Notice Clauses:
            </Label>
            <div className='flex flex-wrap gap-1.5'>
              <Button
                type='button'
                size='sm'
                variant='outline'
                className='h-7 text-[11px] px-2.5 rounded-full'
                onClick={() =>
                  handleInsertSnippet(
                    '⚠️ *URGENT:* Failure to clear dues by the deadline may lead to automatic cancellation of your dedicated desk allotment.'
                  )
                }
              >
                + Desk Cancellation Warning
              </Button>
              <Button
                type='button'
                size='sm'
                variant='outline'
                className='h-7 text-[11px] px-2.5 rounded-full'
                onClick={() =>
                  handleInsertSnippet(
                    '🔐 *Biometric Card Punch:* Wi-Fi login and RFID biometric punch cards will be renewed automatically upon fee clearance.'
                  )
                }
              >
                + Biometric / Wi-Fi Card Rule
              </Button>
              <Button
                type='button'
                size='sm'
                variant='outline'
                className='h-7 text-[11px] px-2.5 rounded-full'
                onClick={() =>
                  handleInsertSnippet(
                    '🙏 _We value your dedicated preparation and kindly request your timely support to maintain 24/7 high-speed silent facilities._'
                  )
                }
              >
                + Polite Motivation Clause
              </Button>
            </div>
          </div>

          {/* The Editable Message Textarea */}
          <div className='space-y-1.5 print:hidden'>
            <div className='flex justify-between items-center'>
              <Label htmlFor='broadcast-text' className='text-xs font-semibold'>
                Editable Community Message Text (WhatsApp Formatted)
              </Label>
              <div className='flex items-center gap-2'>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-6 text-[11px] gap-1 px-1.5 text-muted-foreground hover:text-foreground'
                  onClick={handleResetTemplate}
                >
                  <RotateCcw className='h-3 w-3' />
                  Reset
                </Button>
                <span className='text-[10px] font-mono text-muted-foreground'>
                  {editableMessage.length} chars
                </span>
              </div>
            </div>
            <Textarea
              id='broadcast-text'
              value={editableMessage}
              onChange={(e) => setEditableMessage(e.target.value)}
              rows={15}
              className='font-mono text-xs leading-relaxed resize-y bg-background'
              placeholder='Community due reminder message...'
            />
            <p className='text-[10px] text-muted-foreground'>
              You can edit any student's line, change wording, or add custom announcements before forwarding.
            </p>
          </div>

          {/* PRINTABLE NOTICE FOR PHYSICAL LIBRARY BOARD */}
          <div id='printable-notice-board' className='hidden print:block space-y-5 text-black p-4'>
            <div className='border-b-2 pb-4 text-center space-y-1'>
              <h2 className='text-2xl font-bold uppercase'>VERTICAL CLASSES LIBRARY</h2>
              <p className='text-sm font-semibold text-muted-foreground'>OFFICIAL NOTICE - OUTSTANDING FEE DUES LIST</p>
              <p className='text-xs'>Date: {new Date().toLocaleDateString('en-IN')}</p>
            </div>

            <table className='w-full text-xs text-left border'>
              <thead className='bg-gray-100 border-b font-bold'>
                <tr>
                  <th className='p-2'>#</th>
                  <th className='p-2'>Student Name</th>
                  <th className='p-2'>Registration No</th>
                  <th className='p-2'>Desk</th>
                  <th className='p-2'>Shift</th>
                  <th className='p-2 text-right'>Balance Due (₹)</th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                {students.map((s, i) => (
                  <tr key={s.id}>
                    <td className='p-2 font-mono'>{i + 1}</td>
                    <td className='p-2 font-bold'>{s.fullName}</td>
                    <td className='p-2 font-mono'>{s.regNo}</td>
                    <td className='p-2'>{s.seatNumber || 'Unassigned'}</td>
                    <td className='p-2 capitalize'>{s.shift}</td>
                    <td className='p-2 text-right font-bold'>₹{s.amountDue.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className='flex justify-between items-center text-sm font-bold pt-2 border-t'>
              <span>Total Outstanding Sum:</span>
              <span>₹{totalDueSum.toLocaleString('en-IN')}</span>
            </div>

            <div className='text-xs pt-4 space-y-1 text-gray-600'>
              <p>• Please deposit pending dues at the front desk or via UPI ({upiId}) by {deadlineDate}.</p>
              <p>• Library Management - Vertical Classes Library</p>
            </div>
          </div>

          {/* Action Footer */}
          <div className='pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t print:hidden'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => onOpenChange(false)}
              className='w-full sm:w-auto'
            >
              Close
            </Button>

            <div className='flex items-center gap-2 w-full sm:w-auto'>
              <Button
                variant='outline'
                size='sm'
                onClick={handleCopyText}
                className='gap-1.5 w-full sm:w-auto'
              >
                {copied ? <Check className='h-3.5 w-3.5 text-emerald-600' /> : <Copy className='h-3.5 w-3.5' />}
                {copied ? 'Copied' : 'Copy Message'}
              </Button>

              <Button
                size='sm'
                className='gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold w-full sm:w-auto shadow-xs'
                onClick={handleForwardToWhatsAppGroup}
              >
                <svg className='h-4 w-4 fill-current' viewBox='0 0 24 24'>
                  <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' />
                </svg>
                <span>Forward to Community Group</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
