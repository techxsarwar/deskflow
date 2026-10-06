import { useState, useMemo } from 'react'
import {
  Search,
  Plus,
  Share2,
  MoreHorizontal,
  Eye,
  IndianRupee,
  Edit,
  Trash2,
  CheckCircle2,
  Armchair,
  Clock,
  AlertTriangle,
  RefreshCw,
  XCircle,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Student, FeeTransaction } from '../types'
import { SHIFT_DETAILS } from '../data/mock-data'
import { useStudyLoungeStore } from '../store/study-lounge-store'
import { getMembershipLifecycle } from '../lib/membership-utils'
import { StudentDetailsDialog } from './student-details-dialog'
import { StudentFormDialog } from './student-form-dialog'
import { CollectFeeDialog } from './collect-fee-dialog'
import { FeeReceiptDialog } from './fee-receipt-dialog'
import { ShareLinkDialog } from './share-link-dialog'
import { RenewMembershipDialog } from './renew-membership-dialog'
import { StudentMonthlyReportDialog } from './student-monthly-report-dialog'

export function StudentsTable() {
  const students = useStudyLoungeStore((s) => s.students)
  const deleteStudent = useStudyLoungeStore((s) => s.deleteStudent)
  const approveStudent = useStudyLoungeStore((s) => s.approveStudent)
  const rejectStudent = useStudyLoungeStore((s) => s.rejectStudent)
  const releaseExpiredSeat = useStudyLoungeStore((s) => s.releaseExpiredSeat)
  const autoReleaseAllExpiredSeats = useStudyLoungeStore((s) => s.autoReleaseAllExpiredSeats)

  const [searchQuery, setSearchQuery] = useState('')
  const [shiftFilter, setShiftFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')

  // Modals state
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [collectFeeOpen, setCollectFeeOpen] = useState(false)
  const [shareLinkOpen, setShareLinkOpen] = useState(false)
  const [renewStudent, setRenewStudent] = useState<Student | null>(null)
  const [renewOpen, setRenewOpen] = useState(false)
  const [receiptTxn, setReceiptTxn] = useState<FeeTransaction | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptDefaultTab, setReceiptDefaultTab] = useState<'receipt' | 'whatsapp'>('receipt')
  const [monthlyReportOpen, setMonthlyReportOpen] = useState(false)

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.phone.includes(searchQuery) ||
        student.regNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.seatNumber.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesShift =
        shiftFilter === 'all' || student.shift === shiftFilter

      const matchesStatus =
        statusFilter === 'all' || student.status === statusFilter

      const matchesPayment =
        paymentFilter === 'all' || student.paymentStatus === paymentFilter

      return matchesSearch && matchesShift && matchesStatus && matchesPayment
    })
  }, [students, searchQuery, shiftFilter, statusFilter, paymentFilter])

  // Stats
  const activeCount = students.filter((s) => s.status === 'active').length
  const pendingCount = students.filter((s) => s.status === 'pending').length
  const totalDues = students.reduce((acc, s) => acc + s.amountDue, 0)

  // Expired students holding a desk past grace period
  const expiredWithSeatsCount = useMemo(() => {
    return students.filter((s) => {
      if (!s.seatNumber || s.seatNumber === 'Unassigned') return false
      const lc = getMembershipLifecycle(s)
      return lc.isEligibleForRelease
    }).length
  }, [students])

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name}?`)) {
      deleteStudent(id)
      toast.success(`${name} has been removed`)
    }
  }

  const handleApprove = (student: Student) => {
    approveStudent(student.id)
    toast.success(`${student.fullName}'s registration has been approved!`)
  }

  const handleReject = (student: Student) => {
    if (
      confirm(
        `Reject online admission application for ${student.fullName}? Any reserved desk (${student.seatNumber}) will be freed immediately.`
      )
    ) {
      rejectStudent(student.id)
      toast.info(`Application for ${student.fullName} rejected. Desk is now vacant.`)
    }
  }

  const handleReleaseSeat = (student: Student) => {
    if (
      confirm(
        `Release desk ${student.seatNumber} occupied by ${student.fullName}? The desk will be made available for new students.`
      )
    ) {
      releaseExpiredSeat(student.id)
      toast.success(`Desk ${student.seatNumber} released and marked available.`)
    }
  }

  const handleCollectFee = (student: Student) => {
    setSelectedStudent(student)
    setCollectFeeOpen(true)
  }

  return (
    <div className='space-y-4'>
      {/* Top Stat Cards */}
      <div className='grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3'>
        <Card>
          <CardContent className='p-4'>
            <p className='text-xs font-medium text-muted-foreground'>Total Enrolled</p>
            <div className='mt-1 flex items-baseline justify-between'>
              <h3 className='text-2xl font-bold'>{students.length}</h3>
              <Badge variant='outline'>{activeCount} Active</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <p className='text-xs font-medium text-muted-foreground'>Pending Approvals</p>
            <div className='mt-1 flex items-baseline justify-between'>
              <h3 className={`text-2xl font-bold ${pendingCount > 0 ? 'text-amber-500' : ''}`}>
                {pendingCount}
              </h3>
              {pendingCount > 0 ? (
                <Badge variant='destructive' className='animate-pulse'>Action needed</Badge>
              ) : (
                <Badge variant='secondary'>All approved</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <p className='text-xs font-medium text-muted-foreground'>Pending Dues</p>
            <div className='mt-1 flex items-baseline justify-between'>
              <h3 className='text-2xl font-bold text-destructive'>
                ₹{totalDues.toLocaleString('en-IN')}
              </h3>
              <Badge variant='outline' className='text-destructive border-destructive/30'>
                {students.filter((s) => s.amountDue > 0).length} Students
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card className='bg-primary/5 border-primary/20'>
          <CardContent className='p-4 flex flex-col justify-between h-full'>
            <p className='text-xs font-semibold text-primary uppercase tracking-wider'>
              Online Registration
            </p>
            <Button
              size='sm'
              className='mt-2 w-full gap-1.5 shadow-sm'
              onClick={() => setShareLinkOpen(true)}
            >
              <Share2 className='h-3.5 w-3.5' />
              Share Admission Link
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Pending Online Admissions Banner */}
      {pendingCount > 0 && (
        <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'>
          <div className='flex items-center gap-2.5'>
            <div className='p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400'>
              <AlertTriangle className='h-5 w-5' />
            </div>
            <div>
              <span className='font-bold text-xs sm:text-sm block'>
                {pendingCount} Online Admission Application{pendingCount > 1 ? 's' : ''} Pending Front-Desk Approval
              </span>
              <p className='text-[11px] text-muted-foreground'>
                Students have pre-booked a dedicated 24/7 desk online. Verify their admission & collect fee at reception to activate.
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              size='sm'
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              className='text-xs h-8 border-amber-500/40 text-amber-800 dark:text-amber-200'
              onClick={() =>
                setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')
              }
            >
              {statusFilter === 'pending' ? 'Show All Students' : `Filter Pending (${pendingCount})`}
            </Button>
          </div>
        </div>
      )}

      {/* Expired Desks Auto-Release Banner */}
      {expiredWithSeatsCount > 0 && (
        <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200 text-xs'>
          <div className='flex items-center gap-2'>
            <Clock className='h-4 w-4 text-red-600 shrink-0' />
            <span>
              <strong>{expiredWithSeatsCount} student(s)</strong> have memberships past the grace period while holding a dedicated desk.
            </span>
          </div>
          <Button
            size='sm'
            variant='outline'
            className='h-7 text-xs border-red-500/40 text-red-600 hover:bg-red-500/20 gap-1'
            onClick={() => {
              const res = autoReleaseAllExpiredSeats(2)
              toast.success(
                `Freed ${res.releasedCount} expired desk(s): ${res.releasedSeats.join(', ')}`
              )
            }}
          >
            Release {expiredWithSeatsCount} Expired Desk{expiredWithSeatsCount > 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {/* Action Controls & Filters */}
      <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex flex-1 flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2'>
          <div className='relative flex-1 min-w-[180px]'>
            <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search by name, phone, desk...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-8 h-9 text-xs sm:text-sm'
            />
          </div>

          <div className='grid grid-cols-1 min-[420px]:grid-cols-3 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto'>
            <Select value={shiftFilter} onValueChange={setShiftFilter}>
              <SelectTrigger className='w-full sm:w-[130px] h-9 text-xs'>
                <SelectValue placeholder='Shift' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Shifts</SelectItem>
                <SelectItem value='morning'>Morning</SelectItem>
                <SelectItem value='afternoon'>Afternoon</SelectItem>
                <SelectItem value='evening'>Evening</SelectItem>
                <SelectItem value='night'>Night</SelectItem>
                <SelectItem value='fullday'>Full Day</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className='w-full sm:w-[130px] h-9 text-xs'>
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Status</SelectItem>
                <SelectItem value='active'>Active</SelectItem>
                <SelectItem value='pending'>Pending</SelectItem>
                <SelectItem value='expired'>Expired</SelectItem>
              </SelectContent>
            </Select>

            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className='w-full sm:w-[130px] h-9 text-xs'>
                <SelectValue placeholder='Fee Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Fees</SelectItem>
                <SelectItem value='paid'>Fully Paid</SelectItem>
                <SelectItem value='partial'>Partial Due</SelectItem>
                <SelectItem value='pending'>Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className='flex items-center gap-2 w-full lg:w-auto'>
          <Button
            variant='outline'
            className='gap-1.5 flex-1 lg:flex-initial h-9 text-xs sm:text-sm'
            onClick={() => setShareLinkOpen(true)}
          >
            <Share2 className='h-4 w-4 text-primary' />
            Share Link
          </Button>
          <Button
            className='gap-1.5 flex-1 lg:flex-initial h-9 text-xs sm:text-sm'
            onClick={() => {
              setEditingStudent(null)
              setFormOpen(true)
            }}
          >
            <Plus className='h-4 w-4' />
            Enroll Student
          </Button>
        </div>
      </div>

      {/* Students Data Table */}
      <div className='rounded-md border bg-card shadow-xs'>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm text-left border-collapse'>
            <thead className='bg-muted/50 border-b text-xs uppercase text-muted-foreground'>
              <tr>
                <th className='py-3 px-4 min-w-[200px] whitespace-nowrap'>Student</th>
                <th className='py-3 px-4 min-w-[140px] whitespace-nowrap'>Slot & Desk</th>
                <th className='py-3 px-4 min-w-[150px] whitespace-nowrap'>Contact & Goal</th>
                <th className='py-3 px-4 min-w-[160px] whitespace-nowrap'>Membership & Validity</th>
                <th className='py-3 px-4 min-w-[120px] whitespace-nowrap'>Fee Status</th>
                <th className='py-3 px-4 min-w-[100px] whitespace-nowrap'>Status</th>
                <th className='py-3 px-4 min-w-[80px] text-right whitespace-nowrap sticky right-0 bg-muted/95 backdrop-blur-xs z-10 border-l border-border/40 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]'>Actions</th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className='py-8 text-center text-muted-foreground'>
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const shift = SHIFT_DETAILS[student.shift] || {
                    label: student.shift,
                    badgeColor: 'bg-muted text-muted-foreground',
                  }
                  return (
                    <tr
                      key={student.id}
                      className='group hover:bg-muted/40 transition-colors cursor-pointer'
                      onClick={() => {
                        setSelectedStudent(student)
                        setDetailsOpen(true)
                      }}
                    >
                      {/* Student info */}
                      <td className='py-3 px-4'>
                        <div className='flex items-center gap-3'>
                          {student.photoUrl ? (
                            <img
                              src={student.photoUrl}
                              alt={student.fullName}
                              className='h-9 w-9 shrink-0 rounded-full object-cover border border-border/50 shadow-2xs'
                            />
                          ) : (
                            <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary'>
                              {student.fullName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className='font-semibold text-foreground block'>
                              {student.fullName}
                            </span>
                            <span className='text-xs font-mono text-muted-foreground'>
                              {student.regNo}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Slot & Desk */}
                      <td className='py-3 px-4'>
                        <div className='space-y-1'>
                          <span
                            className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${shift.badgeColor}`}
                          >
                            {shift.label}
                          </span>
                          <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                            <Armchair className='h-3 w-3' />
                            <span>Desk: <strong>{student.seatNumber || 'Unassigned'}</strong></span>
                            {student.lockerNumber && (
                              <span className='ms-1 text-[11px] text-muted-foreground'>
                                • {student.lockerNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact & Goal */}
                      <td className='py-3 px-4'>
                        <div>
                          <span className='text-xs font-medium block truncate max-w-[170px]'>
                            {student.studyGoal}
                          </span>
                          <span className='text-xs text-muted-foreground font-mono'>
                            {student.phone}
                          </span>
                        </div>
                      </td>

                      {/* Membership & Validity */}
                      <td className='py-3 px-4'>
                        {(() => {
                          const lifecycle = getMembershipLifecycle(student)
                          return (
                            <div className='space-y-1'>
                              <span className='text-xs font-semibold capitalize block'>
                                {student.membershipPlan.replace('_', ' ')}
                              </span>
                              <span
                                className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${lifecycle.badgeColor}`}
                              >
                                {lifecycle.label}
                              </span>
                              <span className='block text-[10px] text-muted-foreground'>
                                Exp: {student.endDate}
                              </span>
                            </div>
                          )
                        })()}
                      </td>

                      {/* Fee Status */}
                      <td className='py-3 px-4'>
                        <div>
                          <Badge
                            variant={
                              student.paymentStatus === 'paid'
                                ? 'default'
                                : student.paymentStatus === 'partial'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                            className='capitalize text-[11px]'
                          >
                            {student.paymentStatus}
                          </Badge>
                          {student.amountDue > 0 ? (
                            <span className='block text-xs font-medium text-destructive mt-0.5'>
                              Due: ₹{student.amountDue.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className='block text-xs text-emerald-600 mt-0.5'>
                              ₹{student.amountPaid.toLocaleString('en-IN')} Paid
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className='py-3 px-4'>
                        <div className='space-y-1'>
                          <Badge
                            variant={
                              student.status === 'active'
                                ? 'default'
                                : student.status === 'pending'
                                  ? 'outline'
                                  : 'secondary'
                            }
                            className={
                              student.status === 'pending'
                                ? 'border-amber-500 text-amber-600 bg-amber-500/10'
                                : ''
                            }
                          >
                            {student.status === 'pending' ? 'Needs Approval' : student.status}
                          </Badge>
                          {student.registeredVia === 'online_link' && (
                            <span className='block text-[10px] text-blue-500 font-medium'>
                              Online Admission
                            </span>
                          )}
                          {student.status === 'pending' && (
                            <div className='pt-1'>
                              <Button
                                size='sm'
                                variant='outline'
                                className='h-6 text-[10px] px-2 text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10'
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCollectFee(student)
                                }}
                              >
                                Verify & Pay
                              </Button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td
                        className='py-3 px-4 text-right sticky right-0 bg-card group-hover:bg-muted/40 z-10 border-l border-border/40 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] transition-colors'
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon' className='h-8 w-8'>
                              <MoreHorizontal className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end' className='w-52'>
                            <DropdownMenuLabel>Student Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedStudent(student)
                                setDetailsOpen(true)
                              }}
                            >
                              <Eye className='mr-2 h-4 w-4' /> View Profile & ID
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedStudent(student)
                                setMonthlyReportOpen(true)
                              }}
                              className='text-primary font-medium'
                            >
                              <FileText className='mr-2 h-4 w-4 text-primary' /> Monthly Audit PDF
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => {
                                setRenewStudent(student)
                                setRenewOpen(true)
                              }}
                              className='text-primary font-semibold'
                            >
                              <RefreshCw className='mr-2 h-4 w-4 text-primary' /> Renew (+1 Month)
                            </DropdownMenuItem>

                            {student.status === 'pending' ? (
                              <>
                                <DropdownMenuItem
                                  className='text-emerald-600 font-semibold'
                                  onClick={() => handleCollectFee(student)}
                                >
                                  <CheckCircle2 className='mr-2 h-4 w-4' /> Verify & Collect Fee
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className='text-destructive'
                                  onClick={() => handleReject(student)}
                                >
                                  <XCircle className='mr-2 h-4 w-4' /> Reject Application
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleCollectFee(student)}
                              >
                                <IndianRupee className='mr-2 h-4 w-4' /> Collect Fee
                              </DropdownMenuItem>
                            )}

                            {(() => {
                              const lc = getMembershipLifecycle(student)
                              if (!lc.isEligibleForRelease) return null
                              return (
                                <DropdownMenuItem
                                  className='text-amber-600 font-medium'
                                  onClick={() => handleReleaseSeat(student)}
                                >
                                  <Armchair className='mr-2 h-4 w-4' /> Release Desk (Overdue)
                                </DropdownMenuItem>
                              )
                            })()}

                            <DropdownMenuItem
                              onClick={() => {
                                setEditingStudent(student)
                                setFormOpen(true)
                              }}
                            >
                              <Edit className='mr-2 h-4 w-4' /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className='text-destructive'
                              onClick={() => handleDelete(student.id, student.fullName)}
                            >
                              <Trash2 className='mr-2 h-4 w-4' /> Remove Student
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals & Dialogs */}
      <StudentDetailsDialog
        student={selectedStudent}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onCollectFee={handleCollectFee}
        onApprove={handleApprove}
        onRenew={(s) => {
          setRenewStudent(s)
          setRenewOpen(true)
        }}
        onReleaseSeat={(s) => handleReleaseSeat(s)}
        onOpenMonthlyReport={(s) => {
          setSelectedStudent(s)
          setMonthlyReportOpen(true)
        }}
      />

      <RenewMembershipDialog
        student={renewStudent}
        open={renewOpen}
        onOpenChange={setRenewOpen}
      />

      <StudentFormDialog
        student={editingStudent}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <CollectFeeDialog
        student={selectedStudent}
        open={collectFeeOpen}
        onOpenChange={setCollectFeeOpen}
        onSuccessReceipt={(txn, openWhatsAppTab) => {
          setReceiptTxn(txn)
          setReceiptDefaultTab(openWhatsAppTab ? 'whatsapp' : 'receipt')
          setReceiptOpen(true)
        }}
      />

      <FeeReceiptDialog
        transaction={receiptTxn}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        defaultTab={receiptDefaultTab}
      />

      <ShareLinkDialog
        open={shareLinkOpen}
        onOpenChange={setShareLinkOpen}
      />

      <StudentMonthlyReportDialog
        student={selectedStudent}
        open={monthlyReportOpen}
        onOpenChange={setMonthlyReportOpen}
      />
    </div>
  )
}
