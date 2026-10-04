import { useState, useMemo } from 'react'
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
  Wifi,
  Wind,
  Coffee,
  BatteryCharging,
  Printer,
  ChevronRight,
  Building2,
  Armchair,
  Check,
  AlertCircle,
  FolderLock,
  Camera,
  Upload,
  Loader2,
  Scale,
  ExternalLink,
} from 'lucide-react'
import { supabaseService } from '@/features/study-lounge/lib/supabase-service'
import { getDeskDisplayNumber, getDeskFullLabel, sortSeatsNaturally } from '@/features/study-lounge/lib/seat-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { useStudyLoungeStore } from '@/features/study-lounge/store/study-lounge-store'
import { useStudyLoungeInit } from '@/features/study-lounge/hooks/use-study-lounge-init'
import { ShiftType, SeatType, MembershipPlan, Student, LoungeSeat } from '@/features/study-lounge/types'
import { SHIFT_DETAILS, PLAN_PRICING } from '@/features/study-lounge/data/mock-data'

export function PublicStudentRegistration() {
  // Sync live seat occupancy in real-time with Supabase
  useStudyLoungeInit()

  const seats = useStudyLoungeStore((s) => s.seats)
  const addStudent = useStudyLoungeStore((s) => s.addStudent)

  const [submittedStudent, setSubmittedStudent] = useState<Student | null>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [address, setAddress] = useState('')
  const [studyGoal, setStudyGoal] = useState('')
  const [shift, setShift] = useState<ShiftType>('fullday')
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<string>('')
  const [membershipPlan, setMembershipPlan] = useState<MembershipPlan>('monthly')
  const [needLocker, setNeedLocker] = useState(true)
  const [agreedToRules, setAgreedToRules] = useState(true)
  const [selectionError, setSelectionError] = useState<string | null>(null)

  // Photo upload states
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo size should be less than 5MB.')
      return
    }

    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setPhotoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Flat plan pricing — dedicated locker is 100% included in the ₹1,000/mo fee (₹0 extra)
  const selectedPlanPrice = PLAN_PRICING[membershipPlan]?.basePrice || 1000
  const totalPrice = selectedPlanPrice

  // Dynamically group all Private Desks by Hall Name (e.g. Black Hall, Brown Hall)
  const halls = useMemo(() => {
    const map = new Map<string, LoungeSeat[]>()
    seats.forEach((seat) => {
      const hallName = seat.section?.trim() || 'Main Hall'
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

  const totalVacant = seats.filter((s) => s.status === 'available').length

  const selectedSeatObj = seats.find((s) => s.seatNumber === selectedSeatNumber)

  const handleSeatClick = (seat: LoungeSeat) => {
    if (seat.status === 'occupied') {
      return
    }
    setSelectedSeatNumber(seat.seatNumber)
    setSelectionError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fullName.trim() || !phone.trim()) {
      alert('Please fill in your name and WhatsApp phone number.')
      return
    }

    if (!selectedSeatNumber) {
      setSelectionError('Please choose your vacant study cabin / desk from Section 3 before submitting.')
      const seatSection = document.getElementById('seat-selection-section')
      seatSection?.scrollIntoView({ behavior: 'smooth' })
      return
    }

    let finalPhotoUrl: string | undefined = undefined

    if (photoFile) {
      setIsUploadingPhoto(true)
      try {
        const publicUrl = await supabaseService.uploadStudentPhoto(
          photoFile,
          phone.trim() || fullName.trim()
        )
        if (publicUrl) {
          finalPhotoUrl = publicUrl
        } else {
          finalPhotoUrl = photoPreview || undefined
        }
      } catch (err) {
        console.error('Supabase photo upload error:', err)
        finalPhotoUrl = photoPreview || undefined
      } finally {
        setIsUploadingPhoto(false)
      }
    }

    const today = new Date().toISOString().split('T')[0]
    const months = PLAN_PRICING[membershipPlan]?.durationMonths || 1
    const end = new Date()
    end.setMonth(end.getMonth() + months)
    const endDate = end.toISOString().split('T')[0]

    const effectiveSeatType: SeatType = selectedSeatObj ? selectedSeatObj.type : 'dedicated'

    const newStudent = addStudent({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      photoUrl: finalPhotoUrl,
      emergencyContact: emergencyContact.trim(),
      address: address.trim(),
      studyGoal: studyGoal.trim() || 'Competitive Exam Prep',
      shift,
      seatType: effectiveSeatType,
      seatNumber: selectedSeatNumber,
      lockerNumber: needLocker ? 'Locker-Included' : undefined,
      membershipPlan,
      planAmount: totalPrice,
      amountPaid: 0,
      startDate: today,
      endDate,
      registeredVia: 'online_link',
      notes: `Student self-registered online. Selected Cabin / Desk ${selectedSeatNumber}. Dedicated locker included.`,
    })

    setSubmittedStudent(newStudent)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePrintSlip = () => {
    window.print()
  }

  const handleReset = () => {
    setSubmittedStudent(null)
    setFullName('')
    setPhone('')
    setEmail('')
    setEmergencyContact('')
    setAddress('')
    setStudyGoal('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setShift('fullday')
    setSelectedSeatNumber('')
    setMembershipPlan('monthly')
    setNeedLocker(true)
    setSelectionError(null)
  }

  // If already submitted, display student admission pass / slip
  if (submittedStudent) {
    const shiftInfo = SHIFT_DETAILS[submittedStudent.shift]
    return (
      <div className='min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4'>
        <div className='max-w-xl mx-auto'>
          {/* Success Banner */}
          <div className='text-center mb-6'>
            <div className='inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 mb-3 animate-bounce'>
              <CheckCircle2 className='h-8 w-8' />
            </div>
            <h1 className='text-2xl font-bold tracking-tight'>Admission & Desk Reserved!</h1>
            <p className='text-sm text-muted-foreground mt-1'>
              Welcome to <strong>Vertical Classes Library</strong>. Your study desk <strong>{getDeskFullLabel(submittedStudent.seatNumber)}</strong> is locked in your name.
            </p>
          </div>

          {/* Printable Admission Slip */}
          <div className='rounded-2xl border bg-card p-6 shadow-lg space-y-6 text-card-foreground print:border-none print:shadow-none'>
            <div className='flex items-center justify-between border-b pb-4'>
              <div className='flex items-center gap-3'>
                <div className='p-2.5 rounded-xl bg-primary text-primary-foreground'>
                  <Building2 className='h-6 w-6' />
                </div>
                <div>
                  <h2 className='font-bold text-lg leading-tight'>VERTICAL CLASSES LIBRARY</h2>
                  <p className='text-xs text-muted-foreground'>Student Admission Pass & Confirmation Slip</p>
                </div>
              </div>
              <div className='text-right'>
                <span className='font-mono font-bold text-primary text-sm'>{submittedStudent.regNo}</span>
                <div className='mt-1'>
                  <span className='inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'>
                    <Check className='h-3 w-3' /> Desk Reserved
                  </span>
                </div>
              </div>
            </div>

            {/* Info Grid with Photo */}
            <div className='flex flex-col sm:flex-row items-center gap-4 bg-muted/30 p-4 rounded-xl border'>
              {submittedStudent.photoUrl ? (
                <img
                  src={submittedStudent.photoUrl}
                  alt={submittedStudent.fullName}
                  className='h-20 w-20 rounded-xl object-cover border-2 border-primary/30 shadow-md shrink-0'
                />
              ) : (
                <div className='flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground shadow-md'>
                  {submittedStudent.fullName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className='flex-1 grid grid-cols-2 gap-3 text-xs w-full'>
                <div>
                  <span className='text-muted-foreground block mb-0.5'>Student Name</span>
                  <span className='font-bold text-sm text-foreground'>{submittedStudent.fullName}</span>
                </div>
                <div>
                  <span className='text-muted-foreground block mb-0.5'>Mobile / WhatsApp</span>
                  <span className='font-mono font-medium'>{submittedStudent.phone}</span>
                </div>
              </div>
            </div>

            {/* Registration Details Grid */}
            <div className='grid grid-cols-2 gap-3 text-xs bg-muted/30 p-4 rounded-xl border'>
              {/* Highlighted Reserved Seat */}
              <div className='col-span-2 p-3 rounded-lg border-2 border-emerald-500/30 bg-emerald-500/10'>
                <div className='flex items-center justify-between'>
                  <div>
                    <span className='text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block'>
                      Reserved Study Cabin / Desk
                    </span>
                    <span className='text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono'>
                      {getDeskFullLabel(submittedStudent.seatNumber)}
                    </span>
                  </div>
                  <Badge className='bg-emerald-600 text-white font-semibold text-xs py-1 px-2.5'>
                    ✓ Locked For You
                  </Badge>
                </div>
                <p className='text-[11px] text-muted-foreground mt-1'>
                  Dedicated ergonomic study cubicle with private partition walls, dedicated power sockets & reading light.
                </p>
              </div>

              <div>
                <span className='text-muted-foreground block mb-0.5'>Selected Slot / Shift</span>
                <span className='font-semibold'>{shiftInfo?.label}</span>
                <span className='block text-[11px] text-muted-foreground'>{shiftInfo?.timing}</span>
              </div>
              <div>
                <span className='text-muted-foreground block mb-0.5'>Membership Plan</span>
                <span className='font-medium capitalize'>{submittedStudent.membershipPlan.replace('_', ' ')}</span>
              </div>
              <div>
                <span className='text-muted-foreground block mb-0.5'>Total Plan Fee</span>
                <span className='font-bold text-sm text-primary'>₹{submittedStudent.planAmount.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className='text-muted-foreground block mb-0.5'>Personal Locker</span>
                <span className='font-medium text-emerald-600 dark:text-emerald-400 font-semibold'>
                  {submittedStudent.lockerNumber ? 'Included Free in ₹1,000 Plan' : 'Not Opted'}
                </span>
              </div>
              {submittedStudent.studyGoal && (
                <div className='col-span-2 pt-1 border-t'>
                  <span className='text-muted-foreground block mb-0.5'>Target Goal / Exam</span>
                  <span className='font-medium'>{submittedStudent.studyGoal}</span>
                </div>
              )}
            </div>

            {/* Next Steps for Student */}
            <div className='rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-1.5'>
              <h4 className='font-semibold text-primary flex items-center gap-1.5'>
                <Sparkles className='h-4 w-4' /> Next Steps to Begin Studying:
              </h4>
              <p className='text-muted-foreground'>
                1. Your desk <strong>{getDeskFullLabel(submittedStudent.seatNumber)}</strong> is locked under your name in our library database.
              </p>
              <p className='text-muted-foreground'>
                2. Visit reception and quote your Registration No: <strong>{submittedStudent.regNo}</strong> or phone <strong>{submittedStudent.phone}</strong>.
              </p>
              <p className='text-muted-foreground'>
                3. Collect your RFID keycard, Wi-Fi credentials & locker key, complete your fee payment, and take your desk!
              </p>
            </div>

            {/* Legal & Safety Compliance Disclosure */}
            <div className='rounded-lg bg-muted/40 border border-border/50 p-3 text-[11px] text-muted-foreground space-y-1 leading-relaxed'>
              <div className='flex items-center gap-1.5 font-semibold text-foreground text-xs'>
                <Scale className='h-3.5 w-3.5 text-primary' />
                <span>Student Undertaking & Legal Safety Terms:</span>
              </div>
              <p>
                • <b>Attendance Geofencing:</b> Attendance check-in is permitted only within the 75m GPS perimeter of Vertical Classes Library. Remote attendance is blocked and logged.
              </p>
              <p>
                • <b>Off-Premises Non-Liability:</b> The institution is strictly a self-study space provider and holds zero custody, supervisory, or legal liability for members outside library premises.
              </p>
              <p>
                • <b>Fee Policy:</b> All fees, locker charges, and deposits are strictly non-refundable and non-transferable.
              </p>
            </div>

            {/* Actions */}
            <div className='flex gap-3 pt-2 print:hidden'>
              <Button
                variant='outline'
                className='flex-1 gap-1.5'
                onClick={handlePrintSlip}
              >
                <Printer className='h-4 w-4' />
                Print / Save Slip
              </Button>
              <Button
                className='flex-1'
                onClick={handleReset}
              >
                Submit Another Application
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Registration Form View
  return (
    <div className='min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4'>
      <div className='max-w-3xl mx-auto space-y-8'>
        {/* Hero Section */}
        <div className='text-center space-y-3'>
          <div className='inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary'>
            <Sparkles className='h-3.5 w-3.5' /> Student Online Admission Portal
          </div>
          <h1 className='text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground'>
            Vertical Classes Library & Reading Room
          </h1>
          <p className='text-sm text-muted-foreground max-w-xl mx-auto'>
            Choose your own vacant study desk / cabin directly from our floor plan. Flat ₹1,000/month with locker included.
          </p>

          {/* Lounge Amenities Bar */}
          <div className='flex flex-wrap items-center justify-center gap-3 pt-3 text-xs text-muted-foreground'>
            <span className='inline-flex items-center gap-1.5 rounded-full bg-card border px-3 py-1 shadow-2xs'>
              <FolderLock className='h-3.5 w-3.5 text-primary' /> Free Personal Locker Included
            </span>
            <span className='inline-flex items-center gap-1.5 rounded-full bg-card border px-3 py-1 shadow-2xs'>
              <Wifi className='h-3.5 w-3.5 text-primary' /> High-Speed Wi-Fi
            </span>
            <span className='inline-flex items-center gap-1.5 rounded-full bg-card border px-3 py-1 shadow-2xs'>
              <Wind className='h-3.5 w-3.5 text-primary' /> 100% Air-Conditioned
            </span>
            <span className='inline-flex items-center gap-1.5 rounded-full bg-card border px-3 py-1 shadow-2xs'>
              <BatteryCharging className='h-3.5 w-3.5 text-primary' /> Power Sockets at Every Desk
            </span>
            <span className='inline-flex items-center gap-1.5 rounded-full bg-card border px-3 py-1 shadow-2xs'>
              <Coffee className='h-3.5 w-3.5 text-primary' /> RO Water
            </span>
            <span className='inline-flex items-center gap-1.5 rounded-full bg-card border px-3 py-1 shadow-2xs'>
              <BookOpen className='h-3.5 w-3.5 text-primary' /> 100% Silent Zone
            </span>
          </div>
        </div>

        {/* Admission Form */}
        <Card className='shadow-lg border'>
          <CardContent className='p-6 sm:p-8'>
            <form onSubmit={handleSubmit} className='space-y-8'>
              {/* Section 1: Personal Details */}
              <div className='space-y-4'>
                <div className='flex items-center gap-2 text-primary border-b pb-2'>
                  <span className='flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold'>
                    1
                  </span>
                  <h3 className='font-semibold text-foreground text-base'>
                    Personal & Contact Information
                  </h3>
                </div>

                {/* Passport Photo Upload Card */}
                <div className='rounded-xl border-2 border-dashed p-4 bg-muted/20 hover:bg-muted/30 transition-colors'>
                  <div className='flex flex-col sm:flex-row items-center gap-4'>
                    {/* Thumbnail Preview */}
                    <div className='relative flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border bg-background overflow-hidden shadow-xs'>
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt='Student photo preview'
                          className='h-full w-full object-cover'
                        />
                      ) : (
                        <div className='flex flex-col items-center justify-center text-muted-foreground p-2 text-center'>
                          <Camera className='h-7 w-7 text-primary/70 mb-1' />
                          <span className='text-[10px] font-medium leading-tight'>ID Photo</span>
                        </div>
                      )}
                    </div>

                    {/* Upload Controls */}
                    <div className='flex-1 space-y-1.5 text-center sm:text-left'>
                      <div className='flex flex-wrap items-center gap-2 justify-center sm:justify-start'>
                        <Label
                          htmlFor='student-photo-input'
                          className='cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all'
                        >
                          <Upload className='h-3.5 w-3.5' />
                          {photoPreview ? 'Change Photo' : 'Upload Passport Photo / Selfie'}
                        </Label>
                        {photoPreview && (
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            className='h-7 text-xs text-destructive hover:bg-destructive/10'
                            onClick={() => {
                              setPhotoFile(null)
                              setPhotoPreview(null)
                            }}
                          >
                            Remove
                          </Button>
                        )}
                        <input
                          id='student-photo-input'
                          type='file'
                          accept='image/*'
                          className='sr-only'
                          onChange={handlePhotoChange}
                        />
                      </div>
                      <p className='text-[11px] text-muted-foreground'>
                        JPG, PNG, or WEBP up to 5MB. Photo will be printed on your library gate pass & stored in Supabase S3 storage.
                      </p>
                    </div>
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='pub-fullName'>Full Name *</Label>
                    <Input
                      id='pub-fullName'
                      placeholder='e.g., Rajesh Kumar'
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='pub-phone'>WhatsApp Phone Number *</Label>
                    <Input
                      id='pub-phone'
                      placeholder='+91 98765 43210'
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='pub-email'>Email Address</Label>
                    <Input
                      id='pub-email'
                      type='email'
                      placeholder='student@example.com'
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='pub-emergency'>Emergency / Parent Contact</Label>
                    <Input
                      id='pub-emergency'
                      placeholder='+91 98765 11111 (Father)'
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                    />
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='pub-goal'>What are you preparing for?</Label>
                    <Input
                      id='pub-goal'
                      placeholder='e.g., UPSC, NEET, CA, GATE, Coding'
                      value={studyGoal}
                      onChange={(e) => setStudyGoal(e.target.value)}
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='pub-address'>Current Locality / Address</Label>
                    <Input
                      id='pub-address'
                      placeholder='e.g., Koramangala 4th Block'
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Shift / Slot Selection */}
              <div className='space-y-4'>
                <div className='flex items-center gap-2 text-primary border-b pb-2'>
                  <span className='flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold'>
                    2
                  </span>
                  <h3 className='font-semibold text-foreground text-base'>
                    Select Your Preferred Study Slot
                  </h3>
                </div>

                <RadioGroup
                  value={shift}
                  onValueChange={(val) => setShift(val as ShiftType)}
                  className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
                >
                  {Object.entries(SHIFT_DETAILS).map(([key, details]) => (
                    <Label
                      key={key}
                      htmlFor={`shift-${key}`}
                      className={`flex flex-col justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                        shift === key
                          ? 'border-primary bg-primary/5 shadow-xs'
                          : 'border-muted hover:border-muted-foreground/30 bg-card'
                      }`}
                    >
                      <div className='flex items-center justify-between'>
                        <span className='font-semibold text-sm'>{details.label}</span>
                        <RadioGroupItem value={key} id={`shift-${key}`} />
                      </div>
                      <div className='mt-2 flex items-center gap-1.5 text-xs text-muted-foreground'>
                        <Clock className='h-3.5 w-3.5 text-primary' />
                        {details.timing}
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              {/* Section 3: Select Your Vacant Private Cabin / Desk by Hall */}
              <div id='seat-selection-section' className='space-y-4'>
                <div className='flex flex-wrap items-center justify-between gap-2 border-b pb-2'>
                  <div className='flex items-center gap-2 text-primary'>
                    <span className='flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold'>
                      3
                    </span>
                    <h3 className='font-semibold text-foreground text-base'>
                      Select Your Vacant Study Cabin / Desk *
                    </h3>
                  </div>
                  <Badge variant='outline' className='text-emerald-600 border-emerald-300 gap-1.5 text-xs font-semibold'>
                    <span className='h-2 w-2 rounded-full bg-emerald-500 animate-pulse' />
                    {totalVacant} Vacant Cabins Available
                  </Badge>
                </div>

                <p className='text-xs text-muted-foreground'>
                  Choose your personal study cabin / desk below. Select your preferred Hall and click any vacant green desk to claim your seat.
                </p>

                {/* Selected Desk Status Banner */}
                {selectedSeatNumber && selectedSeatObj ? (
                  <div className='rounded-xl border-2 border-primary bg-primary/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'>
                    <div className='flex items-center gap-3'>
                      <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold font-mono text-base shadow-sm'>
                        {getDeskDisplayNumber(selectedSeatNumber, selectedSeatObj.section)}
                      </div>
                      <div>
                        <div className='flex items-center gap-2'>
                          <span className='font-bold text-sm text-foreground'>
                            {getDeskFullLabel(selectedSeatNumber, selectedSeatObj.section)}
                          </span>
                          <Badge className='bg-emerald-600 text-white hover:bg-emerald-700 text-[10px] px-2 py-0.5'>
                            ✓ Selected & Vacant
                          </Badge>
                        </div>
                        <p className='text-xs text-muted-foreground mt-0.5'>
                          {selectedSeatObj.section} • Reserved exclusively for you upon admission.
                        </p>
                      </div>
                    </div>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='text-xs self-start sm:self-auto shrink-0'
                      onClick={() => setSelectedSeatNumber('')}
                    >
                      Change Desk
                    </Button>
                  </div>
                ) : (
                  <div className='rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-center'>
                    <p className='text-xs font-medium text-muted-foreground flex items-center justify-center gap-1.5'>
                      <Sparkles className='h-4 w-4 text-primary' /> Click on any vacant green desk below to claim your seat
                    </p>
                  </div>
                )}

                {/* Validation Error Message */}
                {selectionError && (
                  <div className='flex items-center gap-2 text-destructive text-xs font-semibold bg-destructive/10 border border-destructive/30 p-3 rounded-lg'>
                    <AlertCircle className='h-4 w-4 shrink-0' />
                    {selectionError}
                  </div>
                )}

                {/* Legend */}
                <div className='flex items-center gap-4 text-[11px] text-muted-foreground pt-1'>
                  <span className='flex items-center gap-1.5'>
                    <span className='h-2.5 w-2.5 rounded-full bg-emerald-500' /> Vacant (Available)
                  </span>
                  <span className='flex items-center gap-1.5'>
                    <span className='h-2.5 w-2.5 rounded-full bg-primary' /> Your Selected Desk
                  </span>
                  <span className='flex items-center gap-1.5'>
                    <span className='h-2.5 w-2.5 rounded-full bg-muted-foreground/40' /> Occupied (Locked)
                  </span>
                </div>

                {/* Dynamically Render Each Hall with Total Cabins & Desks */}
                <div className='space-y-6 pt-2'>
                  {halls.map(([hallName, hallSeats]) => {
                    const hallVacant = hallSeats.filter((s) => s.status === 'available').length

                    return (
                      <div key={hallName} className='rounded-2xl border p-4 sm:p-5 bg-card/60 shadow-xs space-y-3'>
                        <div className='flex flex-wrap items-center justify-between gap-2 border-b pb-2.5'>
                          <div className='flex items-center gap-2'>
                            <div className='p-1.5 rounded-lg bg-primary/10 text-primary'>
                              <Building2 className='h-4 w-4' />
                            </div>
                            <span className='font-bold text-sm sm:text-base text-foreground'>
                              {hallName}
                            </span>
                          </div>
                          <div className='flex items-center gap-2'>
                            <Badge variant='outline' className='text-xs font-semibold text-muted-foreground'>
                              Total Cabins: {hallSeats.length}
                            </Badge>
                            <Badge
                              variant='outline'
                              className='text-xs font-semibold text-emerald-600 border-emerald-300 bg-emerald-500/10'
                            >
                              {hallVacant} Available
                            </Badge>
                          </div>
                        </div>

                        {/* Desks Grid for this Hall */}
                        <div className='grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2'>
                          {hallSeats.map((seat) => {
                            const isSelected = selectedSeatNumber === seat.seatNumber
                            const isOccupied = seat.status === 'occupied'
                            const displayNum = getDeskDisplayNumber(seat.seatNumber, hallName)

                            return (
                              <button
                                type='button'
                                key={seat.id}
                                disabled={isOccupied}
                                onClick={() => handleSeatClick(seat)}
                                className={`p-2 rounded-xl border-2 flex flex-col items-center justify-between text-center transition-all ${
                                  isSelected
                                    ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 scale-105 shadow-md z-10'
                                    : isOccupied
                                      ? 'border-muted bg-muted/40 text-muted-foreground opacity-45 cursor-not-allowed'
                                      : 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-600 hover:bg-emerald-500/15 cursor-pointer text-foreground'
                                }`}
                              >
                                <span className='font-mono font-bold text-xs sm:text-sm'>{displayNum}</span>
                                <Armchair
                                  className={`h-4 w-4 my-1 ${
                                    isSelected
                                      ? 'text-primary-foreground'
                                      : isOccupied
                                        ? 'text-muted-foreground'
                                        : 'text-emerald-600'
                                  }`}
                                />
                                <span className='text-[8px] sm:text-[9px] font-semibold block truncate w-full'>
                                  {isSelected ? '✓ Picked' : isOccupied ? 'Occupied' : 'Vacant'}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {halls.length === 0 && (
                    <div className='p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl'>
                      No study halls or desks currently available.
                    </div>
                  )}
                </div>

                {/* Free Personal Locker Option (100% Included) */}
                <div className='flex items-center justify-between p-3.5 rounded-xl border bg-muted/20 mt-3'>
                  <div className='flex items-center space-x-2'>
                    <Checkbox
                      id='locker'
                      checked={needLocker}
                      onCheckedChange={(checked) => setNeedLocker(!!checked)}
                    />
                    <Label
                      htmlFor='locker'
                      className='text-xs sm:text-sm font-medium leading-none cursor-pointer'
                    >
                      Personal Lockable Storage Locker for Books & Bag
                    </Label>
                  </div>
                  <Badge variant='outline' className='bg-emerald-500/10 text-emerald-600 border-emerald-300 text-[11px] font-semibold'>
                    Included Free (₹0 Extra)
                  </Badge>
                </div>
              </div>

              {/* Section 4: Membership Plan & Pricing (Flat 1k/month) */}
              <div className='space-y-4'>
                <div className='flex items-center gap-2 text-primary border-b pb-2'>
                  <span className='flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold'>
                    4
                  </span>
                  <h3 className='font-semibold text-foreground text-base'>
                    Select Membership Plan (Flat ₹1,000 / Month)
                  </h3>
                </div>

                <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                  {Object.entries(PLAN_PRICING).map(([key, plan]) => {
                    const isSelected = membershipPlan === key
                    return (
                      <div
                        key={key}
                        onClick={() => setMembershipPlan(key as MembershipPlan)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-xs'
                            : 'border-muted bg-card hover:border-muted-foreground/30'
                        }`}
                      >
                        <span className='text-xs font-semibold text-muted-foreground uppercase block'>
                          {plan.label}
                        </span>
                        <div className='mt-2 font-extrabold text-xl text-foreground'>
                          ₹{plan.basePrice.toLocaleString('en-IN')}
                        </div>
                        <span className='text-[11px] text-muted-foreground mt-1 block'>
                          {plan.durationMonths === 0 ? 'Single Day' : `${plan.durationMonths} Month(s)`}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Pricing Summary Box */}
                <div className='rounded-xl bg-muted/40 border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                  <div>
                    <span className='text-xs text-muted-foreground block'>Total Membership Fee:</span>
                    <span className='text-2xl font-black text-foreground'>
                      ₹{totalPrice.toLocaleString('en-IN')}
                    </span>
                    <span className='text-xs text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5'>
                      ✓ Free Dedicated Locker Included • No Hidden Charges
                    </span>
                  </div>
                  <div className='text-left sm:text-right text-xs text-muted-foreground space-y-0.5'>
                    <p>✓ High-Speed 5G Wi-Fi</p>
                    <p>✓ Filtered RO Drinking Water</p>
                    <p>✓ 100% Air-Conditioned Silent Zone</p>
                  </div>
                </div>
              </div>

              {/* Rules, GPS Consent & Legal Submit */}
              <div className='space-y-4 pt-3 border-t'>
                <div className='rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5 text-xs'>
                  <div className='flex items-center justify-between'>
                    <span className='font-semibold text-foreground flex items-center gap-1.5'>
                      <Scale className='h-4 w-4 text-primary' />
                      Study Lounge Rules & Legal Terms
                    </span>
                    <a
                      href='/terms'
                      target='_blank'
                      rel='noreferrer'
                      className='inline-flex items-center gap-1 font-semibold text-primary hover:underline text-[11px]'
                    >
                      Read Full Policies
                      <ExternalLink className='h-3 w-3' />
                    </a>
                  </div>
                  <ul className='grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-muted-foreground text-[11px] leading-tight'>
                    <li className='flex items-start gap-1.5'>
                      <Check className='h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5' />
                      <span><b>Strict Silence:</b> Phones on silent; zero reading room disturbance.</span>
                    </li>
                    <li className='flex items-start gap-1.5'>
                      <Check className='h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5' />
                      <span><b>75m GPS Geofence:</b> Attendance marks valid only inside library.</span>
                    </li>
                    <li className='flex items-start gap-1.5'>
                      <Check className='h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5' />
                      <span><b>Non-Liability:</b> Zero institutional custody/liability outside library.</span>
                    </li>
                    <li className='flex items-start gap-1.5'>
                      <Check className='h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5' />
                      <span><b>No Refunds:</b> Membership deposits are non-refundable/non-transferable.</span>
                    </li>
                  </ul>
                </div>

                <div className='flex items-start space-x-2.5'>
                  <Checkbox
                    id='rules'
                    checked={agreedToRules}
                    onCheckedChange={(c) => setAgreedToRules(!!c)}
                    className='mt-0.5'
                  />
                  <Label
                    htmlFor='rules'
                    className='text-xs text-muted-foreground leading-relaxed cursor-pointer'
                  >
                    I have read and agree to the{' '}
                    <a
                      href='/terms'
                      target='_blank'
                      rel='noreferrer'
                      className='font-semibold text-foreground underline underline-offset-2 hover:text-primary'
                    >
                      Terms of Service
                    </a>
                    , agree to maintain complete silence, consent to the{' '}
                    <a
                      href='/privacy'
                      target='_blank'
                      rel='noreferrer'
                      className='font-semibold text-foreground underline underline-offset-2 hover:text-primary'
                    >
                      Privacy & GPS Location Policy
                    </a>{' '}
                    for attendance verification, and acknowledge the{' '}
                    <a
                      href='/terms'
                      target='_blank'
                      rel='noreferrer'
                      className='font-semibold text-foreground underline underline-offset-2 hover:text-primary'
                    >
                      Off-Premises Safety & Non-Liability Disclaimer
                    </a>
                    .
                  </Label>
                </div>

                <Button
                  type='submit'
                  size='lg'
                  disabled={!agreedToRules || isUploadingPhoto}
                  className='w-full text-sm sm:text-base font-semibold py-5 sm:py-6 shadow-md'
                >
                  {isUploadingPhoto ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Processing Admission & Desk Lock...
                    </>
                  ) : (
                    <>
                      {selectedSeatNumber
                        ? `Reserve Desk ${selectedSeatNumber} & Get Admission Slip`
                        : 'Select Your Desk & Get Admission Slip'}
                      <ChevronRight className='ml-2 h-5 w-5' />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
