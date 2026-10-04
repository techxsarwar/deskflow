import { useState, useMemo, useEffect } from 'react'
import { Plus, Building2, CheckCircle2, Hash } from 'lucide-react'
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
  const addSeatsBulk = useStudyLoungeStore((s) => s.addSeatsBulk)

  // Extract unique existing hall names
  const existingHalls = useMemo(() => {
    const hallSet = new Set<string>()
    seats.forEach((s) => {
      const name = s.section?.trim()
      if (name) hallSet.add(name)
    })
    if (hallSet.size === 0) {
      hallSet.add('Black Hall')
      hallSet.add('Brown Hall')
    }
    return Array.from(hallSet)
  }, [seats])

  const [hallName, setHallName] = useState(defaultHall || existingHalls[0] || 'Black Hall')
  const [fromSerial, setFromSerial] = useState(1)
  const [toSerial, setToSerial] = useState(30)

  // Auto-suggest serial range based on existing desks in the selected hall
  useEffect(() => {
    if (open) {
      const targetHall = defaultHall || hallName || existingHalls[0] || 'Black Hall'
      setHallName(targetHall)

      // Find max serial number already existing in this hall
      const hallSeats = seats.filter((s) => s.section?.trim().toLowerCase() === targetHall.trim().toLowerCase())
      let maxNum = 0
      hallSeats.forEach((s) => {
        const match = s.seatNumber.match(/(\d+)(?!.*\d)/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxNum) maxNum = num
        }
      })

      if (maxNum > 0) {
        setFromSerial(maxNum + 1)
        setToSerial(maxNum + 10)
      } else {
        setFromSerial(1)
        setToSerial(30)
      }
    }
  }, [open, defaultHall])

  // Computed preview list of desks
  const generatedDesks = useMemo(() => {
    const list: { serial: number; label: string; fullKey: string }[] = []
    const start = Math.max(1, fromSerial)
    const end = Math.max(start, toSerial)
    const count = Math.min(end - start + 1, 100) // safety limit 100 at a time

    for (let i = 0; i < count; i++) {
      const serial = start + i
      list.push({
        serial,
        label: `Desk ${serial}`,
        fullKey: `${hallName.trim()} - Desk ${serial}`,
      })
    }
    return list
  }, [hallName, fromSerial, toSerial])

  const totalToCreate = generatedDesks.length

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanHall = hallName.trim()

    if (!cleanHall) {
      toast.error('Please specify a Hall Name (e.g. Black Hall, Brown Hall).')
      return
    }

    if (toSerial < fromSerial) {
      toast.error('"To Serial No." must be greater than or equal to "From Serial No."')
      return
    }

    const existingMap = new Set(seats.map((s) => s.seatNumber.toLowerCase()))
    const toCreate = generatedDesks.filter(
      (d) => !existingMap.has(d.fullKey.toLowerCase())
    )

    if (toCreate.length === 0) {
      toast.error(`All desks from ${fromSerial} to ${toSerial} already exist in ${cleanHall}.`)
      return
    }

    const newSeatsData = toCreate.map((d) => ({
      seatNumber: d.fullKey,
      type: 'dedicated' as const, // All are Private Desks
      section: cleanHall,
    }))

    addSeatsBulk(newSeatsData)

    const skipped = generatedDesks.length - toCreate.length
    if (skipped > 0) {
      toast.success(
        `Added ${toCreate.length} Private Desks to ${cleanHall} (${skipped} already existed and were skipped).`
      )
    } else {
      toast.success(
        `Successfully added ${toCreate.length} Private Desks (Desk ${fromSerial} to Desk ${toSerial}) under ${cleanHall}!`
      )
    }

    setOpen(false)
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
            <DialogTitle>Add Private Desks by Hall Name</DialogTitle>
          </div>
          <DialogDescription>
            Enter Hall Name (e.g., Black Hall, Brown Hall) and specify the serial number range from where to where.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4 pt-2'>
          {/* Hall Name Input + Quick Selector */}
          <div className='space-y-2'>
            <Label htmlFor='hall-name' className='text-xs font-semibold'>
              Hall Name *
            </Label>
            <Input
              id='hall-name'
              value={hallName}
              onChange={(e) => setHallName(e.target.value)}
              placeholder='e.g., Black Hall, Brown Hall'
              required
              className='font-bold text-sm'
            />
            {existingHalls.length > 0 && (
              <div className='flex flex-wrap items-center gap-1.5 pt-1'>
                <span className='text-[11px] text-muted-foreground me-1'>Existing Halls:</span>
                {existingHalls.map((hall) => (
                  <Badge
                    key={hall}
                    variant={hallName === hall ? 'default' : 'outline'}
                    className='cursor-pointer text-[10px] px-2.5 py-0.5 select-none hover:opacity-80 transition-all'
                    onClick={() => setHallName(hall)}
                  >
                    {hall}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Serial Number Range: From ... To ... */}
          <div className='space-y-3 p-4 rounded-xl border bg-muted/20'>
            <div className='flex items-center gap-1.5 text-xs font-bold text-foreground'>
              <Hash className='h-4 w-4 text-primary' />
              Enter Serial No. (From Where To Where)
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label htmlFor='from-serial' className='text-xs font-medium'>
                  From Serial No. *
                </Label>
                <Input
                  id='from-serial'
                  type='number'
                  min={1}
                  value={fromSerial}
                  onChange={(e) => setFromSerial(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className='font-mono font-bold text-base h-10'
                  required
                />
              </div>

              <div className='space-y-1.5'>
                <Label htmlFor='to-serial' className='text-xs font-medium'>
                  To Serial No. *
                </Label>
                <Input
                  id='to-serial'
                  type='number'
                  min={fromSerial}
                  value={toSerial}
                  onChange={(e) => setToSerial(Math.max(fromSerial, parseInt(e.target.value, 10) || fromSerial))}
                  className='font-mono font-bold text-base h-10'
                  required
                />
              </div>
            </div>

            {/* Live Preview Box */}
            <div className='rounded-lg bg-background border p-3 space-y-1.5 shadow-2xs'>
              <div className='flex items-center justify-between'>
                <span className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>
                  Generation Summary
                </span>
                <Badge variant='outline' className='text-[10px] font-mono font-bold text-primary'>
                  {totalToCreate} Private Desk{totalToCreate > 1 ? 's' : ''}
                </Badge>
              </div>
              <p className='text-xs font-semibold text-foreground'>
                Will add <span className='text-primary font-bold'>{totalToCreate} Desks</span> (Desk {fromSerial} to Desk {toSerial}) under <span className='font-bold text-primary'>{hallName || 'Hall'}</span>.
              </p>
              <div className='pt-1 text-[11px] text-muted-foreground font-mono truncate'>
                Preview: {generatedDesks.slice(0, 8).map((d) => d.label).join(', ')}
                {generatedDesks.length > 8 ? ` ... and ${generatedDesks.length - 8} more (${generatedDesks[generatedDesks.length - 1].label})` : ''}
              </div>
            </div>
          </div>

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
              Add {totalToCreate} Desks to {hallName || 'Hall'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
