import { useState, useMemo } from 'react'
import {
  Search,
  IndianRupee,
  Receipt,
  Printer,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Student, FeeTransaction } from '../types'
import { useStudyLoungeStore } from '../store/study-lounge-store'
import { CollectFeeDialog } from './collect-fee-dialog'
import { FeeReceiptDialog } from './fee-receipt-dialog'
import { DefaultersManagement } from './defaulters-management'

export function FeesManagement() {
  const students = useStudyLoungeStore((s) => s.students)
  const transactions = useStudyLoungeStore((s) => s.transactions)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [collectOpen, setCollectOpen] = useState(false)
  const [receiptTxn, setReceiptTxn] = useState<FeeTransaction | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptDefaultTab, setReceiptDefaultTab] = useState<'receipt' | 'whatsapp'>('receipt')

  // Calculations
  const totalRevenue = useMemo(
    () => transactions.reduce((acc, t) => acc + t.amount, 0),
    [transactions]
  )

  const totalDues = useMemo(
    () => students.reduce((acc, s) => acc + s.amountDue, 0),
    [students]
  )

  const fullyPaidCount = students.filter((s) => s.paymentStatus === 'paid').length
  const pendingCount = students.filter(
    (s) => s.paymentStatus === 'partial' || s.paymentStatus === 'pending'
  ).length

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.regNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.phone.includes(searchQuery)

      const matchStatus =
        statusFilter === 'all' || s.paymentStatus === statusFilter

      return matchSearch && matchStatus
    })
  }, [students, searchQuery, statusFilter])

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      return (
        t.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.regNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })
  }, [transactions, searchQuery])

  return (
    <div className='space-y-4'>
      {/* Top Stat Overview Cards */}
      <div className='grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-3'>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between text-muted-foreground'>
              <span className='text-xs font-medium'>Total Collections</span>
              <IndianRupee className='h-4 w-4 text-emerald-600' />
            </div>
            <div className='mt-2'>
              <h3 className='text-2xl font-bold text-emerald-600'>
                ₹{totalRevenue.toLocaleString('en-IN')}
              </h3>
              <p className='text-xs text-muted-foreground mt-0.5'>
                {transactions.length} receipts generated
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between text-muted-foreground'>
              <span className='text-xs font-medium'>Outstanding Dues</span>
              <AlertCircle className='h-4 w-4 text-destructive' />
            </div>
            <div className='mt-2'>
              <h3 className='text-2xl font-bold text-destructive'>
                ₹{totalDues.toLocaleString('en-IN')}
              </h3>
              <p className='text-xs text-muted-foreground mt-0.5'>
                Across {pendingCount} students
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between text-muted-foreground'>
              <span className='text-xs font-medium'>Paid Members</span>
              <CheckCircle2 className='h-4 w-4 text-primary' />
            </div>
            <div className='mt-2'>
              <h3 className='text-2xl font-bold'>{fullyPaidCount}</h3>
              <p className='text-xs text-muted-foreground mt-0.5'>
                {Math.round((fullyPaidCount / (students.length || 1)) * 100)}% payment rate
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between text-muted-foreground'>
              <span className='text-xs font-medium'>Unpaid / Partial</span>
              <Clock className='h-4 w-4 text-amber-500' />
            </div>
            <div className='mt-2'>
              <h3 className='text-2xl font-bold text-amber-500'>{pendingCount}</h3>
              <p className='text-xs text-muted-foreground mt-0.5'>
                Follow up needed
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Student Fee Dues vs Transaction Receipts History */}
      <Tabs defaultValue='dues' className='space-y-4'>
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3'>
          <TabsList className='w-full lg:w-auto flex flex-wrap h-auto p-1 gap-1'>
            <TabsTrigger value='dues' className='flex-1 sm:flex-initial text-xs sm:text-sm py-1.5'>Student Fees</TabsTrigger>
            <TabsTrigger value='defaulters' className='flex-1 sm:flex-initial text-xs sm:text-sm py-1.5 gap-1.5'>
              <span>Defaulters & Broadcast</span>
              {pendingCount > 0 && (
                <Badge variant='destructive' className='text-[10px] py-0 px-1.5 h-4 font-mono'>
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value='receipts' className='flex-1 sm:flex-initial text-xs sm:text-sm py-1.5'>Receipts History</TabsTrigger>
          </TabsList>

          <div className='flex flex-col min-[480px]:flex-row items-stretch sm:items-center gap-2'>
            <div className='relative flex-1 sm:w-64'>
              <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search student, reg no...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-8 h-9 text-xs sm:text-sm'
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className='w-full min-[480px]:w-[130px] h-9 text-xs'>
                <SelectValue placeholder='Fee Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Status</SelectItem>
                <SelectItem value='paid'>Fully Paid</SelectItem>
                <SelectItem value='partial'>Partial Due</SelectItem>
                <SelectItem value='pending'>Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tab 1: Dues by Student */}
        <TabsContent value='dues' className='space-y-4'>
          <div className='rounded-md border bg-card'>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm text-left'>
                <thead className='bg-muted/50 border-b text-xs uppercase text-muted-foreground'>
                  <tr>
                    <th className='py-3 px-4 min-w-[170px] whitespace-nowrap'>Student</th>
                    <th className='py-3 px-4 min-w-[140px] whitespace-nowrap'>Membership Plan</th>
                    <th className='py-3 px-4 min-w-[100px] whitespace-nowrap'>Total Fee</th>
                    <th className='py-3 px-4 min-w-[110px] whitespace-nowrap'>Amount Paid</th>
                    <th className='py-3 px-4 min-w-[110px] whitespace-nowrap'>Balance Due</th>
                    <th className='py-3 px-4 min-w-[100px] whitespace-nowrap'>Status</th>
                    <th className='py-3 px-4 min-w-[90px] text-right whitespace-nowrap'>Action</th>
                  </tr>
                </thead>
                <tbody className='divide-y'>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className='py-8 text-center text-muted-foreground'>
                        No fee records found.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => (
                      <tr key={student.id} className='hover:bg-muted/40'>
                        <td className='py-3 px-4'>
                          <span className='font-semibold block'>{student.fullName}</span>
                          <span className='text-xs font-mono text-muted-foreground'>
                            {student.regNo} • {student.phone}
                          </span>
                        </td>
                        <td className='py-3 px-4 capitalize'>
                          {student.membershipPlan.replace('_', ' ')}
                        </td>
                        <td className='py-3 px-4 font-medium'>
                          ₹{student.planAmount.toLocaleString('en-IN')}
                        </td>
                        <td className='py-3 px-4 text-emerald-600 font-medium'>
                          ₹{student.amountPaid.toLocaleString('en-IN')}
                        </td>
                        <td className='py-3 px-4'>
                          <span
                            className={`font-bold ${
                              student.amountDue > 0 ? 'text-destructive' : 'text-muted-foreground'
                            }`}
                          >
                            ₹{student.amountDue.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className='py-3 px-4'>
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
                        </td>
                        <td className='py-3 px-4 text-right'>
                          {student.amountDue > 0 ? (
                            <Button
                              size='sm'
                              className='gap-1'
                              onClick={() => {
                                setSelectedStudent(student)
                                setCollectOpen(true)
                              }}
                            >
                              <IndianRupee className='h-3.5 w-3.5' />
                              Collect Fee
                            </Button>
                          ) : (
                            <Button
                              size='sm'
                              variant='outline'
                              className='gap-1 text-emerald-600'
                              onClick={() => {
                                // Find latest receipt for student
                                const txn = transactions.find((t) => t.studentId === student.id)
                                if (txn) {
                                  setReceiptTxn(txn)
                                  setReceiptOpen(true)
                                } else {
                                  setSelectedStudent(student)
                                  setCollectOpen(true)
                                }
                              }}
                            >
                              <Receipt className='h-3.5 w-3.5' />
                              Receipt
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Defaulters & Community Reminder Broadcast */}
        <TabsContent value='defaulters' className='space-y-4'>
          <DefaultersManagement />
        </TabsContent>

        {/* Tab 3: Transaction History */}
        <TabsContent value='receipts' className='space-y-4'>
          <div className='rounded-md border bg-card'>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm text-left'>
                <thead className='bg-muted/50 border-b text-xs uppercase text-muted-foreground'>
                  <tr>
                    <th className='py-3 px-4 min-w-[130px] whitespace-nowrap'>Receipt No.</th>
                    <th className='py-3 px-4 min-w-[110px] whitespace-nowrap'>Date</th>
                    <th className='py-3 px-4 min-w-[160px] whitespace-nowrap'>Student</th>
                    <th className='py-3 px-4 min-w-[90px] whitespace-nowrap'>Mode</th>
                    <th className='py-3 px-4 min-w-[110px] whitespace-nowrap'>Amount Paid</th>
                    <th className='py-3 px-4 min-w-[150px] whitespace-nowrap'>Remarks</th>
                    <th className='py-3 px-4 min-w-[90px] text-right whitespace-nowrap'>Action</th>
                  </tr>
                </thead>
                <tbody className='divide-y'>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className='py-8 text-center text-muted-foreground'>
                        No transaction receipts recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((txn) => (
                      <tr key={txn.id} className='hover:bg-muted/40'>
                        <td className='py-3 px-4 font-mono font-semibold text-primary'>
                          {txn.receiptNumber}
                        </td>
                        <td className='py-3 px-4 text-muted-foreground text-xs'>
                          <div className='font-medium text-foreground'>{txn.paymentDate}</div>
                          {txn.paymentTime && (
                            <div className='text-[10px] font-mono text-muted-foreground'>
                              {txn.paymentTime}
                            </div>
                          )}
                        </td>
                        <td className='py-3 px-4'>
                          <span className='font-medium block'>{txn.studentName}</span>
                          <span className='text-xs font-mono text-muted-foreground'>
                            {txn.regNo}
                          </span>
                        </td>
                        <td className='py-3 px-4'>
                          <Badge variant='outline' className='uppercase text-[10px] font-mono'>
                            {txn.paymentMode}
                          </Badge>
                        </td>
                        <td className='py-3 px-4 font-bold text-foreground'>
                          ₹{txn.amount.toLocaleString('en-IN')}
                        </td>
                        <td className='py-3 px-4 text-xs text-muted-foreground max-w-xs truncate'>
                          {txn.remarks || 'Standard membership fee'}
                        </td>
                        <td className='py-3 px-4 text-right'>
                          <div className='flex items-center justify-end gap-1.5'>
                            <Button
                              size='sm'
                              variant='outline'
                              className='gap-1 text-xs'
                              onClick={() => {
                                setReceiptTxn(txn)
                                setReceiptDefaultTab('receipt')
                                setReceiptOpen(true)
                              }}
                            >
                              <Printer className='h-3.5 w-3.5' />
                              Receipt / PDF
                            </Button>
                            <Button
                              size='sm'
                              className='gap-1 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs'
                              onClick={() => {
                                setReceiptTxn(txn)
                                setReceiptDefaultTab('whatsapp')
                                setReceiptOpen(true)
                              }}
                            >
                              <svg className='h-3 w-3 fill-current' viewBox='0 0 24 24'>
                                <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' />
                              </svg>
                              WhatsApp
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CollectFeeDialog
        student={selectedStudent}
        open={collectOpen}
        onOpenChange={setCollectOpen}
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
    </div>
  )
}
