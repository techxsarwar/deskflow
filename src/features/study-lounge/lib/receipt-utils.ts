import { FeeTransaction, Student, LoungeSeat } from '../types'
import { SHIFT_DETAILS } from '../data/mock-data'
import { getDeskLabel } from './seat-utils'

/**
 * Normalizes an Indian or international phone number for WhatsApp URLs.
 * If 10 digits (standard Indian mobile), automatically prepends '91'.
 */
export function cleanWhatsAppPhone(rawPhone?: string): string {
  if (!rawPhone) return ''
  let digits = rawPhone.replace(/\D/g, '')
  // If starts with 0 (e.g. STD code or prefix), remove it
  digits = digits.replace(/^0+/, '')
  // If 10 digits, assume standard Indian mobile number
  if (digits.length === 10) {
    digits = `91${digits}`
  }
  return digits
}

/**
 * Formats an exact timestamp with Date, Day, Time (seconds + AM/PM) and Timezone.
 * Example: "Wednesday, 30 Sep 2026 • 11:35:14 PM IST"
 */
export function formatReceiptTimestamp(
  paymentDate: string,
  paymentTime?: string,
  createdAt?: string
): {
  fullDateTime: string
  formattedDate: string
  formattedTime: string
  isoString: string
} {
  let dateObj: Date

  if (createdAt) {
    dateObj = new Date(createdAt)
  } else if (paymentDate) {
    if (paymentTime) {
      // Try parsing date + time
      dateObj = new Date(`${paymentDate} ${paymentTime}`)
      if (isNaN(dateObj.getTime())) {
        dateObj = new Date(paymentDate)
      }
    } else {
      dateObj = new Date(paymentDate)
    }
  } else {
    dateObj = new Date()
  }

  // Ensure valid date
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date()
  }

  const formattedDate = dateObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const formattedTime = paymentTime || dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  return {
    fullDateTime: `${formattedDate} at ${formattedTime}`,
    formattedDate,
    formattedTime,
    isoString: dateObj.toISOString(),
  }
}

/**
 * Constructs an ultra-detailed official receipt message string formatted for WhatsApp.
 */
export function buildWhatsAppReceiptMessage({
  transaction,
  student,
}: {
  transaction: FeeTransaction
  student?: Student | null
}): string {
  const ts = formatReceiptTimestamp(
    transaction.paymentDate,
    transaction.paymentTime,
    transaction.createdAt
  )

  const studentName = transaction.studentName || student?.fullName || 'Student'
  const regNo = transaction.regNo || student?.regNo || 'N/A'
  const phone = student?.phone || transaction.phone || ''
  const seatNumber = transaction.seatNumber || student?.seatNumber || 'Unassigned'
  const shift = transaction.shift || student?.shift || 'fullday'
  const shiftInfo = SHIFT_DETAILS[shift] || { label: 'General Slot', timing: 'Flexible' }
  const plan = (transaction.membershipPlan || student?.membershipPlan || 'monthly').replace('_', ' ')

  const planAmount = transaction.planAmount ?? student?.planAmount ?? transaction.amount
  const amountPaidThisTxn = transaction.amount
  const totalPaid = student?.amountPaid ?? transaction.amount
  const balanceDue = transaction.balanceAfterPayment ?? student?.amountDue ?? 0

  const validityRange =
    student?.startDate && student?.endDate
      ? `${student.startDate} to ${student.endDate}`
      : 'Active Membership Period'

  const statusEmoji = balanceDue <= 0 ? '✅ FULLY PAID' : '⏳ PARTIAL PAYMENT'

  const lines = [
    `🏛️ *VERTICAL CLASSES LIBRARY & STUDY LOUNGE*`,
    `📍 _Branch: City Center Campus • Academic Wing_`,
    `📞 *Helpdesk:* +91 99000 12345 | desk@verticalclasseslibrary.com`,
    `────────────────────────`,
    `🧾 *OFFICIAL FEE RECEIPT*`,
    `────────────────────────`,
    `*Receipt No:* \`${transaction.receiptNumber}\``,
    `*Transaction ID:* \`${transaction.id}\``,
    `*Date & Exact Time:* ${ts.fullDateTime}`,
    ``,
    `👤 *STUDENT PROFILE*`,
    `• *Student Name:* ${studentName}`,
    `• *Roll / Reg No:* ${regNo}`,
    phone ? `• *Registered Mobile:* ${phone}` : null,
    `• *Desk / Seat No:* ${seatNumber}`,
    `• *Shift / Slot:* ${shiftInfo.label} (${shiftInfo.timing})`,
    `• *Membership Plan:* ${plan.toUpperCase()}`,
    `• *Validity Window:* ${validityRange}`,
    ``,
    `💰 *FEE & PAYMENT BREAKDOWN*`,
    `• *Total Membership Fee:* ₹${planAmount.toLocaleString('en-IN')}`,
    `• *AMOUNT RECEIVED NOW:* ₹${amountPaidThisTxn.toLocaleString('en-IN')} 💵`,
    `• Total Amount Paid To Date: ₹${totalPaid.toLocaleString('en-IN')}`,
    `• *Remaining Balance Due:* ₹${balanceDue.toLocaleString('en-IN')}`,
    `• *Payment Mode:* ${transaction.paymentMode.toUpperCase()}`,
    `• *Payment Status:* ${statusEmoji}`,
    transaction.remarks ? `• *Reference / Notes:* ${transaction.remarks}` : null,
    ``,
    `────────────────────────`,
    `📌 *IMPORTANT LOUNGE RULES:*`,
    `1. Please keep this digital receipt for desk allocation & library entry.`,
    `2. Strict silence must be maintained at all times in the reading hall.`,
    `3. High-speed Wi-Fi & power backup are included with your membership.`,
    `4. Fees paid are non-transferable & non-refundable.`,
    ``,
    `✨ _Thank you for studying at Vertical Classes Library! We wish you success in your preparation._ 📚🎯`,
  ]

  return lines.filter((l) => l !== null).join('\n')
}

