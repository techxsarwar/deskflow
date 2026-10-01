import { useState } from 'react'
import { Camera, Check, Copy, ExternalLink, QrCode, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ShareLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShareLinkDialog({ open, onOpenChange }: ShareLinkDialogProps) {
  const [copied, setCopied] = useState(false)
  
  // Use current host or fallback to window.location.origin
  const registrationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join`
    : 'https://studylounge.app/join'

  const handleCopy = () => {
    navigator.clipboard.writeText(registrationUrl)
    setCopied(true)
    toast.success('Registration link copied to clipboard!')
    setTimeout(() => setCopied(false), 2500)
  }

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Welcome to Vertical Classes Library! 📚\n\nPlease complete your admission and seat registration online:\n${registrationUrl}\n\n📸 *Photo Upload:* Please keep a passport photo or selfie ready to upload for your official Library Student Pass.`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <div className='flex items-center gap-2 text-primary'>
            <div className='rounded-lg bg-primary/10 p-2'>
              <Share2 className='h-5 w-5 text-primary' />
            </div>
            <DialogTitle>Share Student Registration Link</DialogTitle>
          </div>
          <DialogDescription>
            Send this public link to students to let them self-register, choose their shift, and submit their details.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='space-y-2'>
            <Label htmlFor='link-input' className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
              Direct Public Link
            </Label>
            <div className='flex items-center gap-2'>
              <Input
                id='link-input'
                readOnly
                value={registrationUrl}
                className='font-mono text-sm bg-muted/50 select-all'
              />
              <Button
                type='button'
                size='icon'
                variant={copied ? 'default' : 'outline'}
                onClick={handleCopy}
                className='shrink-0'
                title='Copy link'
              >
                {copied ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
              </Button>
            </div>
          </div>

          <div className='rounded-lg border bg-card p-3.5 text-card-foreground shadow-xs space-y-2.5'>
            <div className='flex items-center gap-3'>
              <div className='rounded-md bg-secondary p-2.5 text-secondary-foreground'>
                <QrCode className='h-7 w-7 text-primary' />
              </div>
              <div className='flex-1'>
                <p className='text-sm font-medium'>Desk QR Code Available</p>
                <p className='text-xs text-muted-foreground'>
                  Display this link at your front desk or send directly via WhatsApp.
                </p>
              </div>
            </div>

            <div className='flex items-center gap-2 rounded-md bg-primary/5 px-2.5 py-1.5 border border-primary/10 text-[11px] text-muted-foreground'>
              <Camera className='h-3.5 w-3.5 text-primary shrink-0' />
              <span>Students can upload passport photos directly saved into Supabase S3 storage.</span>
            </div>
          </div>

          <div className='flex flex-col gap-2 sm:flex-row'>
            <Button
              className='flex-1 bg-emerald-600 hover:bg-emerald-700 text-white'
              onClick={handleWhatsAppShare}
            >
              Share on WhatsApp
            </Button>
            <Button
              variant='outline'
              className='flex-1 gap-1.5'
              onClick={() => window.open(registrationUrl, '_blank')}
            >
              <ExternalLink className='h-4 w-4' />
              Test Link in New Tab
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
