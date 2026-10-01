export type ShiftType = 'morning' | 'afternoon' | 'evening' | 'night' | 'fullday'

export type SeatType = 'dedicated' | 'flexible' | 'cabin'

export type MembershipPlan = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'daily_pass'

export type StudentStatus = 'active' | 'pending' | 'expired' | 'inactive'

export type PaymentStatus = 'paid' | 'partial' | 'pending' | 'overdue'

export type PaymentMode = 'upi' | 'cash' | 'card' | 'bank_transfer'

export interface FeeTransaction {
  id: string
  studentId: string
  studentName: string
  regNo: string
  amount: number
  paymentDate: string
  paymentTime?: string
  createdAt?: string
  paymentMode: PaymentMode
  receiptNumber: string
  remarks?: string
  seatNumber?: string
  shift?: ShiftType
  membershipPlan?: MembershipPlan
  planAmount?: number
  balanceAfterPayment?: number
  phone?: string
  email?: string
}

export interface Student {
  id: string
  regNo: string
  fullName: string
  email: string
  phone: string
  photoUrl?: string
  emergencyContact: string
  address: string
  studyGoal: string
  shift: ShiftType
  seatType: SeatType
  seatNumber: string
  lockerNumber?: string
  membershipPlan: MembershipPlan
  planAmount: number
  amountPaid: number
  amountDue: number
  paymentStatus: PaymentStatus
  startDate: string
  endDate: string
  status: StudentStatus
  registeredVia: 'online_link' | 'admin_desk'
  createdAt: string
  notes?: string
}

export interface LoungeSeat {
  id: string
  seatNumber: string
  type: SeatType
  section: string
  status: 'available' | 'occupied' | 'reserved' | 'maintenance'
  currentStudentId?: string
  currentStudentName?: string
  shift?: ShiftType
}

export interface LoungeSummaryStats {
  totalStudents: number
  activeStudents: number
  pendingApprovals: number
  totalSeats: number
  occupiedSeats: number
  availableSeats: number
  occupancyRate: number
  totalRevenue: number
  pendingDues: number
}
