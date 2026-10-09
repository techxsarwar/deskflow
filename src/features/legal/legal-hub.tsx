import { useState } from 'react'
import {
  ShieldCheck,
  FileText,
  MapPin,
  AlertTriangle,
  Lock,
  PhoneCall,
  CheckCircle2,
  Scale,
  Printer,
  ArrowLeft,
  Search,
  ExternalLink,
  Building2,
  Calendar,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

interface LegalHubProps {
  defaultTab?: 'terms' | 'privacy' | 'liability'
}

export function LegalHub({ defaultTab = 'terms' }: LegalHubProps) {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'liability'>(defaultTab)
  const [searchQuery, setSearchQuery] = useState('')

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className='min-h-screen bg-gradient-to-b from-background via-muted/20 to-background text-foreground py-10 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-4xl mx-auto space-y-8'>
        {/* Navigation & Header */}
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden'>
          <div className='flex items-center gap-2'>
            <Button
              variant='ghost'
              size='sm'
              className='gap-1.5 text-muted-foreground hover:text-foreground'
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back()
                } else {
                  window.location.href = '/join'
                }
              }}
            >
              <ArrowLeft className='h-4 w-4' />
              Back
            </Button>
            <Badge variant='outline' className='bg-primary/5 text-primary border-primary/20 gap-1 py-1'>
              <Sparkles className='h-3 w-3' />
              Legal & Compliance Center
            </Badge>
          </div>

          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={handlePrint}
              className='gap-1.5 shadow-sm'
            >
              <Printer className='h-3.5 w-3.5' />
              Print / Save PDF
            </Button>
            <Button
              size='sm'
              className='gap-1.5 shadow-sm'
              onClick={() => (window.location.href = '/join')}
            >
              Student Admission
              <ExternalLink className='h-3.5 w-3.5' />
            </Button>
          </div>
        </div>

        {/* Hero Title */}
        <div className='text-center space-y-3 pt-2 pb-2'>
          <div className='inline-flex p-3 rounded-2xl bg-primary/10 text-primary mb-1 border border-primary/20 shadow-inner'>
            <Scale className='h-8 w-8' />
          </div>
          <h1 className='text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text'>
            Vertical Classes Study Lounge & Library
          </h1>
          <p className='text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed'>
            Official Terms of Service, Privacy Policy, Geofenced GPS Attendance Protocol, and Student Safety Agreement.
          </p>
          <div className='flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground pt-1'>
            <span className='flex items-center gap-1.5'>
              <Building2 className='h-3.5 w-3.5 text-primary' />
              Anantnag, Kashmir (Coords: 33.617014, 74.924696)
            </span>
            <span className='flex items-center gap-1.5'>
              <Calendar className='h-3.5 w-3.5 text-primary' />
              Last Revised: October 2026
            </span>
            <span className='flex items-center gap-1.5'>
              <ShieldCheck className='h-3.5 w-3.5 text-emerald-500' />
              India DPDP Act 2023 & IT Act 2000 Compliant
            </span>
          </div>
        </div>

        {/* Search Filter */}
        <div className='relative print:hidden'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Search policies, GPS rules, refund terms, liability clauses...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='pl-9 bg-card/60 backdrop-blur border-muted-foreground/20 h-10 text-sm shadow-sm'
          />
        </div>

        {/* Tabbed Content */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as any)}
          className='w-full space-y-6'
        >
          <TabsList className='grid grid-cols-3 w-full h-11 p-1 bg-muted/60 border rounded-xl shadow-xs print:hidden'>
            <TabsTrigger
              value='terms'
              className='gap-1.5 text-xs sm:text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm'
            >
              <FileText className='h-4 w-4 text-blue-500' />
              <span className='hidden sm:inline'>Terms of Service & Rules</span>
              <span className='sm:hidden'>Terms</span>
            </TabsTrigger>
            <TabsTrigger
              value='privacy'
              className='gap-1.5 text-xs sm:text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm'
            >
              <Lock className='h-4 w-4 text-emerald-500' />
              <span className='hidden sm:inline'>Privacy & GPS Policy</span>
              <span className='sm:hidden'>Privacy</span>
            </TabsTrigger>
            <TabsTrigger
              value='liability'
              className='gap-1.5 text-xs sm:text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm'
            >
              <AlertTriangle className='h-4 w-4 text-amber-500' />
              <span className='hidden sm:inline'>Safety & Non-Liability</span>
              <span className='sm:hidden'>Non-Liability</span>
            </TabsTrigger>
          </TabsList>

          {/* ========================================================================= */}
          {/* TAB 1: TERMS OF SERVICE & CODE OF CONDUCT */}
          {/* ========================================================================= */}
          <TabsContent value='terms' className='space-y-6 focus-visible:outline-none'>
            <Card className='border-muted-foreground/20 shadow-sm overflow-hidden'>
              <CardHeader className='bg-muted/30 border-b border-border/50 pb-4'>
                <div className='flex items-center gap-2.5'>
                  <div className='p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400'>
                    <FileText className='h-5 w-5' />
                  </div>
                  <div>
                    <CardTitle className='text-xl font-bold'>Terms of Service & Lounge Code of Conduct</CardTitle>
                    <CardDescription className='text-xs'>
                      Governs admission, seat usage, attendance discipline, and conduct at Vertical Classes Study Lounge.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='p-6 sm:p-8 space-y-6 text-sm text-foreground/90 leading-relaxed'>
                <div className='space-y-3'>
                  <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-primary' />
                    1. Acceptance of Terms & Admission
                  </h3>
                  <p>
                    By registering for membership at <b>Vertical Classes Study Lounge & Library</b> via the online portal
                    (<a href='/join' className='text-primary underline underline-offset-4'>/join</a>) or at the counter,
                    you (“Student” or “Member”) enter into a binding agreement with library administration. Admission to the
                    study halls is a revocable privilege granted solely for focused academic preparation.
                  </p>
                </div>

                <Separator />

                <div className='space-y-3'>
                  <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-primary' />
                    2. Desk Allocation & Seating Discipline
                  </h3>
                  <ul className='list-disc pl-5 space-y-2 text-muted-foreground'>
                    <li>
                      <b className='text-foreground'>Exclusive Seat Allocation:</b> Every student is allotted a dedicated or
                      scheduled desk (e.g., Premium Cabin, First Row, Standard Desk) for their selected shift (Morning, Afternoon, Evening, Night Owl, or Full Day).
                    </li>
                    <li>
                      <b className='text-foreground'>No Unauthorized Swapping:</b> Occupying a desk not assigned to you, reserving desks
                      for friends, or leaving items on unauthorized desks is strictly prohibited.
                    </li>
                    <li>
                      <b className='text-foreground'>Shift Adherence:</b> Students must vacate their desk promptly at the conclusion of
                      their allotted shift to permit cleaning and seat turnover for subsequent shift members.
                    </li>
                  </ul>
                </div>

                <Separator />

                <div className='space-y-3'>
                  <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-primary' />
                    3. Strict Silence & Reading Hall Etiquette
                  </h3>
                  <ul className='list-disc pl-5 space-y-2 text-muted-foreground'>
                    <li>
                      <b className='text-foreground'>Absolute Silence:</b> Strict pin-drop silence must be observed across all study halls at all times.
                    </li>
                    <li>
                      <b className='text-foreground'>Mobile Phones:</b> All phones, smartwatches, and electronic devices must remain on{' '}
                      <b>Silent or Vibration-Off</b> mode. Phone calls must only be attended outside in the reception foyer.
                    </li>
                    <li>
                      <b className='text-foreground'>Audio Lectures:</b> Headphones or earphones must be used at a modest volume ensuring no sound leakage to adjacent desks.
                    </li>
                    <li>
                      <b className='text-foreground'>Food & Beverages:</b> Only closed-cap water bottles are permitted at desks. Meals, snacks, and aromatic food must be consumed exclusively in the dining/cafeteria zone.
                    </li>
                  </ul>
                </div>

                <Separator />

                <div className='space-y-3'>
                  <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-primary' />
                    4. Fee Payments & Strict No-Refund Policy
                  </h3>
                  <div className='p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs sm:text-sm space-y-2'>
                    <p className='font-semibold flex items-center gap-1.5'>
                      <AlertTriangle className='h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400' />
                      Non-Refundable & Non-Transferable Fee Agreement:
                    </p>
                    <p>
                      All membership fees, locker rentals, and admission deposits once paid are <b>STRICTLY NON-REFUNDABLE,
                      NON-TRANSFERABLE, and NON-ADJUSTABLE</b> under any circumstances, including but not limited to early discontinuation,
                      exam completion, relocation, medical leave, or expulsion due to disciplinary breaches.
                    </p>
                  </div>
                  <ul className='list-disc pl-5 space-y-1.5 text-muted-foreground text-xs'>
                    <li>Monthly renewal fees must be cleared on or before the due date.</li>
                    <li>Unpaid balances exceeding 5 calendar days may result in automatic desk forfeiture and release to the waiting list.</li>
                  </ul>
                </div>

                <Separator />

                <div className='space-y-3'>
                  <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-primary' />
                    5. Personal Belongings & Lockers
                  </h3>
                  <p className='text-muted-foreground'>
                    The library provides study facilities, high-speed Wi-Fi, air conditioning, and power backup. However,
                    members are exclusively responsible for their own books, laptops, bags, chargers, and personal valuables.
                    The administration assumes <b>NO responsibility or liability for lost, forgotten, damaged, or stolen articles</b>.
                  </p>
                </div>

                <Separator />

                <div className='space-y-3'>
                  <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-primary' />
                    6. Right of Admission & Termination
                  </h3>
                  <p className='text-muted-foreground'>
                    Library management reserves the absolute right of admission. Any member found engaging in proxy attendance fraud,
                    harassment, damage to library property (desks, ergonomic chairs, electrical fittings), or repeated disturbance
                    will face immediate cancellation of membership without notice or refund.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 2: PRIVACY & GPS LOCATION DATA POLICY */}
          {/* ========================================================================= */}
          <TabsContent value='privacy' className='space-y-6 focus-visible:outline-none'>
            <Card className='border-muted-foreground/20 shadow-sm overflow-hidden'>
              <CardHeader className='bg-muted/30 border-b border-border/50 pb-4'>
                <div className='flex items-center gap-2.5'>
                  <div className='p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'>
                    <Lock className='h-5 w-5' />
                  </div>
                  <div>
                    <CardTitle className='text-xl font-bold'>Privacy Policy & GPS Location Data</CardTitle>
                    <CardDescription className='text-xs'>
                      Full transparency regarding the personal data we collect, how GPS geofencing operates, and student data protection.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='p-6 sm:p-8 space-y-6 text-sm text-foreground/90 leading-relaxed'>
                <div className='space-y-3'>
                  <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-emerald-600' />
                    1. Information We Collect
                  </h3>
                  <p>
                    When you register at Vertical Classes Library or use our DeskFlow platform, we collect the following personal information:
                  </p>
                  <ul className='list-disc pl-5 space-y-1.5 text-muted-foreground'>
                    <li><b className='text-foreground'>Identity Information:</b> Full Name, Student Photo ID, and Target Competitive Exam.</li>
                    <li><b className='text-foreground'>Contact Numbers:</b> Student Mobile Phone Number and Guardian / Parent Emergency Phone Number.</li>
                    <li><b className='text-foreground'>Residential Address:</b> City/Locality provided during admission registration.</li>
                    <li><b className='text-foreground'>Financial Records:</b> Payment mode, transaction receipts, amounts paid, and pending balance.</li>
                    <li><b className='text-foreground'>Attendance & Timestamp Records:</b> Entrance Check-In times, Exit Check-Out times, and session durations.</li>
                  </ul>
                </div>

                <Separator />

                {/* GPS GEOFENCING HIGHLIGHT BOX */}
                <div className='rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-3'>
                  <div className='flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold'>
                    <MapPin className='h-5 w-5 text-emerald-600 dark:text-emerald-400' />
                    2. Mandatory Geofenced GPS Location Policy (75m Perimeter)
                  </div>
                  <p className='text-xs sm:text-sm text-muted-foreground leading-relaxed'>
                    To eliminate proxy attendance, verify genuine student presence, and ensure transparent records for parents,
                    our attendance system enforces a <b>strict 75-meter GPS geofence</b> centered on our library premises
                    (Coordinates: <code>33.617014, 74.924696</code>).
                  </p>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs'>
                    <div className='p-3 rounded-lg bg-background/80 border space-y-1'>
                      <span className='font-semibold text-foreground block'>🎯 Point-in-Time Verification</span>
                      <span className='text-muted-foreground'>
                        GPS coordinates are collected <b>ONLY at the exact moment</b> you initiate Check-In or Check-Out via the Web Portal.
                      </span>
                    </div>
                    <div className='p-3 rounded-lg bg-background/80 border space-y-1'>
                      <span className='font-semibold text-foreground block'>🛡 NO Background Tracking</span>
                      <span className='text-muted-foreground'>
                        We do <b>NOT</b> track or monitor your continuous location in the background. Once your attendance request is validated, location polling ceases.
                      </span>
                    </div>
                  </div>
                </div>

                <div className='space-y-3'>
                  <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-emerald-600' />
                    3. Handling of Remote Attendance Attempts
                  </h3>
                  <p className='text-muted-foreground'>
                    If a student attempts to mark attendance when located further than 75 meters from the library (e.g. from home,
                    cafes, or transit):
                  </p>
                  <ul className='list-disc pl-5 space-y-1.5 text-muted-foreground'>
                    <li>The check-in/out request is automatically denied by the security engine.</li>
                    <li>The attempted timestamp, distance in meters, and GPS coordinates are recorded for audit purposes.</li>
                    <li>An automated alert is dispatched to library administration indicating that the student is <b>outside library premises</b>.</li>
                  </ul>
                </div>

                <Separator />

                <div className='space-y-3'>
                  <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-emerald-600' />
                    4. Guardian & Emergency Contact Communications
                  </h3>
                  <p className='text-muted-foreground'>
                    Parent and emergency contact numbers are registered for safety, emergency coordination, and administrative alerts.
                    By submitting parent contact details during registration, the student and parent explicitly authorize the library to:
                  </p>
                  <ul className='list-disc pl-5 space-y-1 text-muted-foreground'>
                    <li>Send fee transaction receipts and due payment reminders via Email, WhatsApp, or SMS.</li>
                    <li>Contact parents immediately in case of medical emergencies, unexpected library closures, or disciplinary issues.</li>
                    <li>Alert parents if the student triggers unauthorized remote check-in alerts while absent from the study hall.</li>
                  </ul>
                </div>

                <Separator />

                <div className='space-y-3'>
                  <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-emerald-600' />
                    5. Data Security & Zero-Sale Commitment
                  </h3>
                  <p className='text-muted-foreground'>
                    All personal records, attendance logs, and uploaded identity documents are stored in secure, encrypted cloud
                    databases (Supabase) with restricted role-based access. <b>We never sell, rent, or trade student personal data
                    to commercial advertisers, coaching institutes, or third-party marketers</b>.
                  </p>
                </div>

                <Separator />

                {/* STATUTORY COMPLIANCE: INDIAN DPDP ACT 2023 & IT ACT 2000 */}
                <div className='rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-4'>
                  <div className='flex items-center justify-between flex-wrap gap-2'>
                    <div className='flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-base'>
                      <Scale className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                      6. Statutory Compliance: Digital Personal Data Protection Act, 2023 & IT Act, 2000
                    </div>
                    <Badge variant='outline' className='bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px]'>
                      🇮🇳 Republic of India
                    </Badge>
                  </div>
                  <p className='text-xs sm:text-sm text-muted-foreground leading-relaxed'>
                    This Privacy Policy is framed in strict compliance with the <b>Digital Personal Data Protection Act, 2023 (DPDP Act, Act No. 22 of 2023)</b>,
                    the <b>Information Technology Act, 2000 (IT Act, 2000)</b>, and the <b>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 (SPDI Rules)</b>.
                  </p>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-3 text-xs'>
                    <div className='p-3.5 rounded-lg bg-background/90 border space-y-1.5'>
                      <span className='font-semibold text-foreground block flex items-center gap-1.5'>
                        🏛 <b>Legal Classifications (Sec. 2(i) & 2(j))</b>
                      </span>
                      <p className='text-muted-foreground leading-relaxed'>
                        <b>Vertical Classes Study Lounge & Library (DeskFlow)</b> serves as the <b>Data Fiduciary</b>. The applicant, enrolled student, and/or parent/lawful guardian acts as the <b>Data Principal</b> under Indian law.
                      </p>
                    </div>

                    <div className='p-3.5 rounded-lg bg-background/90 border space-y-1.5'>
                      <span className='font-semibold text-foreground block flex items-center gap-1.5'>
                        📜 <b>Lawful Consent Architecture (Sec. 6)</b>
                      </span>
                      <p className='text-muted-foreground leading-relaxed'>
                        All personal identification info, phone numbers, and point-in-time GPS check-in/out records are processed on the basis of <b>free, specific, informed, unconditional, and unambiguous consent</b> with prior itemized notice.
                      </p>
                    </div>

                    <div className='p-3.5 rounded-lg bg-background/90 border space-y-1.5'>
                      <span className='font-semibold text-foreground block flex items-center gap-1.5'>
                        👨‍👩‍👦 <b>Parental Consent for Minors (Sec. 9)</b>
                      </span>
                      <p className='text-muted-foreground leading-relaxed'>
                        For students under 18 years of age, <b>verifiable consent of parent/lawful guardian</b> is registered via the mandatory emergency contact number. We do not engage in behavioral tracking or profiling harmful to minors.
                      </p>
                    </div>

                    <div className='p-3.5 rounded-lg bg-background/90 border space-y-1.5'>
                      <span className='font-semibold text-foreground block flex items-center gap-1.5'>
                        🛡 <b>Reasonable Security (Sec. 8(5) & Sec. 43A)</b>
                      </span>
                      <p className='text-muted-foreground leading-relaxed'>
                        Mandated under Section 8(5) of DPDP Act 2023 and Section 43A of IT Act 2000, we deploy end-to-end encrypted databases, SSL/TLS transport security, and role-based administrative authentication to prevent unauthorized disclosure.
                      </p>
                    </div>
                  </div>

                  {/* DATA PRINCIPAL RIGHTS */}
                  <div className='pt-2 space-y-2'>
                    <h4 className='text-xs font-semibold text-foreground flex items-center gap-1.5'>
                      <CheckCircle2 className='h-3.5 w-3.5 text-blue-500' />
                      Your Statutory Rights as a Data Principal (Sections 11, 12, 13 of DPDP Act 2023):
                    </h4>
                    <ul className='list-disc pl-5 space-y-1.5 text-xs text-muted-foreground'>
                      <li>
                        <b>Right to Access Information (Sec. 11):</b> You have the right to obtain a summary of your personal data processed by the library and review your attendance/fee history.
                      </li>
                      <li>
                        <b>Right to Correction & Erasure (Sec. 12):</b> You may request rectification of inaccurate contact numbers or erasure of personal information once your membership concludes and legal accounts are settled.
                      </li>
                      <li>
                        <b>Right of Grievance Redressal (Sec. 13):</b> You have a statutory right of readily available grievance redressal with our designated Data Protection & Grievance Officer.
                      </li>
                      <li>
                        <b>Right to Nominate (Sec. 14):</b> You retain the legal right to nominate any individual to exercise your data principal rights in the event of incapacity.
                      </li>
                    </ul>
                  </div>

                  {/* STATUTORY GRIEVANCE REDRESSAL OFFICER */}
                  <div className='p-4 rounded-lg bg-card border border-blue-500/20 text-xs space-y-2.5'>
                    <div className='font-semibold text-foreground flex items-center gap-1.5'>
                      <Building2 className='h-4 w-4 text-blue-600' />
                      Statutory Grievance Redressal Officer (Under DPDP Act 2023 & IT SPDI Rules 2011):
                    </div>
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground'>
                      <div><b>Officer Name:</b> Sarwar Altaf Dar</div>
                      <div><b>Designation:</b> Chief Administrator & Data Grievance Officer</div>
                      <div><b>Physical Address:</b> Vertical Classes Library, Anantnag, Jammu & Kashmir - 192101</div>
                      <div><b>Direct Helpline:</b> +91 9149847965</div>
                      <div className='col-span-1 sm:col-span-2'>
                        <b>Official Compliance Email:</b>{' '}
                        <a href='mailto:receipts@globalpulse24.in' className='text-primary underline font-medium'>
                          receipts@globalpulse24.in
                        </a>{' '}
                        / <a href='mailto:admin@verticalclasseslibrary.com' className='text-primary underline font-medium'>admin@verticalclasseslibrary.com</a>
                      </div>
                    </div>
                    <p className='text-[11px] text-muted-foreground italic pt-1 border-t'>
                      In accordance with Rule 5(9) of the IT SPDI Rules, 2011 and Section 13(2) of the DPDP Act, 2023, all data privacy queries and grievances will be acknowledged within 48 hours and resolved within the statutory period of 30 days.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================================= */}
          {/* TAB 3: STUDENT SAFETY & NON-LIABILITY AGREEMENT */}
          {/* ========================================================================= */}
          <TabsContent value='liability' className='space-y-6 focus-visible:outline-none'>
            <Card className='border-amber-500/30 shadow-sm overflow-hidden'>
              <CardHeader className='bg-amber-500/10 border-b border-amber-500/20 pb-4'>
                <div className='flex items-center gap-2.5'>
                  <div className='p-2 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400'>
                    <AlertTriangle className='h-5 w-5' />
                  </div>
                  <div>
                    <CardTitle className='text-xl font-bold text-amber-900 dark:text-amber-100'>
                      Student Safety & Off-Premises Non-Liability Disclaimer
                    </CardTitle>
                    <CardDescription className='text-xs text-amber-800/80 dark:text-amber-200/80'>
                      Important legal disclosure concerning institutional jurisdiction, transit, and parental responsibility.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='p-6 sm:p-8 space-y-6 text-sm text-foreground/90 leading-relaxed'>
                {/* PRIMARY HIGHLIGHT NOTICE */}
                <div className='p-4 sm:p-5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive-foreground space-y-2.5'>
                  <div className='flex items-center gap-2 text-destructive font-bold text-base'>
                    <ShieldCheck className='h-5 w-5 shrink-0' />
                    EXPRESS NOTICE OF JURISDICTION & NON-LIABILITY
                  </div>
                  <p className='text-xs sm:text-sm text-foreground/90 leading-relaxed font-medium'>
                    Vertical Classes Study Lounge & Library is strictly a self-study workspace provider. The institution is
                    <b> NOT A RESIDENTIAL HOSTEL, BOARDING FACILITY, OR CUSTODIAL CARE PROVIDER</b>. The library, its owners,
                    administration, and staff bear <b>ABSOLUTELY ZERO CUSTODIAL, SUPERVISORY, OR LEGAL LIABILITY</b> for any student
                    when they are outside the physical boundaries of our designated reading rooms.
                  </p>
                </div>

                <div className='space-y-3'>
                  <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-amber-600' />
                    1. Transit & Commute to the Library
                  </h3>
                  <p className='text-muted-foreground'>
                    Students travel to and from the library independently or under the supervision of their parents/guardians.
                    The library does not provide transportation services. The institution assumes <b>NO liability or responsibility</b>{' '}
                    for any delays, road accidents, personal injuries, transit incidents, or interactions occurring before arrival at
                    or following departure from the study hall.
                  </p>
                </div>

                <Separator />

                <div className='space-y-3'>
                  <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-amber-600' />
                    2. Responsibility During Remote or Blocked Attendance Attempts
                  </h3>
                  <p className='text-muted-foreground'>
                    If a student attempts to check in while located at home, in the market, or anywhere outside the library geofence
                    (distance &gt; 75 meters), our automated system dispatches an alert stating:
                  </p>
                  <blockquote className='border-l-4 border-amber-500 pl-4 py-2 italic text-xs sm:text-sm text-foreground bg-muted/30 rounded-r-md'>
                    “⚠️ <b>LIABILITY NOTICE:</b> We are NOT responsible for him/her right now as they are outside library premises!”
                  </blockquote>
                  <p className='text-muted-foreground text-xs'>
                    This disclaimer confirms that the student is NOT under the roof or supervision of the facility. Parents and guardians
                    remain solely responsible for verifying their child’s physical location when attendance is flagged as remote.
                  </p>
                </div>

                <Separator />

                <div className='space-y-3'>
                  <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-amber-600' />
                    3. Voluntary In-and-Out Movement
                  </h3>
                  <p className='text-muted-foreground'>
                    As an adult study lounge, students are free to take tea/lunch breaks, step out for fresh air, or conclude their study
                    sessions at their own discretion. While our digital turnstiles and attendance logs track presence, the
                    facility does not operate as an enclosed prison or custodial lockup. Parents seeking strict exit supervision must
                    monitor their student’s attendance logs in coordination with their registered shifts.
                  </p>
                </div>

                <Separator />

                <div className='space-y-3'>
                  <h3 className='text-base font-semibold text-foreground flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 text-amber-600' />
                    4. Medical Emergencies & Unforeseen Events
                  </h3>
                  <p className='text-muted-foreground'>
                    In the event of a sudden medical emergency inside the study lounge, staff will render basic first-aid assistance and
                    promptly dial the student’s emergency parent contact and local emergency medical services. However, the library is not
                    a healthcare facility and cannot be held liable for preexisting health complications, allergic reactions, or natural calamities.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Quick Links & Contact */}
        <div className='rounded-2xl bg-card border border-muted-foreground/20 p-6 sm:p-8 space-y-4 shadow-sm'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
            <div className='space-y-1'>
              <h4 className='font-semibold text-foreground'>Have questions regarding our legal terms or data security?</h4>
              <p className='text-xs text-muted-foreground'>
                Our compliance and administrative team is available to assist students and parents.
              </p>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <a
                href='tel:+919149847965'
                className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium bg-background hover:bg-muted transition-colors'
              >
                <PhoneCall className='h-3.5 w-3.5 text-primary' />
                Helpdesk: +91 9149847965
              </a>
              <a
                href='mailto:receipts@globalpulse24.in'
                className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium bg-background hover:bg-muted transition-colors'
              >
                Email Support
              </a>
            </div>
          </div>
          <Separator />
          <div className='flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground gap-2'>
            <span>© {new Date().getFullYear()} Vertical Classes Study Lounge & Library (DeskFlow OS). All rights reserved.</span>
            <div className='flex items-center gap-3'>
              <button
                type='button'
                onClick={() => setActiveTab('terms')}
                className='hover:underline hover:text-foreground'
              >
                Terms of Service
              </button>
              <span>•</span>
              <button
                type='button'
                onClick={() => setActiveTab('privacy')}
                className='hover:underline hover:text-foreground'
              >
                Privacy & GPS Policy
              </button>
              <span>•</span>
              <button
                type='button'
                onClick={() => setActiveTab('liability')}
                className='hover:underline hover:text-foreground'
              >
                Safety & Non-Liability
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
