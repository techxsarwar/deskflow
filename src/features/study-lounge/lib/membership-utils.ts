import { Student, FeeTransaction } from '../types'
import { SHIFT_DETAILS } from '../data/mock-data'

export type MembershipLifecycleState =
  | 'pending'
  | 'active'
  | 'expiring_soon'
  | 'expiring_today'
  | 'grace_period'
  | 'expired'
  | 'inactive'

export interface MembershipLifecycleInfo {
  state: MembershipLifecycleState
  label: string
  subText: string
  daysDiff: number
  badgeColor: string
  isEligibleForRelease: boolean
  isExpiringSoon: boolean
}

/**
 * Evaluates the real-time membership lifecycle and expiry status of a student.
 */
export function getMembershipLifecycle(
  student: Student,
  refDate = new Date()
): MembershipLifecycleInfo {
  if (student.status === 'pending') {
    return {
      state: 'pending',
      label: 'Pending Admission',
      subText: 'Awaiting desk verification & fee',
      daysDiff: 0,
      badgeColor: 'border-amber-500/40 text-amber-600 bg-amber-500/10 dark:text-amber-400',
      isEligibleForRelease: false,
      isExpiringSoon: false,
    }
  }

  if (student.status === 'inactive') {
    return {
      state: 'inactive',
      label: 'Inactive Member',
      subText: 'Membership closed',
      daysDiff: 0,
      badgeColor: 'border-muted text-muted-foreground bg-muted/40',
      isEligibleForRelease: false,
      isExpiringSoon: false,
    }
  }

  // Parse today and end date normalized to midnight
  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate())
  const [ey, em, ed] = student.endDate.split('-').map(Number)
  const endDate = new Date(ey, em - 1, ed)

  const diffTime = endDate.getTime() - today.getTime()
  const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  // Past grace period (> 2 days past expiry)
  if (daysDiff < -2) {
    const daysOverdue = Math.abs(daysDiff)
    return {
      state: 'expired',
      label: `Expired (${daysOverdue}d ago)`,
      subText: `Tenure ended on ${student.endDate}`,
      daysDiff,
      badgeColor: 'border-red-500/40 text-red-600 bg-red-500/10 dark:text-red-400',
      isEligibleForRelease: !!student.seatNumber && student.seatNumber !== 'Unassigned',
      isExpiringSoon: false,
    }
  }

  // Grace period (0 to 2 days overdue)
  if (daysDiff < 0) {
    const daysOverdue = Math.abs(daysDiff)
    return {
      state: 'grace_period',
      label: `Grace Period (${daysOverdue}d overdue)`,
      subText: 'Seat held during grace window',
      daysDiff,
      badgeColor: 'border-amber-500/40 text-amber-600 bg-amber-500/10 dark:text-amber-400',
      isEligibleForRelease: false,
      isExpiringSoon: true,
    }
  }

  // Expires today
  if (daysDiff === 0) {
    return {
      state: 'expiring_today',
      label: 'Expires Today',
      subText: 'Renewal due by midnight',
      daysDiff: 0,
      badgeColor: 'border-amber-500/40 text-amber-600 bg-amber-500/10 font-bold dark:text-amber-400',
      isEligibleForRelease: false,
      isExpiringSoon: true,
    }
  }

  // Expiring within 3 days
  if (daysDiff <= 3) {
    return {
      state: 'expiring_soon',
      label: `Expires in ${daysDiff} day${daysDiff > 1 ? 's' : ''}`,
      subText: `Renewal due on ${student.endDate}`,
      daysDiff,
      badgeColor: 'border-amber-500/40 text-amber-600 bg-amber-500/10 dark:text-amber-400',
      isEligibleForRelease: false,
      isExpiringSoon: true,
    }
  }

  // Active
  return {
    state: 'active',
    label: `Active (${daysDiff}d left)`,
    subText: `Valid till ${student.endDate}`,
    daysDiff,
    badgeColor: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10 dark:text-emerald-400',
    isEligibleForRelease: false,
    isExpiringSoon: false,
  }
}

/**
 * Calculates new expiry date for monthly rolling cycle renewals.
 * If currently active: adds to existing endDate.
 * If already expired: adds from today.
 */
export function calculateNextRenewalDate(currentEndDate: string, monthsToAdd = 1): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [ey, em, ed] = currentEndDate.split('-').map(Number)
  const existingEnd = new Date(ey, em - 1, ed)

  // Start from the later of existingEnd or today
  const baseDate = existingEnd > today ? new Date(existingEnd) : new Date(today)
  baseDate.setMonth(baseDate.getMonth() + monthsToAdd)

  return baseDate.toISOString().split('T')[0]
}

/**
 * Generates an official WhatsApp Renewal Confirmation message.
 */
export function buildRenewalWhatsAppMessage({
  student,
  transaction,
  newEndDate,
  amountPaid,
}: {
  student: Student
  transaction?: FeeTransaction
  newEndDate: string
  amountPaid: number
}): string {
  const shiftInfo = SHIFT_DETAILS[student.shift] || { label: '24/7 Full Access' }
  const now = new Date()
  const todayFormatted = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const timeFormatted = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  const lines = [
    `🎉 *VERTICAL CLASSES LIBRARY - MEMBERSHIP RENEWED!*`,
    `📍 _City Center Campus • Dedicated 24/7 Study Space_`,
    `─────────────────────────`,
    `Dear *${student.fullName}*,`,
    `Your library membership and dedicated desk have been successfully renewed! Thank you for your continued dedication to your studies. 📚✨`,
    ``,
    `📋 *RENEWAL DOSSIER:*`,
    `• *Student Reg No:* \`${student.regNo}\``,
    `• *Allotted Desk:* *${student.seatNumber || 'Dedicated Desk'}* (24/7 Access)`,
    `• *Shift / Access:* ${shiftInfo.label}`,
    `• *New Membership Validity:* *Until ${newEndDate}* 🗓️`,
    `• *Amount Paid This Cycle:* ₹${amountPaid.toLocaleString('en-IN')}`,
    transaction?.receiptNumber
      ? `• *Official Receipt No:* \`${transaction.receiptNumber}\``
      : null,
    `• *Payment Mode:* ${transaction?.paymentMode?.toUpperCase() || 'CASH / COUNTER'}`,
    `• *Timestamp:* ${todayFormatted} • ${timeFormatted} IST`,
    ``,
    `🎒 *YOUR AMENITIES INCLUDED:*`,
    `✓ Dedicated personal ergonomic cubicle 24/7`,
    `✓ High-speed optical Wi-Fi & power socket`,
    `✓ Clean drinking water, AC & silent study halls`,
    student.lockerNumber ? `✓ Private storage locker (${student.lockerNumber})` : null,
    ``,
    `Best wishes for your preparation and exams! 🎯🚀`,
    `*Vertical Classes Library Administration*`,
  ]

  return lines.filter((l) => l !== null).join('\n')
}
