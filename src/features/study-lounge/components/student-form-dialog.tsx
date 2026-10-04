import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Loader2, Trash2, Upload, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Student, ShiftType, SeatType, MembershipPlan, LoungeSeat } from '../types'
import { PLAN_PRICING } from '../data/mock-data'
import { getDeskFullLabel, sortSeatsNaturally } from '../lib/seat-utils'
import { supabaseService } from '../lib/supabase-service'
import { useStudyLoungeStore } from '../store/study-lounge-store'

interface StudentFormDialogProps {
  student?: Student | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StudentFormDialog({
  student,
  open,
  onOpenChange,
}: StudentFormDialogProps) {
  const addStudent = useStudyLoungeStore((s) => s.addStudent)
  const updateStudent = useStudyLoungeStore((s) => s.updateStudent)
  const seats = useStudyLoungeStore((s) => s.seats)

  const isEditing = !!student

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    emergencyContact: '',
    address: '',
    studyGoal: 'UPSC Civil Services',
    shift: 'morning' as ShiftType,
    seatType: 'dedicated' as SeatType,
    seatNumber: '',
    lockerNumber: '',
    membershipPlan: 'monthly' as MembershipPlan,
    planAmount: 1000,
    amountPaid: 1000,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    notes: '',
  })

  // Calculate default end date based on plan
  const calculateEndDate = (startDate: string, plan: MembershipPlan) => {
    const start = new Date(startDate)
    const months = PLAN_PRICING[plan]?.durationMonths || 1
    if (months === 0) {
      // daily pass
      return startDate
    }
    const end = new Date(start)
    end.setMonth(end.getMonth() + months)
    return end.toISOString().split('T')[0]
  }

  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (student) {
      setPhotoPreview(student.photoUrl || null)
      setPhotoFile(null)
      setFormData({
        fullName: student.fullName,
        email: student.email,
        phone: student.phone,
        emergencyContact: student.emergencyContact,
        address: student.address,
        studyGoal: student.studyGoal,
        shift: student.shift,
        seatType: student.seatType,
        seatNumber: student.seatNumber,
        lockerNumber: student.lockerNumber || '',
        membershipPlan: student.membershipPlan,
        planAmount: student.planAmount,
        amountPaid: student.amountPaid,
        startDate: student.startDate,
        endDate: student.endDate,
        notes: student.notes || '',
      })
    } else {
      const today = new Date().toISOString().split('T')[0]
      const defaultPlan: MembershipPlan = 'monthly'
      setPhotoPreview(null)
      setPhotoFile(null)
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        emergencyContact: '',
        address: '',
        studyGoal: 'General Competitive Exams',
        shift: 'fullday',
        seatType: 'dedicated',
        seatNumber: '',
        lockerNumber: '',
        membershipPlan: defaultPlan,
        planAmount: PLAN_PRICING[defaultPlan].basePrice,
        amountPaid: PLAN_PRICING[defaultPlan].basePrice,
        startDate: today,
        endDate: calculateEndDate(today, defaultPlan),
        notes: '',
      })
    }
  }, [student, open])

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG, WebP)')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    setPhotoFile(file)
    const previewUrl = URL.createObjectURL(file)
    setPhotoPreview(previewUrl)
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handlePlanChange = (plan: MembershipPlan) => {
    const price = PLAN_PRICING[plan]?.basePrice || 1000
    const endDate = calculateEndDate(formData.startDate, plan)
    setFormData((prev) => ({
      ...prev,
      membershipPlan: plan,
      planAmount: price,
      amountPaid: isEditing ? prev.amountPaid : price,
      endDate,
    }))
  }

  const handleStartDateChange = (startDate: string) => {
    const endDate = calculateEndDate(startDate, formData.membershipPlan)
    setFormData((prev) => ({
      ...prev,
      startDate,
      endDate,
    }))
  }

  const availableSeats = useMemo<LoungeSeat[]>(() => {
    const filtered = seats.filter(
      (s) => s.status === 'available' || (student && s.seatNumber === student.seatNumber)
    )
    return sortSeatsNaturally(filtered)
  }, [seats, student])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.fullName.trim() || !formData.phone.trim()) {
      toast.error('Please enter student name and phone number')
      return
    }

    setIsUploading(true)
    let finalPhotoUrl = photoPreview || undefined

    if (photoFile) {
      try {
        const uploadedUrl = await supabaseService.uploadStudentPhoto(
          photoFile,
          formData.phone || formData.fullName
        )
        if (uploadedUrl) {
          finalPhotoUrl = uploadedUrl
        }
      } catch (err) {
        console.error('Supabase photo upload error:', err)
      }
    }

    if (isEditing && student) {
      updateStudent(student.id, {
        ...formData,
        photoUrl: finalPhotoUrl || '',
      })
      toast.success('Student record updated successfully!')
    } else {
      addStudent({
        ...formData,
        photoUrl: finalPhotoUrl,
        registeredVia: 'admin_desk',
      })
      toast.success('New student enrolled successfully!')
    }

    setIsUploading(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Student Record' : 'Enroll New Student'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update seat, shift, contact, or membership details.'
              : 'Add a new member to the study lounge from the reception desk.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4 py-2'>
          {/* Photo Upload Section */}
          <div className='flex items-center gap-4 p-3.5 rounded-xl border bg-muted/30'>
            <div className='relative h-20 w-20 shrink-0 rounded-xl overflow-hidden border-2 border-dashed border-primary/40 bg-background flex items-center justify-center shadow-xs'>
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt='Student Preview'
                  className='h-full w-full object-cover'
                />
              ) : (
                <div className='flex flex-col items-center justify-center text-muted-foreground p-2 text-center'>
                  <User className='h-7 w-7 text-muted-foreground/60 mb-0.5' />
                  <span className='text-[9px] font-medium'>No Photo</span>
                </div>
              )}
            </div>

            <div className='flex-1 space-y-1.5'>
              <h4 className='text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5'>
                <Camera className='h-3.5 w-3.5 text-primary' />
                Student Photo / Avatar
              </h4>
              <p className='text-xs text-muted-foreground'>
                Upload passport photo or webcam snap. Saved directly in Supabase S3 storage for ID card & receipts.
              </p>

              <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                className='hidden'
                onChange={handlePhotoSelect}
              />

              <div className='flex items-center gap-2 pt-0.5'>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className='h-8 text-xs gap-1.5'
                >
                  <Upload className='h-3.5 w-3.5' />
                  {photoPreview ? 'Change Photo' : 'Upload Photo'}
                </Button>

                {photoPreview && (
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    onClick={handleRemovePhoto}
                    disabled={isUploading}
                    className='h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1'
                  >
                    <Trash2 className='h-3.5 w-3.5' />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label htmlFor='fullName'>Full Name *</Label>
              <Input
                id='fullName'
                value={formData.fullName}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, fullName: e.target.value }))
                }
                placeholder='e.g., Vikram Joshi'
                required
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='phone'>Phone Number (WhatsApp) *</Label>
              <Input
                id='phone'
                value={formData.phone}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder='+91 98765 43210'
                required
              />
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label htmlFor='email'>Email Address</Label>
              <Input
                id='email'
                type='email'
                value={formData.email}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, email: e.target.value }))
                }
                placeholder='student@example.com'
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='emergencyContact'>Emergency / Guardian Phone</Label>
              <Input
                id='emergencyContact'
                value={formData.emergencyContact}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, emergencyContact: e.target.value }))
                }
                placeholder='+91 98765 00000 (Father)'
              />
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label htmlFor='studyGoal'>Target Exam / Course</Label>
              <Input
                id='studyGoal'
                value={formData.studyGoal}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, studyGoal: e.target.value }))
                }
                placeholder='e.g., UPSC, NEET, CA Final, GATE'
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='address'>Address / Area</Label>
              <Input
                id='address'
                value={formData.address}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, address: e.target.value }))
                }
                placeholder='e.g., HSR Layout, Sector 1'
              />
            </div>
          </div>

          {/* Lounge Shift & Seat Info */}
          <div className='border-t pt-3'>
            <h4 className='text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3'>
              Seat & Slot Allocation
            </h4>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label>Shift / Slot</Label>
                <Select
                  value={formData.shift}
                  onValueChange={(val) =>
                    setFormData((p) => ({ ...p, shift: val as ShiftType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='morning'>Morning (6 AM - 12 PM)</SelectItem>
                    <SelectItem value='afternoon'>Afternoon (12 PM - 6 PM)</SelectItem>
                    <SelectItem value='evening'>Evening (6 PM - 11 PM)</SelectItem>
                    <SelectItem value='night'>Night Owl (10 PM - 6 AM)</SelectItem>
                    <SelectItem value='fullday'>Full Day Access (24/7)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1.5'>
                <Label>Assign Private Desk</Label>
                <Select
                  value={formData.seatNumber}
                  onValueChange={(val) => {
                    setFormData((p) => ({
                      ...p,
                      seatNumber: val,
                      seatType: 'dedicated',
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select Private Desk' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='Unassigned'>Unassigned / Flex</SelectItem>
                    {availableSeats.map((seat: LoungeSeat) => (
                      <SelectItem key={seat.id} value={seat.seatNumber}>
                        {getDeskFullLabel(seat.seatNumber, seat.section)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3'>
              <div className='space-y-1.5'>
                <Label htmlFor='lockerNumber'>Locker Number (Optional)</Label>
                <Input
                  id='lockerNumber'
                  value={formData.lockerNumber}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, lockerNumber: e.target.value }))
                  }
                  placeholder='e.g., L-07'
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='notes'>Special Notes</Label>
                <Input
                  id='notes'
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder='e.g., Silent row requested'
                />
              </div>
            </div>
          </div>

          {/* Membership & Payment */}
          <div className='border-t pt-3'>
            <h4 className='text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3'>
              Membership Plan & Fee
            </h4>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label>Membership Duration</Label>
                <Select
                  value={formData.membershipPlan}
                  onValueChange={(val) =>
                    handlePlanChange(val as MembershipPlan)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='daily_pass'>Daily Pass (₹150)</SelectItem>
                    <SelectItem value='monthly'>1 Month (₹1,000)</SelectItem>
                    <SelectItem value='quarterly'>3 Months (₹2,800)</SelectItem>
                    <SelectItem value='half_yearly'>6 Months (₹5,400)</SelectItem>
                    <SelectItem value='yearly'>1 Year (₹10,000)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='grid grid-cols-2 gap-2'>
                <div className='space-y-1.5'>
                  <Label htmlFor='startDate'>Start Date</Label>
                  <Input
                    id='startDate'
                    type='date'
                    value={formData.startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    required
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='endDate'>Expiry Date</Label>
                  <Input
                    id='endDate'
                    type='date'
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, endDate: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3'>
              <div className='space-y-1.5'>
                <Label htmlFor='planAmount'>Plan Fee (₹)</Label>
                <Input
                  id='planAmount'
                  type='number'
                  value={formData.planAmount}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      planAmount: Number(e.target.value),
                    }))
                  }
                  required
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='amountPaid'>Amount Paid Now (₹)</Label>
                <Input
                  id='amountPaid'
                  type='number'
                  value={formData.amountPaid}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      amountPaid: Number(e.target.value),
                    }))
                  }
                  required
                />
              </div>
            </div>
          </div>

          <DialogFooter className='pt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isUploading} className='gap-2'>
              {isUploading && <Loader2 className='h-4 w-4 animate-spin' />}
              {isEditing ? 'Save Changes' : 'Enroll Student'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
