import { Student, LoungeSeat, FeeTransaction, SeatType } from '../types'

export const SHIFT_DETAILS: Record<
  string,
  { label: string; timing: string; badgeColor: string }
> = {
  morning: {
    label: 'Morning Slot',
    timing: '06:00 AM - 12:00 PM',
    badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-300 dark:border-amber-700',
  },
  afternoon: {
    label: 'Afternoon Slot',
    timing: '12:00 PM - 06:00 PM',
    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-300 dark:border-blue-700',
  },
  evening: {
    label: 'Evening Slot',
    timing: '06:00 PM - 11:00 PM',
    badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-300 dark:border-purple-700',
  },
  night: {
    label: 'Night Owl Slot',
    timing: '10:00 PM - 06:00 AM',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 border-indigo-300 dark:border-indigo-700',
  },
  fullday: {
    label: 'Full Day Access',
    timing: '06:00 AM - 11:30 PM',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:border-emerald-700',
  },
}

export const PLAN_PRICING: Record<
  string,
  { label: string; durationMonths: number; basePrice: number }
> = {
  monthly: { label: '1 Month Membership', durationMonths: 1, basePrice: 1000 },
  quarterly: { label: '3 Months Plan', durationMonths: 3, basePrice: 3000 },
  half_yearly: { label: '6 Months Plan', durationMonths: 6, basePrice: 6000 },
  yearly: { label: '1 Year Plan', durationMonths: 12, basePrice: 12000 },
  daily_pass: { label: 'Daily Pass', durationMonths: 0, basePrice: 100 },
}

// Clean production state - No fake data
export const INITIAL_STUDENTS: Student[] = []

export const INITIAL_TRANSACTIONS: FeeTransaction[] = []

// 30 Clean Lounge Desks / Cabins ready for real student occupancy (20 Dedicated, 10 Flexible)
export const INITIAL_SEATS: LoungeSeat[] = [
  ...Array.from({ length: 20 }, (_, i) => {
    const seatNumber = `D-${String(i + 1).padStart(2, '0')}`
    return {
      id: `SEAT-${seatNumber}`,
      seatNumber,
      type: 'dedicated' as SeatType,
      section: 'Main Silent Hall A',
      status: 'available' as const,
    }
  }),
  ...Array.from({ length: 10 }, (_, i) => {
    const seatNumber = `F-${String(i + 1).padStart(2, '0')}`
    return {
      id: `SEAT-${seatNumber}`,
      seatNumber,
      type: 'flexible' as SeatType,
      section: 'Flexi Open Zone B',
      status: 'available' as const,
    }
  }),
]
