import { useState } from 'react'
import { Plus, Armchair, Sparkles, User, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SeatType } from '../types'
import { useStudyLoungeStore } from '../store/study-lounge-store'

export function AddSeatDialog() {
  const [open, setOpen] = useState(false)
  const seats = useStudyLoungeStore((s) => s.seats)
  const addSeat = useStudyLoungeStore((s) => s.addSeat)

  const [type, setType] = useState<SeatType>('dedicated')
  const [seatNumber, setSeatNumber] = useState('D-21')
  const [section, setSection] = useState('Main Silent Hall A')

  const handleTypeChange = (newType: SeatType) => {
    setType(newType)
    if (newType === 'dedicated') {
      const existingDedicated = seats.filter((s) => s.type === 'dedicated').length
      setSeatNumber(`D-${String(existingDedicated + 1).padStart(2, '0')}`)
      setSection('Main Silent Hall A')
    } else if (newType === 'flexible') {
      const existingFlexi = seats.filter((s) => s.type === 'flexible').length
      setSeatNumber(`F-${String(existingFlexi + 1).padStart(2, '0')}`)
      setSection('Flexi Open Zone B')
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      handleTypeChange(type)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanNumber = seatNumber.trim().toUpperCase()
    const cleanSection = section.trim()

    if (!cleanNumber) {
      toast.error('Please enter a desk/cabin number.')
      return
    }

    const alreadyExists = seats.some(
      (s) => s.seatNumber.toLowerCase() === cleanNumber.toLowerCase()
    )
    if (alreadyExists) {
      toast.error(`Desk or Cabin ${cleanNumber} already exists in the system!`)
      return
    }

    addSeat({
      seatNumber: cleanNumber,
      type,
      section: cleanSection || (type === 'cabin' ? 'Private Executive Cabins' : 'Main Silent Hall A'),
    })

    toast.success(
      `${type === 'cabin' ? 'Private Cabin' : 'Study Desk'} ${cleanNumber} created successfully!`
    )
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size='sm' className='gap-1.5 text-xs font-semibold'>
          <Plus className='h-4 w-4' />
          Add Desk / Cabin
        </Button>
      </DialogTrigger>

      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <div className='flex items-center gap-2 text-primary'>
            <Armchair className='h-5 w-5' />
            <DialogTitle>Add New Desk or Private Cabin</DialogTitle>
          </div>
          <DialogDescription>
            Expand your library floor plan by adding a dedicated desk, flexible desk, or private executive cabin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4 pt-2'>
          <div className='space-y-1.5'>
            <Label htmlFor='space-type'>Space Category / Type</Label>
            <Select
              value={type}
              onValueChange={(val) => handleTypeChange(val as SeatType)}
            >
              <SelectTrigger id='space-type'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='cabin'>
                  <div className='flex items-center gap-2'>
                    <User className='h-4 w-4 text-purple-600' />
                    <span>Private Executive Cabin</span>
                  </div>
                </SelectItem>
                <SelectItem value='dedicated'>
                  <div className='flex items-center gap-2'>
                    <Armchair className='h-4 w-4 text-primary' />
                    <span>Dedicated Silent Desk</span>
                  </div>
                </SelectItem>
                <SelectItem value='flexible'>
                  <div className='flex items-center gap-2'>
                    <Sparkles className='h-4 w-4 text-amber-600' />
                    <span>Flexible Reading Desk</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='space-number'>
              {type === 'cabin' ? 'Cabin Number / Name' : 'Desk Number'}
            </Label>
            <Input
              id='space-number'
              value={seatNumber}
              onChange={(e) => setSeatNumber(e.target.value)}
              placeholder={type === 'cabin' ? 'e.g., C-01 or Cabin-1' : 'e.g., D-21'}
              required
              className='font-mono font-bold'
            />
            <p className='text-[11px] text-muted-foreground'>
              {type === 'cabin'
                ? 'Cabins will automatically appear in their own Private Cabins section on the floor plan.'
                : 'Will appear in the corresponding silent or flexible hall.'}
            </p>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='space-section'>Zone / Section Label</Label>
            <Input
              id='space-section'
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder='e.g., Private Executive Cabins'
              required
            />
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
              Save to Floor Plan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