/**
 * Returns a direct WhatsApp URL to open chat with the recipient and prefilled text.
 */
export function getWhatsAppShareUrl(phone: string, text: string): string {
  const cleanPhone = cleanWhatsAppPhone(phone)
  const encodedText = encodeURIComponent(text)
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`
}

/**
 * Builds a professional WhatsApp Community / Group broadcast message
 * listing all students with pending dues.
 */
export function buildCommunityDueBroadcastMessage({
  students,
  deadlineDate,
  upiId = 'verticalclasses@upi',
}: {
  students: Student[]
  deadlineDate?: string
  upiId?: string
}): string {
  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const totalDueSum = students.reduce((acc, s) => acc + s.amountDue, 0)

  const studentEntries = students.map((s, idx) => {
    const shiftLabel = SHIFT_DETAILS[s.shift]?.label || s.shift
    return [
      `*${idx + 1}. ${s.fullName}* (Reg: \`${s.regNo}\`)`,
      `   • Desk: *${s.seatNumber || 'Unassigned'}* | Slot: ${shiftLabel}`,
      `   • Total Fee: ₹${s.planAmount.toLocaleString('en-IN')} | *Pending Due: ₹${s.amountDue.toLocaleString('en-IN')}*`,
    ].join('\n')
  })

  const lines = [
    `📢 *VERTICAL CLASSES LIBRARY - OFFICIAL NOTICE*`,
    `📌 *STUDY LOUNGE MEMBERSHIP FEE DUES LIST*`,
    `🗓️ *Notice Date:* ${today} | 🏛️ *Academic Wing*`,
    `─────────────────────────`,
    `Dear Students & Respected Members,`,
    ``,
    `This is an important reminder regarding pending monthly membership fees. Kindly clear your dues promptly to ensure uninterrupted silent reading access and continuous desk reservation.`,
    ``,
    `📋 *MEMBERS WITH PENDING DUES (${students.length} STUDENTS):*`,
    ``,
    studentEntries.join('\n\n'),
    ``,
    `─────────────────────────`,
    `💰 *Total Outstanding Balance:* ₹${totalDueSum.toLocaleString('en-IN')}`,
    deadlineDate ? `⏳ *Strict Clearance Deadline:* *${deadlineDate}*` : null,
    ``,
    `💳 *PAYMENT OPTIONS:*`,
    `• *UPI / QR / GPay / PhonePe:* \`${upiId}\``,
    `• *Front Desk:* Pay via Cash or POS Card Counter #1`,
    `• After paying, please share your UTR / transaction screenshot with Admin to receive your official stamp receipt.`,
    ``,
    `⚠️ *Important Note:* If you have already cleared your payment today, please ignore this notice and notify the library desk.`,
    ``,
    `Thank you for your cooperation! 📚✨`,
    `*Vertical Classes Library Administration*`,
  ]

  return lines.filter((l) => l !== null).join('\n')
}

