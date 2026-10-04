import { useState, useMemo, useEffect } from 'react'
import { Plus, Armchair, Building2, CheckCircle2, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useStudyLoungeStore } from '../store/study-lounge-store'

interface AddSeatDialogProps {
  defaultHall?: string
  triggerButton?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddSeatDialog({
  defaultHall,
  triggerButton,
  open: externalOpen,
  onOpenChange: setExternalOpen,
}: AddSeatDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = externalOpen !== undefined
  const open = isControlled ? externalOpen : internalOpen
  const setOpen = isControlled ? setExternalOpen! : setInternalOpen

  const seats = useStudyLoungeStore((s) => s.seats)
  const addSeat = useStudyLoungeStore((s) => s.addSeat)
  const addSeatsBulk = useStudyLoungeStore((s) => s.addSeatsBulk)

  // Extract unique existing hall names
  const existingHalls = useMemo(() => {
    const hallSet = new Set<string>()
    seats.forEach((s) => {
      const name = s.section?.trim()
      if (name) hallSet.add(name)
    })
    if (hallSet.size === 0) {
      hallSet.add('Hall A')
      hallSet.add('Hall B')
    }
    return Array.from(hallSet)
  }, [seats])

  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [hallName, setHallName] = useState(defaultHall || existingHalls[0] || 'Hall A')

  // Single desk state
  const [singleSeatNumber, setSingleSeatNumber] = useState('')

  // Bulk add state
  const [prefix, setPrefix] = useState('D-')
  const [startNumber, setStartNumber] = useState(1)
  const [count, setCount] = useState(10)

  // Calculate highest existing desk number to auto-suggest
  useEffect(() => {
    if (open) {
      if (defaultHall) {
        setHallName(defaultHall)
      } else if (!hallName) {
        setHallName(existingHalls[0] || 'Hall A')
      }

      // Find max number among existing D-XX desks
      let maxNum = 0
      seats.forEach((s) => {
        const match = s.seatNumber.match(/\d+/)
        if (match) {
          const num = parseInt(match[0], 10)
          if (num > maxNum) maxNum = num
        }
      })
      const nextNum = maxNum + 1
      setSingleSeatNumber(`D-${String(nextNum).padStart(2, '0')}`)
      setStartNumber(nextNum)
    }
  }, [open, defaultHall, seats])

  // Computed preview of bulk desks
  const bulkPreview = useMemo(() => {
    const list: string[] = []
    const total = Math.min(Math.max(1, count), 100)
    for (let i = 0; i < total; i++) {
      const num = startNumber + i
      const numStr = String(num).padStart(2, '0')
      list.push(`${prefix.trim()}${numStr}`)
    }
    return list
  }, [prefix, startNumber, count])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanHall = hallName.trim()

    if (!cleanHall) {
      toast.error('Please specify a Hall Name.')
      return
    }

    if (mode === 'single') {
      const cleanNumber = singleSeatNumber.trim().toUpperCase()
      if (!cleanNumber) {
        toast.error('Please enter a desk number.')
        return
      }

      const alreadyExists = seats.some(
        (s) => s.seatNumber.toLowerCase() === cleanNumber.toLowerCase()
      )
      if (alreadyExists) {
        toast.error(`Private Desk ${cleanNumber} already exists in the library!`)
        return
      }

      addSeat({
        seatNumber: cleanNumber,
        type: 'dedicated', // All desks are Private Desks
        section: cleanHall,
      })

      toast.success(`Private Desk ${cleanNumber} added to ${cleanHall}!`)
      setOpen(false)
    } else {
      // Bulk add mode
      const existingMap = new Set(seats.map((s) => s.seatNumber.toLowerCase()))
      const toCreate = bulkPreview.filter(
        (seatNum) => !existingMap.has(seatNum.toLowerCase())
      )

      if (toCreate.length === 0) {
        toast.error('All generated desk numbers already exist in the library.')
        return
      }

      const newSeatsData = toCreate.map((seatNum) => ({
        seatNumber: seatNum.toUpperCase(),
        type: 'dedicated' as const, // All desks are Private Desks
        section: cleanHall,
      }))

      addSeatsBulk(newSeatsData)

      const skippedCount = bulkPreview.length - toCreate.length
      if (skippedCount > 0) {
        toast.success(
          `Added ${toCreate.length} Private Desks to ${cleanHall} (${skippedCount} already existed and were skipped).`
        )
      } else {
        toast.success(
          `Added ${toCreate.length} Private Desks to ${cleanHall} successfully!`
        )
      }

      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerButton ? (
        <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size='sm' className='gap-1.5 text-xs font-semibold'>
            <Plus className='h-4 w-4' />
            Add Desks by Hall
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <div className='flex items-center gap-2 text-primary'>
            <Building2 className='h-5 w-5' />
            <DialogTitle>Add Private Desks by Hall</DialogTitle>
          </div>
          <DialogDescription>
            All desks in this library are dedicated Private Desks. Group and organize your desks by Hall name.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4 pt-2'>
          {/* Mode Switch: Single Desk vs Bulk Add */}
          <div className='grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/50 border'>
            <button
              type='button'
              onClick={() => setMode('single')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                mode === 'single'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Armchair className='h-3.5 w-3.5' />
              Single Private Desk
            </button>
            <button
              type='button'
              onClick={() => setMode('bulk')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                mode === 'bulk'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className='h-3.5 w-3.5' />
              Bulk Add Desks
            </button>
          </div>

          {/* Hall Name Input + Quick Selector */}
          <div className='space-y-2'>
            <Label htmlFor='hall-name' className='text-xs font-semibold'>
              Hall Name *
            </Label>
            <Input
              id='hall-name'
              value={hallName}
              onChange={(e) => setHallName(e.target.value)}
              placeholder='e.g., Hall A, Hall B, Ground Floor Hall'
              required
              className='font-medium'
            />
            {existingHalls.length > 0 && (
              <div className='flex flex-wrap items-center gap-1.5 pt-1'>
                <span className='text-[11px] text-muted-foreground me-1'>Existing Halls:</span>
                {existingHalls.map((hall) => (
                  <Badge
                    key={hall}
                    variant={hallName === hall ? 'default' : 'outline'}
                    className='cursor-pointer text-[10px] px-2 py-0.5 select-none hover:opacity-80'
                    onClick={() => setHallName(hall)}
                  >
                    {hall}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Single Desk Input */}
          {mode === 'single' && (
            <div className='space-y-1.5'>
              <Label htmlFor='single-seat-number' className='text-xs font-semibold'>
                Private Desk Number *
              </Label>
              <Input
                id='single-seat-number'
                value={singleSeatNumber}
                onChange={(e) => setSingleSeatNumber(e.target.value)}
                placeholder='e.g., D-31 or A-05'
                required
                className='font-mono font-bold text-base'
              />
              <p className='text-[11px] text-muted-foreground'>
                This desk will be created as an individual Private Desk under {hallName || 'the specified Hall'}.
              </p>
            </div>
          )}

          {/* Bulk Desks Input */}
          {mode === 'bulk' && (
            <div className='space-y-3 p-3.5 rounded-xl border bg-muted/20'>
              <div className='grid grid-cols-3 gap-2.5'>
                <div className='space-y-1'>
                  <Label htmlFor='desk-prefix' className='text-[11px] font-medium'>
                    Prefix
                  </Label>
                  <Input
                    id='desk-prefix'
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder='D-'
                    className='font-mono font-bold text-xs h-8'
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='start-num' className='text-[11px] font-medium'>
                    Start Number
                  </Label>
                  <Input
                    id='start-num'
                    type='number'
                    min={1}
                    value={startNumber}
                    onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className='font-mono font-bold text-xs h-8'
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='bulk-count' className='text-[11px] font-medium'>
                    Total Desks
                  </Label>
                  <Input
                    id='bulk-count'
                    type='number'
                    min={1}
                    max={100}
                    value={count}
                    onChange={(e) => setCount(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
                    className='font-mono font-bold text-xs h-8'
                  />
                </div>
              </div>

              {/* Live Preview Box */}
              <div className='rounded-lg bg-background border p-2.5 space-y-1'>
                <span className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground block'>
                  Generated Desks Preview ({bulkPreview.length} Private Desks)
                </span>
                <p className='font-mono text-xs font-semibold text-primary truncate'>
                  {bulkPreview.slice(0, 8).join(', ')}
                  {bulkPreview.length > 8 ? ` ... and ${bulkPreview.length - 8} more (${bulkPreview[bulkPreview.length - 1]})` : ''}
                </p>
                <span className='text-[10px] text-muted-foreground block'>
                  Will be placed inside <strong>{hallName || 'Hall'}</strong>
                </span>
              </div>
            </div>
          )}

          <div className='flex justify-end gap-2 pt-3 border-t'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type='submit' className='gap-1.5'>
              <CheckCircle2 className='h-4 w-4' />
              {mode === 'single'
                ? 'Add Private Desk'
                : `Add ${bulkPreview.length} Private Desks`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
