import { useState, useEffect } from 'react'
import {
  FileText,
  Download,
  Send,
  Loader2,
  Calendar,
  Clock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Student } from '../types'
import { studyLoungeApi } from '../lib/api'

interface StudentMonthlyReportDialogProps {
  student: Student | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

export function StudentMonthlyReportDialog({
  student,
  open,
  onOpenChange,
}: StudentMonthlyReportDialogProps) {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState<string>(String(now.getFullYear()))
  const [selectedMonth, setSelectedMonth] = useState<string>(String(now.getMonth() + 1))
  const [sendToTelegram, setSendToTelegram] = useState(true)
  const [customChannelId, setCustomChannelId] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [isSendingTelegram, setIsSendingTelegram] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [pdfFilename, setPdfFilename] = useState<string>('')

  // Fetch report data when opened or month/year changes
  useEffect(() => {
    if (!open || !student) {
      setReportData(null)
      setPdfBase64(null)
      return
    }

    let isMounted = true
    async function loadReport() {
      setIsLoading(true)
      try {
        const res = await studyLoungeApi.generateMonthlyReport({
          studentId: student!.id,
          year: parseInt(selectedYear, 10),
          month: parseInt(selectedMonth, 10),
          sendToTelegram: false, // Don't auto-send on preview load
        })

        if (isMounted && res.success) {
          setReportData(res.reportData)
          setPdfBase64(res.pdfBase64 || null)
          setPdfFilename(res.filename || `Monthly_Report_${student!.fullName}_${selectedMonth}_${selectedYear}.pdf`)
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to generate monthly audit report'
          toast.error('Report Generation Error', { description: msg })
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadReport()
    return () => {
      isMounted = false
    }
  }, [open, student, selectedYear, selectedMonth])

  if (!student) return null

  // Handle local PDF download
  const handleDownloadPdf = () => {
    if (!pdfBase64) {
      toast.error('PDF is still generating, please wait a moment.')
      return
    }

    try {
      const byteCharacters = atob(pdfBase64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = pdfFilename || `Report_${student.fullName.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('📥 PDF Report Downloaded!', {
        description: `Saved as ${pdfFilename}`,
      })
    } catch (err) {
      toast.error('Failed to download PDF')
    }
  }

  // Handle dispatch to private Telegram channel
  const handleSendTelegram = async () => {
    setIsSendingTelegram(true)
    try {
      const res = await studyLoungeApi.generateMonthlyReport({
        studentId: student.id,
        year: parseInt(selectedYear, 10),
        month: parseInt(selectedMonth, 10),
        sendToTelegram: true,
        targetChatId: customChannelId.trim() || undefined,
      })

      if (res.telegramSent) {
        toast.success('🚀 Stored in Private Telegram Channel!', {
          description: `Audit PDF delivered to Telegram (Chat ID: ${res.telegramResult?.chatId || 'Configured Channel'}).`,
        })
      } else {
        toast.warning('PDF Generated', {
          description: res.telegramResult?.error || 'Telegram channel ID was not configured or bot lacks admin permissions.',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Telegram upload failed'
      toast.error('Upload Error', { description: msg })
    } finally {
      setIsSendingTelegram(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden'>
        {/* Header */}
        <div className='p-5 border-b bg-gradient-to-r from-primary/10 via-card to-background flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
          <div className='space-y-1'>
            <div className='flex items-center gap-2'>
              <FileText className='h-5 w-5 text-primary shrink-0' />
              <DialogTitle className='text-lg font-bold'>
                Student Monthly Attendance & Study Audit Report
              </DialogTitle>
            </div>
            <DialogDescription className='text-xs text-muted-foreground'>
              Official second-by-second study duration audit and private Telegram channel archiver.
            </DialogDescription>
          </div>

          <div className='flex items-center gap-2'>
            <Badge variant='outline' className='font-mono text-xs'>
              {student.seatNumber || 'Desk Unassigned'}
            </Badge>
            <Badge variant='secondary' className='uppercase text-xs'>
              {student.shift} Shift
            </Badge>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className='p-4 border-b bg-muted/30 flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-2'>
            <div className='flex items-center gap-1.5'>
              <Label className='text-xs font-semibold text-muted-foreground whitespace-nowrap'>
                Month:
              </Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className='h-8 w-32 text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value} className='text-xs'>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='flex items-center gap-1.5'>
              <Label className='text-xs font-semibold text-muted-foreground'>Year:</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className='h-8 w-24 text-xs font-mono'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='2025' className='text-xs font-mono'>2025</SelectItem>
                  <SelectItem value='2026' className='text-xs font-mono'>2026</SelectItem>
                  <SelectItem value='2027' className='text-xs font-mono'>2027</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <div className='flex items-center gap-2'>
              <Switch
                id='tg-store-toggle'
                checked={sendToTelegram}
                onCheckedChange={setSendToTelegram}
              />
              <Label htmlFor='tg-store-toggle' className='text-xs cursor-pointer select-none font-medium'>
                Private Telegram Archive
              </Label>
            </div>

            {sendToTelegram && (
              <Input
                placeholder='Channel ID (optional override)'
                value={customChannelId}
                onChange={(e) => setCustomChannelId(e.target.value)}
                className='h-8 w-44 text-xs font-mono'
              />
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className='flex-1 overflow-y-auto p-5 space-y-5'>
          {isLoading ? (
            <div className='py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground'>
              <Loader2 className='h-8 w-8 animate-spin text-primary' />
              <p className='text-sm font-medium'>Compiling attendance telemetry & seconds logs...</p>
            </div>
          ) : reportData ? (
            <>
              {/* Student Overview Strip */}
              <div className='rounded-xl border bg-card p-4 flex flex-wrap items-center justify-between gap-4'>
                <div className='flex items-center gap-3'>
                  <Avatar className='h-12 w-12 rounded-lg border'>
                    <AvatarImage src={student.photoUrl || reportData.student.photoUrl} alt={reportData.student.name} />
                    <AvatarFallback className='rounded-lg font-bold text-xs'>
                      {(reportData.student.name || 'ST')
                        .split(' ')
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className='font-bold text-base text-foreground'>{reportData.student.name}</h3>
                    <p className='text-xs text-muted-foreground font-mono'>
                      Roll: {reportData.student.id} • +91 {reportData.student.phone}
                    </p>
                  </div>
                </div>
                <div className='text-right'>
                  <p className='text-xs font-medium text-muted-foreground'>Audit Ref ID</p>
                  <p className='text-xs font-mono font-bold text-primary'>{reportData.period.reportId}</p>
                </div>
              </div>

              {/* Peer Benchmark Spotlight Banner */}
              {reportData.benchmark && (
                <div className='rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-wrap items-center justify-between gap-3'>
                  <div className='flex items-center gap-3'>
                    <Badge className='bg-primary text-primary-foreground font-bold text-xs py-1 px-2.5'>
                      {reportData.benchmark.tierBadge}
                    </Badge>
                    <div>
                      <p className='font-bold text-sm text-foreground'>{reportData.benchmark.headline}</p>
                      <p className='text-xs text-muted-foreground'>{reportData.benchmark.subline}</p>
                    </div>
                  </div>
                  <Badge variant='outline' className='font-mono text-xs font-semibold'>
                    Rank #{reportData.benchmark.rank} of {reportData.benchmark.totalStudents} Peers
                  </Badge>
                </div>
              )}

              {/* KPI Performance Cards */}
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                <Card className='border-primary/20 bg-primary/5 shadow-none'>
                  <CardContent className='p-3.5 space-y-1'>
                    <div className='flex items-center justify-between text-muted-foreground'>
                      <span className='text-[11px] font-semibold uppercase'>Total Net Study</span>
                      <Clock className='h-3.5 w-3.5 text-primary' />
                    </div>
                    <div className='text-lg font-bold text-primary font-mono'>
                      {reportData.metrics.totalNetFormatted}
                    </div>
                    <p className='text-[10px] text-muted-foreground'>Net Active Desk Time</p>
                  </CardContent>
                </Card>

                <Card className='border-emerald-500/20 bg-emerald-500/5 shadow-none'>
                  <CardContent className='p-3.5 space-y-1'>
                    <div className='flex items-center justify-between text-muted-foreground'>
                      <span className='text-[11px] font-semibold uppercase'>Attendance</span>
                      <Calendar className='h-3.5 w-3.5 text-emerald-600' />
                    </div>
                    <div className='text-lg font-bold text-emerald-600 font-mono'>
                      {reportData.metrics.daysAttended} / {reportData.metrics.daysInMonth} Days
                    </div>
                    <p className='text-[10px] text-muted-foreground'>
                      {reportData.metrics.attendanceRate}% Monthly Presence
                    </p>
                  </CardContent>
                </Card>

                <Card className='border-sky-500/20 bg-sky-500/5 shadow-none'>
                  <CardContent className='p-3.5 space-y-1'>
                    <div className='flex items-center justify-between text-muted-foreground'>
                      <span className='text-[11px] font-semibold uppercase'>Daily Average</span>
                      <TrendingUp className='h-3.5 w-3.5 text-sky-600' />
                    </div>
                    <div className='text-lg font-bold text-sky-600 font-mono'>
                      {reportData.metrics.avgDailyFormatted}
                    </div>
                    <p className='text-[10px] text-muted-foreground'>Hours Per Attended Day</p>
                  </CardContent>
                </Card>

                <Card className='border-purple-500/20 bg-purple-500/5 shadow-none'>
                  <CardContent className='p-3.5 space-y-1'>
                    <div className='flex items-center justify-between text-muted-foreground'>
                      <span className='text-[11px] font-semibold uppercase'>Total Breaks</span>
                      <ShieldCheck className='h-3.5 w-3.5 text-purple-600' />
                    </div>
                    <div className='text-lg font-bold text-purple-600 font-mono'>
                      {reportData.metrics.totalBreakFormatted}
                    </div>
                    <p className='text-[10px] text-muted-foreground'>{reportData.breaks.length} breaks recorded</p>
                  </CardContent>
                </Card>
              </div>

              {/* Granular Activity Timesheet Table */}
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <h4 className='text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5'>
                    <Sparkles className='h-3.5 w-3.5 text-primary' />
                    Chronological Attendance & Breaks Timesheet ({reportData.sessionDetails.length} Sessions)
                  </h4>
                  <span className='text-[11px] text-muted-foreground'>
                    Total Breaks: {reportData.metrics.totalBreakFormatted}
                  </span>
                </div>

                <div className='rounded-xl border overflow-hidden shadow-2xs'>
                  <div className='max-h-64 overflow-y-auto'>
                    <table className='w-full text-left text-xs'>
                      <thead className='bg-muted/80 sticky top-0 text-[11px] font-semibold text-muted-foreground uppercase border-b'>
                        <tr>
                          <th className='py-2 px-3'>#</th>
                          <th className='py-2 px-3'>Date</th>
                          <th className='py-2 px-3'>Punch-In</th>
                          <th className='py-2 px-3'>Breaks Window</th>
                          <th className='py-2 px-3'>Punch-Out</th>
                          <th className='py-2 px-3'>Break Duration</th>
                          <th className='py-2 px-3 text-right'>Net Studied</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-border/50'>
                        {reportData.sessionDetails.length === 0 ? (
                          <tr>
                            <td colSpan={7} className='py-8 text-center text-muted-foreground'>
                              No attendance sessions logged for this month.
                            </td>
                          </tr>
                        ) : (
                          reportData.sessionDetails.map((s: any) => (
                            <tr key={s.id} className='hover:bg-muted/30 transition-colors'>
                              <td className='py-2 px-3 font-mono text-muted-foreground'>{s.index}</td>
                              <td className='py-2 px-3 font-semibold text-foreground whitespace-nowrap'>
                                {s.dateFormatted}
                              </td>
                              <td className='py-2 px-3 font-mono text-emerald-600 font-medium whitespace-nowrap'>
                                {s.checkInTime}
                              </td>
                              <td className='py-2 px-3 text-muted-foreground text-xs whitespace-nowrap'>
                                {s.breaksWindowText || 'None'}
                              </td>
                              <td className='py-2 px-3 font-mono text-foreground font-medium whitespace-nowrap'>
                                {s.checkOutTime}
                              </td>
                              <td className='py-2 px-3 text-muted-foreground font-mono'>
                                {s.breakDurationFormatted}
                              </td>
                              <td className='py-2 px-3 font-mono font-bold text-primary text-right whitespace-nowrap'>
                                {s.netDurationFormatted}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className='py-12 text-center text-muted-foreground'>
              Select a month and year to generate the student audit report.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className='p-4 border-t bg-card flex flex-wrap items-center justify-between gap-3'>
          <p className='text-[11px] text-muted-foreground hidden sm:block'>
            Stored with cryptographically verified GPS telemetry in DeskFlow OS.
          </p>

          <div className='flex items-center gap-2 ms-auto'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>

            <Button
              type='button'
              variant='outline'
              size='sm'
              className='gap-1.5'
              disabled={isLoading || !pdfBase64}
              onClick={handleDownloadPdf}
            >
              <Download className='h-3.5 w-3.5' />
              Download PDF
            </Button>

            <Button
              type='button'
              size='sm'
              className='gap-1.5 bg-primary font-semibold'
              disabled={isLoading || isSendingTelegram || !reportData}
              onClick={handleSendTelegram}
            >
              {isSendingTelegram ? (
                <>
                  <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  Uploading to Telegram...
                </>
              ) : (
                <>
                  <Send className='h-3.5 w-3.5' />
                  Send to Private Telegram Channel
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
