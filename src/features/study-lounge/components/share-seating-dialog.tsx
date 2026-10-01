import { useState, useEffect, useMemo } from 'react'
import {
  Armchair,
  Check,
  Copy,
  MessageSquare,
  RotateCcw,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LoungeSeat, Student } from '../types'
import { buildSeatingArrangementBroadcastMessage } from '../lib/receipt-utils'

interface ShareSeatingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seats: LoungeSeat[]
  students: Student[]
}

export function ShareSeatingDialog({
  open,
  onOpenChange,
  seats,
  students,
}: ShareSeatingDialogProps) {
  const [filterType, setFilterType] = useState<'all' | 'occupied' | 'vacant'>('all')
  const [includeGuidelines, setIncludeGuidelines] = useState(true)
  const [includeLink, setIncludeLink] = useState(true)
  const [editableMessage, setEditableMessage] = useState('')
  const [copied, setCopied] = useState(false)

  // Metrics
  const totalDesks = seats.length
  const occupiedDesks = seats.filter((s) => s.status === 'occupied').length
  const vacantDesks = totalDesks - occupiedDesks
  const occupancyPct =
    totalDesks > 0 ? Math.round((occupiedDesks / totalDesks) * 100) : 0

  // Regenerate message whenever settings change
  const generateMessage = () => {
    return buildSeatingArrangementBroadcastMessage({
      seats,
      students,
      filterType,
      includeGuidelines,
      admissionUrl: includeLink
        ? typeof window !== 'undefined'
          ? `${window.location.origin}/join`
          : 'https://studylounge.app/join'
        : undefined,
    })
  }

  useEffect(() => {
    if (open) {
      setEditableMessage(generateMessage())
    }
  }, [open, filterType, includeGuidelines, includeLink, seats, students])

  const handleReset = () => {
    setEditableMessage(generateMessage())
    toast.info('Message reset to default format.')
  }

  const handleCopy = () => {
    if (!editableMessage) return
    navigator.clipboard.writeText(editableMessage)
    setCopied(true)
    toast.success('Seating arrangement copied to clipboard!')
    setTimeout(() => setCopied(false), 2500)
  }

  const handleForwardToWhatsApp = () => {
    if (!editableMessage) return
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(
      editableMessage
    )}`
    window.open(url, '_blank')
    toast.success('Opening WhatsApp! Select your Community Group to share the seating roster.')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <div className='flex items-center gap-2.5 text-primary'>
            <div className='rounded-xl bg-primary/10 p-2.5'>
              <Share2 className='h-5 w-5 text-primary' />
            </div>
            <div>
              <DialogTitle className='text-lg font-bold'>
                Share Seating Arrangement on WhatsApp
              </DialogTitle>
              <DialogDescription className='text-xs'>
                Broadcast the official library seating allocation to community groups, WhatsApp channels, or student batches.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          {/* Floor Summary Metrics */}
          <div className='grid grid-cols-3 gap-2 text-center p-3 rounded-xl border bg-muted/30'>
            <div>
              <span className='text-[10px] uppercase font-bold text-muted-foreground block'>
                Total Desks
              </span>
              <span className='text-lg font-black text-foreground'>{totalDesks}</span>
            </div>
            <div className='border-x border-border/60'>
              <span className='text-[10px] uppercase font-bold text-muted-foreground block'>
                Occupied
              </span>
              <span className='text-lg font-black text-primary'>
                {occupiedDesks} ({occupancyPct}%)
              </span>
            </div>
            <div>
              <span className='text-[10px] uppercase font-bold text-muted-foreground block'>
                Vacant
              </span>
              <span className='text-lg font-black text-emerald-600 dark:text-emerald-400'>
                {vacantDesks}
              </span>
            </div>
          </div>

          {/* Filter & Customization Controls */}
          <div className='space-y-2'>
            <Label className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
              Roster View Filter
            </Label>
            <div className='grid grid-cols-3 gap-2'>
              <Button
                type='button'
                variant={filterType === 'all' ? 'default' : 'outline'}
                size='sm'
                className='text-xs'
                onClick={() => setFilterType('all')}
              >
                All Desks ({totalDesks})
              </Button>
              <Button
                type='button'
                variant={filterType === 'occupied' ? 'default' : 'outline'}
                size='sm'
                className='text-xs'
                onClick={() => setFilterType('occupied')}
              >
                Occupied Only ({occupiedDesks})
              </Button>
              <Button
                type='button'
                variant={filterType === 'vacant' ? 'default' : 'outline'}
                size='sm'
                className='text-xs'
                onClick={() => setFilterType('vacant')}
              >
                Vacant Only ({vacantDesks})
              </Button>
            </div>
          </div>

          {/* Options Toggles */}
          <div className='flex flex-wrap items-center gap-4 text-xs pt-1'>
            <label className='flex items-center gap-2 cursor-pointer select-none'>
              <input
                type='checkbox'
                checked={includeGuidelines}
                onChange={(e) => setIncludeGuidelines(e.target.checked)}
                className='rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5'
              />
              <span className='text-muted-foreground'>Include Library Rules & Etiquette</span>
            </label>

            <label className='flex items-center gap-2 cursor-pointer select-none'>
              <input
                type='checkbox'
                checked={includeLink}
                onChange={(e) => setIncludeLink(e.target.checked)}
                className='rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5'
              />
              <span className='text-muted-foreground'>Include Online Admission Link</span>
            </label>
          </div>

          {/* Editable WhatsApp Preview Textarea */}
          <div className='space-y-1.5'>
            <div className='flex items-center justify-between'>
              <Label
                htmlFor='seating-text'
                className='text-xs font-semibold flex items-center gap-1.5 text-muted-foreground'
              >
                <MessageSquare className='h-3.5 w-3.5 text-emerald-600' />
                WhatsApp Message Content (Editable)
              </Label>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={handleReset}
                className='h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-1.5'
              >
                <RotateCcw className='h-3 w-3' />
                Reset
              </Button>
            </div>

            <Textarea
              id='seating-text'
              value={editableMessage}
              onChange={(e) => setEditableMessage(e.target.value)}
              rows={12}
              className='font-mono text-xs leading-relaxed bg-muted/20 border-border/80 resize-y select-text'
              placeholder='Generating seating arrangement...'
            />
            <p className='text-[11px] text-muted-foreground'>
              💡 You can freely edit this text, add custom batch notes, or change guidelines before sharing.
            </p>
          </div>

          {/* Action Buttons */}
          <div className='flex flex-col sm:flex-row gap-2.5 pt-2 border-t'>
            <Button
              type='button'
              className='flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-xs'
              onClick={handleForwardToWhatsApp}
            >
              <Users className='h-4 w-4' />
              Forward to WhatsApp Community Group
            </Button>

            <Button
              type='button'
              variant='outline'
              onClick={handleCopy}
              className='sm:w-auto gap-1.5'
            >
              {copied ? <Check className='h-4 w-4 text-emerald-600' /> : <Copy className='h-4 w-4' />}
              {copied ? 'Copied' : 'Copy Text'}
            </Button>

            <Button
              type='button'
              variant='ghost'
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
