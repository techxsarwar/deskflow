import { useState, useMemo } from 'react'
import {
  Armchair,
  Building2,
  Trash2,
  Share2,
  Clock,
  RefreshCw,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LoungeSeat, Student } from '../types'
import { useStudyLoungeStore } from '../store/study-lounge-store'
import { SHIFT_DETAILS } from '../data/mock-data'
import { getMembershipLifecycle } from '../lib/membership-utils'
import { AddSeatDialog } from './add-seat-dialog'
import { ShareSeatingDialog } from './share-seating-dialog'
import { RenewMembershipDialog } from './renew-membership-dialog'

export function SeatsLayoutView() {
  const seats = useStudyLoungeStore((s) => s.seats)
  const students = useStudyLoungeStore((s) => s.students)
  const assignSeat = useStudyLoungeStore((s) => s.assignSeat)
  const deleteSeat = useStudyLoungeStore((s) => s.deleteSeat)
  const releaseExpiredSeat = useStudyLoungeStore((s) => s.releaseExpiredSeat)
  const autoReleaseAllExpiredSeats = useStudyLoungeStore((s) => s.autoReleaseAllExpiredSeats)

  const [selectedSeat, setSelectedSeat] = useState<LoungeSeat | null>(null)
  const [assignStudentModalOpen, setAssignStudentModalOpen] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [renewStudent, setRenewStudent] = useState<Student | null>(null)
  const [renewOpen, setRenewOpen] = useState(false)

  // Dynamically group all Private Desks by Hall Name
  const halls = useMemo(() => {
    const map = new Map<string, LoungeSeat[]>()
    seats.forEach((seat) => {
      const hallName = seat.section?.trim() || 'Hall A'
      if (!map.has(hallName)) {
        map.set(hallName, [])
      }
      map.get(hallName)!.push(seat)
    })
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true })
    )
  }, [seats])

  const totalSeats = seats.length
  const occupiedSeats = seats.filter((s) => s.status === 'occupied').length
  const availableSeats = totalSeats - occupiedSeats
  const occupancyRate = totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 100) : 0

  // Students eligible for assignment (strictly unassigned only)
  const unassignedStudents = students.filter(
    (s) => !s.seatNumber || s.seatNumber === 'Unassigned' || s.seatNumber.trim() === ''
  )

  // Overdue / expired members still holding seats
  const expiredStudentsHoldingSeats = useMemo(() => {
    return students.filter((s) => {
      if (!s.seatNumber || s.seatNumber === 'Unassigned' || s.seatNumber.trim() === '') return false
      const lifecycle = getMembershipLifecycle(s)
      return lifecycle.isEligibleForRelease
    })
  }, [students])

  const occupantStudent = selectedSeat?.currentStudentId
    ? students.find((s) => s.id === selectedSeat.currentStudentId)
    : selectedSeat?.seatNumber
      ? students.find((s) => s.seatNumber === selectedSeat.seatNumber)
      : null

  const occupantLifecycle = occupantStudent ? getMembershipLifecycle(occupantStudent) : null

  const getSeatOccupant = (seat: LoungeSeat) => {
    if (seat.status !== 'occupied') return null
    return seat.currentStudentId
      ? students.find((s) => s.id === seat.currentStudentId)
      : seat.seatNumber
        ? students.find((s) => s.seatNumber === seat.seatNumber)
        : null
  }

  const handleSeatClick = (seat: LoungeSeat) => {
    setSelectedSeat(seat)
    setAssignStudentModalOpen(true)
  }

  const handleAssignToStudent = (studentId: string) => {
    if (!selectedSeat) return
    assignSeat(studentId, selectedSeat.seatNumber)
    setAssignStudentModalOpen(false)
  }

  return (
    <div className='space-y-6'>
      {/* Top Occupancy Header */}
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <Card>
          <CardContent className='p-4'>
            <span className='text-xs font-medium text-muted-foreground'>Total Capacity</span>
            <div className='mt-1 flex items-baseline justify-between'>
              <h3 className='text-2xl font-bold'>{totalSeats} Desks</h3>
              <Badge variant='outline'>{halls.length} Halls</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <span className='text-xs font-medium text-muted-foreground'>Occupied</span>
            <div className='mt-1 flex items-baseline justify-between'>
              <h3 className='text-2xl font-bold text-primary'>{occupiedSeats}</h3>
              <Badge variant='default'>{occupancyRate}% Full</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <span className='text-xs font-medium text-muted-foreground'>Available Vacant</span>
            <div className='mt-1 flex items-baseline justify-between'>
              <h3 className='text-2xl font-bold text-emerald-600'>{availableSeats}</h3>
              <Badge variant='outline' className='text-emerald-600 border-emerald-300'>
                Ready
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <span className='text-xs font-medium text-muted-foreground'>All Private Desks</span>
            <div className='mt-2 flex flex-wrap items-center gap-3 text-xs'>
              <span className='flex items-center gap-1.5'>
                <span className='h-3 w-3 rounded-full bg-emerald-500'></span> Vacant
              </span>
              <span className='flex items-center gap-1.5'>
                <span className='h-3 w-3 rounded-full bg-primary'></span> Occupied
              </span>
              <span className='flex items-center gap-1.5'>
                <span className='h-3 w-3 rounded-full bg-rose-500'></span> Overdue
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
        <div>
          <h3 className='font-bold text-base tracking-tight'>Library Seating Chart (By Halls)</h3>
          <p className='text-xs text-muted-foreground'>
            All spaces are dedicated Private Desks organized by Hall. Click any desk to allocate or manage.
          </p>
        </div>
        <div className='flex flex-col min-[480px]:flex-row flex-wrap items-stretch sm:items-center gap-2'>
          {expiredStudentsHoldingSeats.length > 0 && (
            <Button
              type='button'
              variant='destructive'
              className='gap-2 font-semibold shadow-xs text-xs w-full min-[480px]:w-auto'
              onClick={() => {
                if (
                  confirm(
                    `Auto-release ${expiredStudentsHoldingSeats.length} overdue seat(s)? They have exceeded the grace period. This will immediately free their desks for waiting students.`
                  )
                ) {
                  autoReleaseAllExpiredSeats(2)
                }
              }}
            >
              <Clock className='h-4 w-4' />
              Release {expiredStudentsHoldingSeats.length} Expired Desk{expiredStudentsHoldingSeats.length > 1 ? 's' : ''}
            </Button>
          )}

          <Button
            type='button'
            className='bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-xs text-xs w-full min-[480px]:w-auto'
            onClick={() => setShareDialogOpen(true)}
          >
            <Share2 className='h-4 w-4' />
            Share Seating Arrangement
          </Button>
          <AddSeatDialog />
        </div>
      </div>

      {/* Main Floor Plan Grid Grouped by Hall */}
      <div className='space-y-6'>
        {halls.map(([hallName, hallDesks]) => {
          const hallOccupied = hallDesks.filter((s) => s.status === 'occupied').length
          const hallAvailable = hallDesks.length - hallOccupied

          return (
            <Card key={hallName} className='border shadow-xs'>
              <CardHeader className='pb-3'>
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
                  <div>
                    <CardTitle className='text-base flex items-center gap-2'>
                      <Building2 className='h-4 w-4 text-primary' />
                      {hallName}
                    </CardTitle>
                    <CardDescription className='mt-0.5'>
                      {hallDesks.length} Private Desks • {hallAvailable} Vacant • {hallOccupied} Occupied
                    </CardDescription>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Badge variant='outline' className='text-xs font-mono font-bold'>
                      {hallOccupied}/{hallDesks.length} Occupied
                    </Badge>
                    <AddSeatDialog
                      defaultHall={hallName}
                      triggerButton={
                        <Button variant='outline' size='sm' className='h-7 text-xs gap-1 font-semibold'>
                          <Plus className='h-3 w-3' />
                          Add Desks to {hallName}
                        </Button>
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-3 sm:grid-cols-6 md:grid-cols-10 gap-2 sm:gap-3'>
                  {hallDesks.map((seat) => {
                    const isOccupied = seat.status === 'occupied'
                    const occupant = getSeatOccupant(seat)
                    const isOverdue = occupant ? getMembershipLifecycle(occupant).isEligibleForRelease : false
                    return (
                      <div
                        key={seat.id}
                        onClick={() => handleSeatClick(seat)}
                        className={`relative p-2.5 sm:p-3 rounded-xl border-2 flex flex-col items-center justify-between cursor-pointer transition-all hover:scale-105 select-none ${
                          isOccupied
                            ? isOverdue
                              ? 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                              : 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:border-emerald-500'
                        }`}
                      >
                        <span className='font-mono font-bold text-xs sm:text-sm'>{seat.seatNumber}</span>
                        <Armchair
                          className={`h-5 w-5 sm:h-6 sm:w-6 my-1 sm:my-1.5 ${
                            isOccupied ? (isOverdue ? 'text-rose-600' : 'text-primary') : 'text-emerald-600'
                          }`}
                        />
                        <span className='text-[9px] sm:text-[10px] font-semibold truncate w-full text-center'>
                          {isOccupied ? seat.currentStudentName?.split(' ')[0] : 'Vacant'}
                        </span>
                        {isOverdue && (
                          <span
                            className='absolute -top-1 -right-1 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-rose-600 ring-2 ring-background'
                            title='Membership expired beyond grace period'
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {halls.length === 0 && (
          <div className='p-8 rounded-2xl border border-dashed text-center space-y-3 bg-muted/20'>
            <Building2 className='h-10 w-10 text-muted-foreground mx-auto' />
            <h4 className='font-bold text-base'>No Halls or Desks configured yet</h4>
            <p className='text-xs text-muted-foreground max-w-sm mx-auto'>
              Create your first Hall (e.g., Hall A) and add private desks to build your library seating arrangement.
            </p>
            <AddSeatDialog />
          </div>
        )}
      </div>

      {/* Seat Detail / Assignment Modal */}
      <Dialog open={assignStudentModalOpen} onOpenChange={setAssignStudentModalOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Armchair className='h-5 w-5 text-primary' />
              Private Desk {selectedSeat?.seatNumber} Details
            </DialogTitle>
          </DialogHeader>

          {selectedSeat && (
            <div className='space-y-4'>
              <div className='rounded-lg border p-4 bg-muted/30 text-sm space-y-2'>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Hall Name:</span>
                  <span className='font-bold text-foreground'>{selectedSeat.section || 'Hall A'}</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Desk Category:</span>
                  <span className='font-medium text-primary'>Private Desk</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Current Status:</span>
                  <Badge
                    variant={selectedSeat.status === 'occupied' ? 'default' : 'outline'}
                    className='capitalize'
                  >
                    {selectedSeat.status}
                  </Badge>
                </div>
                {selectedSeat.currentStudentName && (
                  <div className='flex justify-between pt-1 border-t'>
                    <span className='text-muted-foreground'>Occupied By:</span>
                    <span className='font-bold text-primary'>{selectedSeat.currentStudentName}</span>
                  </div>
                )}
                {selectedSeat.shift && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Slot Timing:</span>
                    <span className='font-medium'>{SHIFT_DETAILS[selectedSeat.shift]?.timing}</span>
                  </div>
                )}
              </div>

              {selectedSeat.status === 'occupied' && (
                <div className='space-y-3 pt-2'>
                  <div className='rounded-xl border bg-primary/5 border-primary/20 p-3'>
                    <div className='flex items-center gap-3'>
                      {occupantStudent?.photoUrl ? (
                        <img
                          src={occupantStudent.photoUrl}
                          alt={selectedSeat.currentStudentName}
                          className='h-11 w-11 rounded-full object-cover border-2 border-primary/30 shrink-0'
                        />
                      ) : (
                        <div className='h-11 w-11 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-sm'>
                          {(selectedSeat.currentStudentName || 'ST').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className='flex-1 min-w-0'>
                        <span className='text-sm font-bold text-foreground block truncate'>
                          {selectedSeat.currentStudentName}
                        </span>
                        <div className='flex items-center gap-2 text-xs text-muted-foreground mt-0.5'>
                          <span className='font-mono font-medium'>{occupantStudent?.regNo || 'Enrolled Member'}</span>
                          {occupantStudent?.phone && (
                            <>
                              <span>•</span>
                              <span>{occupantStudent.phone}</span>
                            </>
                          )}
                        </div>
                        {occupantLifecycle && (
                          <div className='mt-2 flex flex-wrap items-center gap-1.5'>
                            <Badge variant='outline' className={`text-[10px] px-1.5 py-0 ${occupantLifecycle.badgeColor}`}>
                              {occupantLifecycle.label}
                            </Badge>
                            {occupantStudent?.endDate && (
                              <span className='text-[10px] text-muted-foreground'>
                                (Valid till {occupantStudent.endDate})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions for occupied seat */}
                  <div className='flex flex-col gap-2'>
                    <div className='flex gap-2'>
                      {occupantStudent && (
                        <Button
                          type='button'
                          size='sm'
                          className='flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5'
                          onClick={() => {
                            setRenewStudent(occupantStudent)
                            setRenewOpen(true)
                            setAssignStudentModalOpen(false)
                          }}
                        >
                          <RefreshCw className='h-3.5 w-3.5' />
                          Renew (+1 Mo)
                        </Button>
                      )}

                      {occupantLifecycle?.isEligibleForRelease && occupantStudent && (
                        <Button
                          type='button'
                          variant='destructive'
                          size='sm'
                          className='flex-1 text-xs gap-1.5'
                          onClick={() => {
                            releaseExpiredSeat(occupantStudent.id)
                            setAssignStudentModalOpen(false)
                          }}
                        >
                          <Clock className='h-3.5 w-3.5' />
                          Release Desk
                        </Button>
                      )}
                    </div>

                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='w-full text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950 text-xs'
                      onClick={() => {
                        if (selectedSeat.currentStudentId) {
                          assignSeat(selectedSeat.currentStudentId, 'Unassigned')
                          setAssignStudentModalOpen(false)
                          toast.success(`Desk ${selectedSeat.seatNumber} is now vacant.`)
                        }
                      }}
                    >
                      Vacate / Manual Unassign
                    </Button>
                  </div>
                </div>
              )}

              {selectedSeat.status === 'available' && (
                <div className='space-y-3 pt-2'>
                  <div className='flex items-center justify-between'>
                    <h4 className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                      Assign Private Desk to an Unassigned Student:
                    </h4>
                    <Badge variant='outline' className='text-[10px]'>
                      {unassignedStudents.length} Waiting
                    </Badge>
                  </div>

                  {unassignedStudents.length === 0 ? (
                    <div className='rounded-xl border border-dashed p-4 text-center space-y-1.5 bg-muted/20'>
                      <p className='text-xs font-semibold text-foreground'>
                        No unassigned students waiting
                      </p>
                      <p className='text-[11px] text-muted-foreground'>
                        All currently enrolled students already have a desk allotted. To assign someone new, enroll a student or vacate an existing seat.
                      </p>
                    </div>
                  ) : (
                    <div className='space-y-2 max-h-56 overflow-y-auto pr-1'>
                      {unassignedStudents.map((s) => {
                        const shiftInfo = SHIFT_DETAILS[s.shift] || { label: s.shift }
                        return (
                          <div
                            key={s.id}
                            className='flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/40 transition-colors text-xs'
                          >
                            <div className='flex items-center gap-2.5 min-w-0 flex-1 mr-2'>
                              {s.photoUrl ? (
                                <img
                                  src={s.photoUrl}
                                  alt={s.fullName}
                                  className='h-8 w-8 rounded-full object-cover shrink-0 border'
                                />
                              ) : (
                                <div className='h-8 w-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs'>
                                  {s.fullName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className='min-w-0'>
                                <span className='font-semibold block truncate text-foreground'>
                                  {s.fullName}
                                </span>
                                <div className='flex items-center gap-1.5 text-[11px] text-muted-foreground'>
                                  <span className='font-mono'>{s.regNo}</span>
                                  <span>•</span>
                                  <span className='capitalize font-medium text-primary'>
                                    {shiftInfo.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              size='sm'
                              className='h-7 text-xs shrink-0'
                              onClick={() => {
                                handleAssignToStudent(s.id)
                                toast.success(`Assigned Private Desk ${selectedSeat.seatNumber} to ${s.fullName}!`)
                              }}
                            >
                              Assign Desk
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Delete / Remove Space Action */}
              <div className='flex items-center justify-between pt-3 border-t'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 text-xs gap-1.5'
                  onClick={() => {
                    if (
                      confirm(
                        `Are you sure you want to remove Private Desk ${selectedSeat.seatNumber} from ${selectedSeat.section || 'the floor plan'}?`
                      )
                    ) {
                      deleteSeat(selectedSeat.seatNumber)
                      setAssignStudentModalOpen(false)
                      toast.success(
                        `Removed Private Desk ${selectedSeat.seatNumber} from floor plan.`
                      )
                    }
                  }}
                >
                  <Trash2 className='h-3.5 w-3.5' />
                  Remove Desk
                </Button>

                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => setAssignStudentModalOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Share Seating Arrangement Dialog */}
      <ShareSeatingDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        seats={seats}
        students={students}
      />

      {/* Renew Membership Dialog */}
      <RenewMembershipDialog
        open={renewOpen}
        onOpenChange={setRenewOpen}
        student={renewStudent}
      />
    </div>
  )
}