/**
 * Builds a personalized 1-on-1 WhatsApp due reminder message for a single student.
 */
export function buildIndividualDueReminderMessage({
  student,
  deadlineDate,
  upiId = 'verticalclasses@upi',
}: {
  student: Student
  deadlineDate?: string
  upiId?: string
}): string {
  const shiftInfo = SHIFT_DETAILS[student.shift] || { label: student.shift, timing: '' }

  const lines = [
    `🏛️ *VERTICAL CLASSES LIBRARY & STUDY LOUNGE*`,
    `📍 _City Center Campus • Helpdesk: +91 99000 12345_`,
    `─────────────────────────`,
    `👋 *Dear ${student.fullName},*`,
    ``,
    `Hope your study sessions are going smoothly! This is a gentle reminder regarding your pending library membership fee.`,
    ``,
    `📋 *YOUR MEMBERSHIP SUMMARY:*`,
    `• *Reg No:* \`${student.regNo}\``,
    `• *Allotted Desk:* ${student.seatNumber || 'Unassigned'}`,
    `• *Shift / Slot:* ${shiftInfo.label} (${shiftInfo.timing})`,
    `• *Plan:* ${student.membershipPlan.replace('_', ' ').toUpperCase()}`,
    `• *Total Plan Fee:* ₹${student.planAmount.toLocaleString('en-IN')}`,
    `• *Amount Already Paid:* ₹${student.amountPaid.toLocaleString('en-IN')}`,
    `• *PENDING BALANCE DUE: ₹${student.amountDue.toLocaleString('en-IN')}* ⚠️`,
    deadlineDate ? `• *Due Clearance Deadline:* ${deadlineDate}` : null,
    ``,
    `💳 *HOW TO PAY:*`,
    `• *UPI:* Pay to \`${upiId}\` (Google Pay / PhonePe / Paytm)`,
    `• *Front Desk:* Cash / Card at reception`,
    `• An instant computer-generated official receipt will be issued upon payment.`,
    ``,
    `Please reach out if you have any questions. Best wishes for your exam preparation! 🎯📚`,
  ]

  return lines.filter((l) => l !== null).join('\n')
}

/**
 * Builds an official, beautifully structured seating allotment roster for WhatsApp community groups.
 */
