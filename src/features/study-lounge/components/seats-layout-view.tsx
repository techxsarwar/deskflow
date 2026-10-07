import { useState, useMemo } from 'react'
import {
  Armchair,
  Building2,
  Trash2,
  Share2,
  Clock,
  RefreshCw,
  Plus,
  Footprints,
  LayoutGrid,
  Grid3X3,
  Search,
  X,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import {
  getDeskDisplayNumber,
  getDeskFullLabel,
  getDeskLabel,
  sortSeatsNaturally,
  groupSeatsIntoZones,
  groupSeatsIntoPods,
} from '../lib/seat-utils'
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

  // Layout View Mode: 'floorplan' (Rows with Central Aisle) | 'pods' (Study Pods) | 'grid' (Zone Grid)
  const [viewMode, setViewMode] = useState<'floorplan' | 'pods' | 'grid'>('floorplan')

  // Filters
  const [selectedHall, setSelectedHall] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'vacant' | 'occupied' | 'overdue'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // 1-Click Add/Restore Missing Slot Modal state
  const [addSlotModal, setAddSlotModal] = useState<{
    open: boolean
    hallName: string
    serial: number
  }>({ open: false, hallName: '', serial: 1 })

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
    return Array.from(map.entries())
      .map(([hallName, hallSeats]) => [hallName, sortSeatsNaturally(hallSeats, hallName)] as [string, LoungeSeat[]])
      .sort(([a], [b]) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
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

  // Filtered halls based on selected tab
  const displayedHalls = useMemo(() => {
    if (selectedHall === 'all') return halls
    return halls.filter(([name]) => name.toLowerCase() === selectedHall.toLowerCase())
  }, [halls, selectedHall])

  // Helper: check if a seat matches active status & search filters
  const isSeatMatchingFilter = (seat: LoungeSeat) => {
    const isOccupied = seat.status === 'occupied'
    const occupant = getSeatOccupant(seat)
    const isOverdue = occupant ? getMembershipLifecycle(occupant).isEligibleForRelease : false

    if (statusFilter === 'vacant' && isOccupied) return false
    if (statusFilter === 'occupied' && !isOccupied) return false
    if (statusFilter === 'overdue' && !isOverdue) return false

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      const deskNum = getDeskDisplayNumber(seat.seatNumber, seat.section).toLowerCase()
      const studentName = (seat.currentStudentName || '').toLowerCase()
      const hall = (seat.section || '').toLowerCase()
      const matches =
        deskNum.includes(q) ||
        studentName.includes(q) ||
        hall.includes(q) ||
        `desk ${deskNum}`.includes(q)
      if (!matches) return false
    }

    return true
  }

  const renderDeskCard = (seat: LoungeSeat, hallName: string) => {
    const isOccupied = seat.status === 'occupied'
    const occupant = getSeatOccupant(seat)
    const isOverdue = occupant ? getMembershipLifecycle(occupant).isEligibleForRelease : false
    const matchesFilter = isSeatMatchingFilter(seat)
    const isHighlighted = searchQuery.trim() !== '' && matchesFilter

    return (
      <div
        key={seat.id}
        onClick={() => handleSeatClick(seat)}
        className={`relative p-2 sm:p-2.5 rounded-xl border-2 flex flex-col items-center justify-between cursor-pointer transition-all hover:scale-105 select-none min-h-[72px] sm:min-h-[82px] ${
          !matchesFilter && (statusFilter !== 'all' || searchQuery)
            ? 'opacity-25 grayscale'
            : 'opacity-100'
        } ${
          isHighlighted
            ? 'ring-2 ring-primary ring-offset-2 scale-105 shadow-md z-10'
            : ''
        } ${
          isOccupied
            ? isOverdue
              ? 'border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300'
              : 'border-primary/50 bg-primary/10 text-primary'
            : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:border-emerald-600'
        }`}
      >
        <div className='w-full flex items-center justify-between px-0.5'>
          <span className='font-mono font-bold text-xs sm:text-sm text-foreground'>
            {getDeskDisplayNumber(seat.seatNumber, hallName)}
          </span>
          {isOverdue && (
            <span
              className='h-2 w-2 rounded-full bg-rose-600 animate-pulse'
              title='Overdue / Grace period expired'
            />
          )}
        </div>

        <Armchair
          className={`h-5 w-5 sm:h-5.5 sm:w-5.5 my-1 ${
            isOccupied ? (isOverdue ? 'text-rose-600' : 'text-primary') : 'text-emerald-600'
          }`}
        />

        <span className='text-[9px] sm:text-[10px] font-semibold truncate w-full text-center'>
          {isOccupied ? seat.currentStudentName?.split(' ')[0] : 'Vacant'}
        </span>
      </div>
    )
  }

  const renderMissingSlot = (hallName: string, slotNumber: number) => {
    return (
      <div
        key={`missing-${hallName}-${slotNumber}`}
        onClick={() =>
          setAddSlotModal({
            open: true,
            hallName,
            serial: slotNumber,
          })
        }
        className='relative p-2 sm:p-2.5 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/10 hover:bg-primary/5 hover:border-primary/60 flex flex-col items-center justify-between cursor-pointer transition-all select-none min-h-[72px] sm:min-h-[82px] group'
        title={`Desk ${slotNumber} is not created yet in ${hallName}. Click to add.`}
      >
        <span className='font-mono font-bold text-xs text-muted-foreground/50 group-hover:text-primary'>
          {slotNumber}
        </span>
        <div className='p-1 rounded-full bg-muted/30 group-hover:bg-primary/20 text-muted-foreground/60 group-hover:text-primary transition-colors my-0.5'>
          <Plus className='h-3.5 w-3.5' />
        </div>
        <span className='text-[9px] font-medium text-muted-foreground/60 group-hover:text-primary'>
          + Add
        </span>
      </div>
    )
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
            Realistic floor plan organized into rows, bays, and aisles. Click any desk to allocate or manage.
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

      {/* Interactive Controls: Hall Tabs, Search, Status Pills & View Switcher */}
      <div className='flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 rounded-xl border bg-muted/20'>
        {/* Left: Hall Switcher Tabs */}
        <div className='flex flex-wrap items-center gap-1.5'>
          <Button
            size='sm'
            variant={selectedHall === 'all' ? 'default' : 'outline'}
            className='h-8 text-xs font-semibold'
            onClick={() => setSelectedHall('all')}
          >
            All Halls ({totalSeats})
          </Button>
          {halls.map(([hName, hDesks]) => (
            <Button
              key={hName}
              size='sm'
              variant={selectedHall === hName ? 'default' : 'outline'}
              className='h-8 text-xs font-semibold'
              onClick={() => setSelectedHall(hName)}
            >
              {hName} ({hDesks.length})
            </Button>
          ))}
        </div>

        {/* Center / Right: Search & Status Pills & View Mode */}
        <div className='flex flex-wrap items-center gap-2'>
          {/* Quick Desk Search */}
          <div className='relative w-full sm:w-48'>
            <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground' />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search desk # or name...'
              className='h-8 pl-8 pr-7 text-xs bg-background'
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className='absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
              >
                <X className='h-3 w-3' />
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className='flex items-center gap-1 bg-background p-1 rounded-lg border'>
            <Button
              size='sm'
              variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
              className='h-6 text-[11px] px-2 font-medium'
              onClick={() => setStatusFilter('all')}
            >
              All
            </Button>
            <Button
              size='sm'
              variant={statusFilter === 'vacant' ? 'secondary' : 'ghost'}
              className='h-6 text-[11px] px-2 font-medium text-emerald-600'
              onClick={() => setStatusFilter('vacant')}
            >
              Vacant
            </Button>
            <Button
              size='sm'
              variant={statusFilter === 'occupied' ? 'secondary' : 'ghost'}
              className='h-6 text-[11px] px-2 font-medium text-primary'
              onClick={() => setStatusFilter('occupied')}
            >
              Occupied
            </Button>
            <Button
              size='sm'
              variant={statusFilter === 'overdue' ? 'secondary' : 'ghost'}
              className='h-6 text-[11px] px-2 font-medium text-rose-600'
              onClick={() => setStatusFilter('overdue')}
            >
              Overdue
            </Button>
          </div>

          {/* Layout View Mode Switcher */}
          <div className='flex items-center gap-1 bg-background p-1 rounded-lg border'>
            <Button
              size='sm'
              variant={viewMode === 'floorplan' ? 'default' : 'ghost'}
              className='h-6 text-[11px] px-2 gap-1 font-semibold'
              onClick={() => setViewMode('floorplan')}
              title='Floor Plan (Rows & Aisles)'
            >
              <Footprints className='h-3 w-3' />
              Floor Plan
            </Button>
            <Button
              size='sm'
              variant={viewMode === 'pods' ? 'default' : 'ghost'}
              className='h-6 text-[11px] px-2 gap-1 font-semibold'
              onClick={() => setViewMode('pods')}
              title='Study Table Pods'
            >
              <LayoutGrid className='h-3 w-3' />
              Table Pods
            </Button>
            <Button
              size='sm'
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              className='h-6 text-[11px] px-2 gap-1 font-semibold'
              onClick={() => setViewMode('grid')}
              title='Compact Grid'
            >
              <Grid3X3 className='h-3 w-3' />
              Grid
            </Button>
          </div>
        </div>
      </div>

      {/* Main Floor Plan Grouped by Hall */}
      <div className='space-y-6'>
        {displayedHalls.map(([hallName, hallDesks]) => {
          const hallOccupied = hallDesks.filter((s) => s.status === 'occupied').length
          const hallAvailable = hallDesks.length - hallOccupied
          const zones = groupSeatsIntoZones(hallDesks, hallName)

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
                      {hallDesks.length} Private Desks • {hallAvailable} Vacant • {hallOccupied} Occupied • {zones.length} Zones
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

              <CardContent className='space-y-6'>
                {/* 1. FLOOR PLAN VIEW: Rows with Left Bay, Central Aisle, and Right Bay */}
                {viewMode === 'floorplan' && (
                  <div className='space-y-6'>
                    {zones.map((zone) => (
                      <div key={zone.id} className='rounded-xl border bg-muted/15 p-3.5 sm:p-4 space-y-4'>
                        {/* Zone Header */}
                        <div className='flex items-center justify-between pb-2 border-b'>
                          <div className='flex items-center gap-2'>
                            <Badge variant='outline' className='font-bold text-xs gap-1 py-0.5 bg-background'>
                              <Layers className='h-3 w-3 text-primary' />
                              {zone.title}
                            </Badge>
                            <span className='text-xs font-semibold text-muted-foreground'>
                              {zone.rangeLabel}
                            </span>
                          </div>
                          <span className='text-xs text-muted-foreground font-mono'>
                            {zone.totalSeats} Desks
                          </span>
                        </div>

                        {/* Rows */}
                        <div className='space-y-3.5'>
                          {zone.rows.map((row) => (
                            <div key={row.rowLabel} className='space-y-1.5'>
                              <div className='flex items-center justify-between px-1 text-muted-foreground'>
                                <span className='text-[11px] font-bold uppercase tracking-wider'>
                                  {row.rowLabel} ({row.rangeLabel})
                                </span>
                                <span className='text-[10px] font-mono'>
                                  {row.totalExistingSeats} Desks
                                </span>
                              </div>

                              {/* Bay Layout with Central Aisle */}
                              <div className='grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 bg-background p-2.5 sm:p-3 rounded-xl border shadow-2xs'>
                                {/* Left Bay (Up to 5 Desks) */}
                                <div className='grid grid-cols-5 gap-2'>
                                  {row.leftBay.map((slot) =>
                                    slot.type === 'seat' && slot.seat
                                      ? renderDeskCard(slot.seat, hallName)
                                      : renderMissingSlot(hallName, slot.numericNumber || 0)
                                  )}
                                </div>

                                {/* Central Walkway / Aisle */}
                                <div className='hidden md:flex flex-col items-center justify-center px-2 py-1 select-none text-muted-foreground/60 min-w-[70px]'>
                                  <div className='h-2.5 w-px bg-border' />
                                  <span className='text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 py-0.5 flex items-center gap-1 whitespace-nowrap'>
                                    <Footprints className='h-3 w-3' /> Aisle
                                  </span>
                                  <div className='h-2.5 w-px bg-border' />
                                </div>

                                {/* Right Bay (Up to 5 Desks) */}
                                <div className='grid grid-cols-5 gap-2'>
                                  {row.rightBay.map((slot) =>
                                    slot.type === 'seat' && slot.seat
                                      ? renderDeskCard(slot.seat, hallName)
                                      : renderMissingSlot(hallName, slot.numericNumber || 0)
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. STUDY PODS VIEW: 4-Seat Facing Tables */}
                {viewMode === 'pods' && (
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {groupSeatsIntoPods(hallDesks, hallName).map((pod) => (
                      <div key={pod.podId} className='rounded-xl border bg-muted/20 p-3.5 space-y-2.5 shadow-2xs'>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs font-bold text-foreground flex items-center gap-1.5'>
                            <LayoutGrid className='h-3.5 w-3.5 text-primary' />
                            {pod.podLabel}
                          </span>
                          <Badge variant='outline' className='text-[10px] font-mono'>
                            {pod.totalSeats} Desks
                          </Badge>
                        </div>
                        <div className='grid grid-cols-2 gap-2 p-2 bg-background rounded-lg border'>
                          {pod.slots.map((slot) =>
                            slot.type === 'seat' && slot.seat
                              ? renderDeskCard(slot.seat, hallName)
                              : null
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. COMPACT GRID VIEW: Grouped by Zones without gaps */}
                {viewMode === 'grid' && (
                  <div className='space-y-5'>
                    {zones.map((zone) => (
                      <div key={zone.id} className='rounded-xl border bg-muted/10 p-3.5 space-y-2.5'>
                        <div className='flex items-center justify-between pb-1 border-b'>
                          <span className='text-xs font-bold text-foreground'>
                            {zone.title} ({zone.rangeLabel})
                          </span>
                          <span className='text-xs text-muted-foreground font-mono'>
                            {zone.totalSeats} Desks
                          </span>
                        </div>
                        <div className='grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-2'>
                          {zone.allSeats.map((seat) => renderDeskCard(seat, hallName))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

        {halls.length === 0 && (
          <div className='p-8 rounded-2xl border border-dashed text-center space-y-3 bg-muted/20'>
            <Building2 className='h-10 w-10 text-muted-foreground mx-auto' />
            <h4 className='font-bold text-base'>No Halls or Desks configured yet</h4>
            <p className='text-xs text-muted-foreground max-w-sm mx-auto'>
              Create your first Hall (e.g., Black Hall, Brown Hall) and add private desks to build your library seating arrangement.
            </p>
            <AddSeatDialog />
          </div>
        )}
      </div>

      {/* Seat Detail / Assignment Modal */}
      <Dialog open={assignStudentModalOpen} onOpenChange={setAssignStudentModalOpen}>
        <DialogContent className='sm:max-w-md max-h-[92vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Armchair className='h-5 w-5 text-primary' />
              {selectedSeat ? getDeskFullLabel(selectedSeat.seatNumber, selectedSeat.section) : 'Desk'} Details
            </DialogTitle>
          </DialogHeader>

          {selectedSeat && (
            <div className='space-y-4'>
              <div className='rounded-lg border p-4 bg-muted/30 text-sm space-y-2'>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Hall Name:</span>
                  <span className='font-bold text-foreground'>{selectedSeat.section || 'Main Hall'}</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Desk Number:</span>
                  <span className='font-mono font-bold text-foreground'>{getDeskLabel(selectedSeat.seatNumber, selectedSeat.section)}</span>
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
                                toast.success(`Assigned ${getDeskFullLabel(selectedSeat.seatNumber, selectedSeat.section)} to ${s.fullName}!`)
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
                        `Are you sure you want to remove ${getDeskFullLabel(selectedSeat.seatNumber, selectedSeat.section)} from floor plan?`
                      )
                    ) {
                      deleteSeat(selectedSeat.seatNumber)
                      setAssignStudentModalOpen(false)
                      toast.success(
                        `Removed ${getDeskFullLabel(selectedSeat.seatNumber, selectedSeat.section)} from floor plan.`
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

      {/* 1-Click Restore/Add Missing Slot Dialog */}
      <AddSeatDialog
        open={addSlotModal.open}
        onOpenChange={(open) => setAddSlotModal((prev) => ({ ...prev, open }))}
        defaultHall={addSlotModal.hallName}
        defaultFromSerial={addSlotModal.serial}
        defaultToSerial={addSlotModal.serial}
      />
    </div>
  )
}
