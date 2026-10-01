import { useState, useMemo } from 'react'
import {
  Search,
  IndianRupee,
  AlertTriangle,
  Users,
  CheckSquare,
  Square,
  Phone,
  Armchair,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Student, FeeTransaction } from '../types'
import { SHIFT_DETAILS } from '../data/mock-data'
import { useStudyLoungeStore } from '../store/study-lounge-store'
import {
  buildIndividualDueReminderMessage,
  getWhatsAppShareUrl,
  cleanWhatsAppPhone,
} from '../lib/receipt-utils'
import { BroadcastDueDialog } from './broadcast-due-dialog'
import { CollectFeeDialog } from './collect-fee-dialog'
import { FeeReceiptDialog } from './fee-receipt-dialog'

export function DefaultersManagement() {
  const students = useStudyLoungeStore((s) => s.students)

  // Students who haven't paid full fees (amountDue > 0)
  const unpaidStudents = useMemo(() => {
    return students.filter((s) => s.amountDue > 0)
  }, [students])

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [shiftFilter, setShiftFilter] = useState('all')
  const [dueRangeFilter, setDueRangeFilter] = useState('all')

  // Selection for Broadcast
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Modal dialog states
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [selectedStudentForCollect, setSelectedStudentForCollect] = useState<Student | null>(null)
  const [collectOpen, setCollectOpen] = useState(false)
  const [receiptTxn, setReceiptTxn] = useState<FeeTransaction | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)

  // Initialize selectedIds to all unpaid students when unpaid list changes
  useMemo(() => {
    setSelectedIds(unpaidStudents.map((s) => s.id))
  }, [unpaidStudents])

  // Filtered unpaid students
  const filteredUnpaidStudents = useMemo(() => {
    return unpaidStudents.filter((student) => {
      const matchSearch =
        student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.regNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.phone.includes(searchQuery) ||
        student.seatNumber.toLowerCase().includes(searchQuery.toLowerCase())

      const matchShift =
        shiftFilter === 'all' || student.shift === shiftFilter

      const matchDue =
        dueRangeFilter === 'all' ||
        (dueRangeFilter === 'high' && student.amountDue >= 1000) ||
        (dueRangeFilter === 'low' && student.amountDue < 1000)

      return matchSearch && matchShift && matchDue
    })
  }, [unpaidStudents, searchQuery, shiftFilter, dueRangeFilter])

  // Selected student objects
  const selectedStudents = useMemo(() => {
    return unpaidStudents.filter((s) => selectedIds.includes(s.id))
  }, [unpaidStudents, selectedIds])

  // Stats
  const totalDueSum = useMemo(
    () => unpaidStudents.reduce((acc, s) => acc + s.amountDue, 0),
    [unpaidStudents]
  )
  const selectedDueSum = useMemo(
    () => selectedStudents.reduce((acc, s) => acc + s.amountDue, 0),
    [selectedStudents]
  )

  // Toggle selection
  const handleToggleStudent = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedIds.length === filteredUnpaidStudents.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredUnpaidStudents.map((s) => s.id))
    }
  }

  // Send 1-on-1 Reminder to student's personal WhatsApp
  const handleSendIndividualReminder = (student: Student) => {
    const msg = buildIndividualDueReminderMessage({ student })
    const url = getWhatsAppShareUrl(student.phone, msg)
    window.open(url, '_blank')
    toast.success(`Opening 1-on-1 WhatsApp reminder for ${student.fullName}!`)
  }

  return (
    <div className='space-y-4'>
      {/* Top Metric Cards */}
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between text-muted-foreground'>
              <span className='text-xs font-medium'>Pending Defaulters</span>
              <AlertTriangle className='h-4 w-4 text-destructive' />
            </div>
            <div className='mt-2'>
              <h3 className='text-2xl font-bold text-destructive'>
                {unpaidStudents.length} Students
              </h3>
              <p className='text-xs text-muted-foreground mt-0.5'>
                {Math.round(((unpaidStudents.length || 0) / (students.length || 1)) * 100)}% of members
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between text-muted-foreground'>
              <span className='text-xs font-medium'>Total Dues Unpaid</span>
              <IndianRupee className='h-4 w-4 text-destructive' />
            </div>
            <div className='mt-2'>
              <h3 className='text-2xl font-bold text-destructive'>
                ₹{totalDueSum.toLocaleString('en-IN')}
              </h3>
              <p className='text-xs text-muted-foreground mt-0.5'>
                Pending collection
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between text-muted-foreground'>
              <span className='text-xs font-medium'>Selected for Broadcast</span>
              <CheckSquare className='h-4 w-4 text-primary' />
            </div>
            <div className='mt-2'>
              <h3 className='text-2xl font-bold text-foreground'>
                {selectedStudents.length} Students
              </h3>
              <p className='text-xs text-muted-foreground mt-0.5'>
                ₹{selectedDueSum.toLocaleString('en-IN')} total due
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between text-muted-foreground'>
              <span className='text-xs font-medium'>Average Due</span>
              <Clock className='h-4 w-4 text-amber-500' />
            </div>
            <div className='mt-2'>
              <h3 className='text-2xl font-bold text-amber-600 dark:text-amber-400'>
                ₹{unpaidStudents.length > 0 ? Math.round(totalDueSum / unpaidStudents.length).toLocaleString('en-IN') : 0}
              </h3>
              <p className='text-xs text-muted-foreground mt-0.5'>
                Per unpaid student
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card with Filter & Broadcast Toolbar */}
      <Card>
        <CardContent className='p-4 sm:p-5 space-y-4'>
          {/* Action Header Ribbon */}
          <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-3'>
            <div className='space-y-1'>
              <h3 className='font-bold text-base flex items-center gap-2'>
                <Users className='h-5 w-5 text-destructive' />
                Students With Pending Dues
              </h3>
              <p className='text-xs text-muted-foreground'>
                Select students to format and forward a unified due reminder list to your WhatsApp Community Group.
              </p>
            </div>

            {/* Broadcast Button */}
            <div className='flex flex-wrap items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={handleSelectAll}
                className='text-xs h-9'
              >
                {selectedIds.length === filteredUnpaidStudents.length && filteredUnpaidStudents.length > 0 ? (
                  <>
                    <Square className='h-3.5 w-3.5 mr-1.5' />
                    Deselect All
                  </>
                ) : (
                  <>
                    <CheckSquare className='h-3.5 w-3.5 mr-1.5' />
                    Select All ({filteredUnpaidStudents.length})
                  </>
                )}
              </Button>

              <Button
                size='sm'
                className='gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold shadow-xs h-9'
                disabled={selectedStudents.length === 0}
                onClick={() => setBroadcastOpen(true)}
              >
                <svg className='h-4 w-4 fill-current' viewBox='0 0 24 24'>
                  <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' />
                </svg>
                <span>Broadcast Reminder ({selectedStudents.length})</span>
              </Button>
            </div>
          </div>

          {/* Search & Filters Toolbar */}
          <div className='flex flex-col sm:flex-row sm:items-center gap-2.5'>
            <div className='relative flex-1'>
              <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search by student name, phone, reg no, desk...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-8 h-9 text-xs'
              />
            </div>

            <Select value={shiftFilter} onValueChange={setShiftFilter}>
              <SelectTrigger className='w-full sm:w-[150px] h-9 text-xs'>
                <SelectValue placeholder='Filter by Shift' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Shifts</SelectItem>
                <SelectItem value='morning'>Morning Slot</SelectItem>
                <SelectItem value='afternoon'>Afternoon Slot</SelectItem>
                <SelectItem value='evening'>Evening Slot</SelectItem>
                <SelectItem value='night'>Night Owl Slot</SelectItem>
                <SelectItem value='fullday'>Full Day</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dueRangeFilter} onValueChange={setDueRangeFilter}>
              <SelectTrigger className='w-full sm:w-[150px] h-9 text-xs'>
                <SelectValue placeholder='Due Amount' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Due Amounts</SelectItem>
                <SelectItem value='high'>High Priority (≥ ₹1,000)</SelectItem>
                <SelectItem value='low'>Low Due (&lt; ₹1,000)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className='rounded-md border bg-card overflow-hidden'>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm text-left'>
                <thead className='bg-muted/60 border-b text-xs uppercase text-muted-foreground'>
                  <tr>
                    <th className='py-3 px-3 w-10 text-center'>
                      <input
                        type='checkbox'
                        checked={
                          selectedIds.length === filteredUnpaidStudents.length &&
                          filteredUnpaidStudents.length > 0
                        }
                        onChange={handleSelectAll}
                        className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary'
                      />
                    </th>
                    <th className='py-3 px-3'>Student Profile</th>
                    <th className='py-3 px-3'>Desk & Shift</th>
                    <th className='py-3 px-3'>Plan & Total Fee</th>
                    <th className='py-3 px-3'>Paid to Date</th>
                    <th className='py-3 px-3'>Outstanding Due</th>
                    <th className='py-3 px-3'>Status</th>
                    <th className='py-3 px-3 text-right'>Action</th>
                  </tr>
                </thead>
                <tbody className='divide-y'>
                  {filteredUnpaidStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className='py-12 text-center text-muted-foreground'>
                        <div className='flex flex-col items-center justify-center space-y-2'>
                          <div className='rounded-full bg-emerald-500/10 p-3 text-emerald-600'>
                            <CheckCircle2 className='h-6 w-6' />
                          </div>
                          <span className='font-semibold text-base text-foreground'>
                            No pending fee defaulters!
                          </span>
                          <p className='text-xs text-muted-foreground max-w-sm'>
                            All students have cleared their fees, or no records matched your filter criteria.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUnpaidStudents.map((student) => {
                      const isSelected = selectedIds.includes(student.id)
                      const shiftInfo = SHIFT_DETAILS[student.shift] || { label: student.shift, timing: '' }

                      return (
                        <tr
                          key={student.id}
                          className={`hover:bg-muted/40 transition-colors ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className='py-3 px-3 text-center'>
                            <input
                              type='checkbox'
                              checked={isSelected}
                              onChange={() => handleToggleStudent(student.id)}
                              className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer'
                            />
                          </td>

                          {/* Student Profile */}
                          <td className='py-3 px-3'>
                            <div className='font-bold text-foreground'>{student.fullName}</div>
                            <div className='text-xs font-mono text-muted-foreground flex items-center gap-1.5'>
                              <span>{student.regNo}</span>
                              <span>•</span>
                              <span className='flex items-center gap-1 text-emerald-600 dark:text-emerald-400'>
                                <Phone className='h-3 w-3' />
                                {student.phone}
                              </span>
                            </div>
                          </td>

                          {/* Desk & Shift */}
                          <td className='py-3 px-3'>
                            <div className='font-medium text-foreground flex items-center gap-1 text-xs'>
                              <Armchair className='h-3.5 w-3.5 text-primary' />
                              <span>{student.seatNumber || 'Unassigned'}</span>
                              <span className='text-[10px] text-muted-foreground capitalize'>
                                ({student.seatType})
                              </span>
                            </div>
                            <span className='text-xs text-muted-foreground block mt-0.5'>
                              {shiftInfo.label}
                            </span>
                          </td>

                          {/* Plan & Total */}
                          <td className='py-3 px-3'>
                            <div className='font-medium capitalize text-xs'>
                              {student.membershipPlan.replace('_', ' ')}
                            </div>
                            <span className='text-xs text-muted-foreground'>
                              ₹{student.planAmount.toLocaleString('en-IN')}
                            </span>
                          </td>

                          {/* Paid To Date */}
                          <td className='py-3 px-3 font-semibold text-emerald-600 text-xs'>
                            ₹{student.amountPaid.toLocaleString('en-IN')}
                          </td>

                          {/* Balance Due */}
                          <td className='py-3 px-3'>
                            <span className='font-extrabold text-destructive text-sm bg-destructive/10 px-2 py-0.5 rounded'>
                              ₹{student.amountDue.toLocaleString('en-IN')}
                            </span>
                          </td>

                          {/* Status */}
                          <td className='py-3 px-3'>
                            <Badge
                              variant={student.paymentStatus === 'partial' ? 'secondary' : 'destructive'}
                              className='capitalize text-[11px]'
                            >
                              {student.paymentStatus === 'partial' ? 'Partial Due' : 'Unpaid'}
                            </Badge>
                          </td>

                          {/* Actions */}
                          <td className='py-3 px-3 text-right'>
                            <div className='flex items-center justify-end gap-1.5'>
                              {/* 1-on-1 Personal WhatsApp Reminder */}
                              <Button
                                size='sm'
                                variant='outline'
                                className='h-8 gap-1 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950'
                                onClick={() => handleSendIndividualReminder(student)}
                                title={`Send 1-on-1 personal reminder to ${student.fullName}`}
                              >
                                <svg className='h-3.5 w-3.5 fill-current' viewBox='0 0 24 24'>
                                  <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' />
                                </svg>
                                <span>Remind</span>
                              </Button>

                              {/* Collect Fee */}
                              <Button
                                size='sm'
                                className='h-8 gap-1 text-xs'
                                onClick={() => {
                                  setSelectedStudentForCollect(student)
                                  setCollectOpen(true)
                                }}
                              >
                                <IndianRupee className='h-3.5 w-3.5' />
                                <span>Collect</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Broadcast Due Dialog */}
      <BroadcastDueDialog
        open={broadcastOpen}
        onOpenChange={setBroadcastOpen}
        students={selectedStudents}
      />

      {/* Collect Fee Modal */}
      <CollectFeeDialog
        student={selectedStudentForCollect}
        open={collectOpen}
        onOpenChange={setCollectOpen}
        onSuccessReceipt={(txn) => {
          setReceiptTxn(txn)
          setReceiptOpen(true)
        }}
      />

      {/* Fee Receipt Dialog */}
      <FeeReceiptDialog
        transaction={receiptTxn}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
      />
    </div>
  )
}