export function buildSeatingArrangementBroadcastMessage({
  seats,
  students,
  filterType = 'all',
  includeGuidelines = true,
  contactPhone = '+91 98765 43210',
  admissionUrl,
}: {
  seats: LoungeSeat[]
  students: Student[]
  filterType?: 'all' | 'occupied' | 'vacant'
  includeGuidelines?: boolean
  contactPhone?: string
  admissionUrl?: string
}): string {
  const now = new Date()
  const formattedDate = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const formattedTime = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  const effectiveAdmissionUrl =
    admissionUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/join`
      : 'https://studylounge.app/join')

  const totalDesks = seats.length
  const occupiedDesks = seats.filter((s) => s.status === 'occupied').length
  const vacantDesks = totalDesks - occupiedDesks
  const occupancyPct =
    totalDesks > 0 ? Math.round((occupiedDesks / totalDesks) * 100) : 0

  // Filter seats based on filterType
  const filteredSeats = seats.filter((seat) => {
    if (filterType === 'occupied') return seat.status === 'occupied'
    if (filterType === 'vacant') return seat.status === 'available'
    return true
  })

  // Group by Hall Names
  const sectionsMap = new Map<string, LoungeSeat[]>()
  filteredSeats.forEach((seat) => {
    const sec = seat.section?.trim() || 'Main Hall'
    if (!sectionsMap.has(sec)) {
      sectionsMap.set(sec, [])
    }
    sectionsMap.get(sec)!.push(seat)
  })

  // Map students by seatNumber for quick lookup
  const studentBySeatNumber = new Map<string, Student>()
  students.forEach((s) => {
    if (s.seatNumber && s.seatNumber !== 'Unassigned') {
      studentBySeatNumber.set(s.seatNumber, s)
    }
  })

  const sectionsContent: string[] = []

  sectionsMap.forEach((seatsList, sectionName) => {
    const sectionOccupied = seatsList.filter((s) => s.status === 'occupied').length
    const sectionTotal = seatsList.length

    const seatLines = seatsList.map((seat) => {
      const student =
        studentBySeatNumber.get(seat.seatNumber) ||
        (seat.currentStudentId
          ? students.find((s) => s.id === seat.currentStudentId)
          : null)

      if (seat.status === 'occupied') {
        const studentName = student?.fullName || seat.currentStudentName || 'Occupied'
        const regNo = student?.regNo ? ` (${student.regNo})` : ''
        const shiftKey = student?.shift || seat.shift
        const shiftLabel = shiftKey
          ? ` [${SHIFT_DETAILS[shiftKey]?.label || shiftKey}]`
          : ''
        return `• 🪑 *${getDeskLabel(seat.seatNumber, sectionName)}:* ${studentName}${regNo}${shiftLabel}`
      } else {
        return `• 🟢 *${getDeskLabel(seat.seatNumber, sectionName)}:* _AVAILABLE VACANT_`
      }
    })

    sectionsContent.push(
      `🏛️ *${sectionName.toUpperCase()}* (${sectionOccupied}/${sectionTotal} Private Desks Occupied)\n` +
        seatLines.join('\n')
    )
  })

  const filterHeading =
    filterType === 'occupied'
      ? '📋 *STUDENT ALLOTMENT ROSTER (OCCUPIED DESKS ONLY)*'
      : filterType === 'vacant'
        ? '🟢 *AVAILABLE VACANT DESKS LIST (READY TO BOOK)*'
        : '🪑 *OFFICIAL PRIVATE DESKS ALLOTMENT LIST*'

  const lines = [
    `📢 *VERTICAL CLASSES LIBRARY & STUDY LOUNGE*`,
    filterHeading,
    `🗓️ *Date:* ${formattedDate} • ⏰ *Updated:* ${formattedTime} IST`,
    `─────────────────────────`,
    `📊 *FLOOR OVERVIEW:*`,
    `• *Total Desks:* ${totalDesks} Private Desks`,
    `• *Occupied / Allotted:* ${occupiedDesks} Students (${occupancyPct}% full)`,
    `• *Available Vacant:* ${vacantDesks} Private Desks Available`,
    `─────────────────────────`,
    ``,
    sectionsContent.length > 0
      ? sectionsContent.join('\n\n')
      : '_No desks matching this category._',
    ``,
    `─────────────────────────`,
    includeGuidelines
      ? [
          `📌 *LIBRARY RULES & SEATING DISCIPLINE:*`,
          `1. Please occupy ONLY your allotted desk. Swapping desks without front-desk permission is strictly prohibited.`,
          `2. Maintain complete silence in all study halls. Use headphones for video lectures.`,
          `3. Mobile phones must be kept on Silent/Vibration-off mode.`,
          `4. Keep your desk tidy. Dedicated lockers must be locked before departure.`,
          `5. For seat renewals or shift change requests, contact the desk supervisor.`,
          ``,
        ].join('\n')
      : null,
    contactPhone ? `📞 *Library Helpdesk / Supervisor:* ${contactPhone}` : null,
    effectiveAdmissionUrl
      ? `🌐 *Book or Reserve Desk Online:* ${effectiveAdmissionUrl}`
      : null,
    `─────────────────────────`,
    `*Vertical Classes Library Administration*`,
  ]

  return lines.filter((l) => l !== null).join('\n')
}

