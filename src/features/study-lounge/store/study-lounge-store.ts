import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Student, LoungeSeat, FeeTransaction, PaymentMode } from '../types'
import { INITIAL_STUDENTS, INITIAL_SEATS, INITIAL_TRANSACTIONS } from '../data/mock-data'
import { supabaseService } from '../lib/supabase-service'

export interface AddStudentInput {
  fullName: string
  email: string
  phone: string
  photoUrl?: string
  emergencyContact: string
  address: string
  studyGoal: string
  shift: Student['shift']
  seatType: Student['seatType']
  seatNumber?: string
  lockerNumber?: string
  membershipPlan: Student['membershipPlan']
  planAmount: number
  amountPaid: number
  startDate: string
  endDate: string
  registeredVia?: 'online_link' | 'admin_desk'
  notes?: string
}

interface StudyLoungeState {
  students: Student[]
  seats: LoungeSeat[]
  transactions: FeeTransaction[]
  isSupabaseConnected: boolean
  isLoadingSupabase: boolean
  lastSyncTime: string | null

  // Actions
  addStudent: (data: AddStudentInput) => Student
  updateStudent: (id: string, data: Partial<Student>) => void
  deleteStudent: (id: string) => void
  approveStudent: (id: string, seatNumber?: string) => void
  rejectStudent: (id: string) => void
  releaseExpiredSeat: (studentId: string) => void
  autoReleaseAllExpiredSeats: (graceDays?: number) => { releasedCount: number; releasedSeats: string[] }
  renewStudentMembership: (
    studentId: string,
    options: {
      durationMonths?: number
      planFee?: number
      amountPaidNow?: number
      paymentMode?: PaymentMode
      remarks?: string
    }
  ) => { student: Student; transaction?: FeeTransaction } | null
  recordPayment: (
    studentId: string,
    amount: number,
    paymentMode: PaymentMode,
    remarks?: string
  ) => FeeTransaction | null
  assignSeat: (studentId: string, seatNumber: string) => void
  addSeat: (data: { seatNumber: string; type: LoungeSeat['type']; section: string }) => LoungeSeat
  addSeatsBulk: (seatsData: { seatNumber: string; type: LoungeSeat['type']; section: string }[]) => LoungeSeat[]
  deleteSeat: (seatNumber: string) => void
  resetToDefaults: () => void
  syncWithSupabase: (silent?: boolean) => Promise<boolean>
  initRealtimeSubscription: () => () => void
}

export const useStudyLoungeStore = create<StudyLoungeState>()(
  persist(
    (set, get) => ({
      students: INITIAL_STUDENTS,
      seats: INITIAL_SEATS,
      transactions: INITIAL_TRANSACTIONS,
      isSupabaseConnected: false,
      isLoadingSupabase: false,
      lastSyncTime: null,

      syncWithSupabase: async (silent = false) => {
        if (!supabaseService.isEnabled()) {
          set({ isSupabaseConnected: false })
          return false
        }

        if (!silent) set({ isLoadingSupabase: true })

        try {
          const [dbStudents, dbTransactions, dbSeats] = await Promise.all([
            supabaseService.fetchStudents(),
            supabaseService.fetchTransactions(),
            supabaseService.fetchSeats(),
          ])

          const updates: Partial<StudyLoungeState> = {
            isSupabaseConnected: true,
            isLoadingSupabase: false,
            lastSyncTime: new Date().toLocaleTimeString(),
          }

          if (dbStudents !== null) {
            updates.students = dbStudents
          }

          if (dbTransactions !== null) {
            updates.transactions = dbTransactions
          }

          if (dbSeats !== null && dbSeats.length > 0) {
            updates.seats = dbSeats
          }

          set(updates)
          return true
        } catch (err) {
          console.error('Failed to sync with Supabase:', err)
          set({ isLoadingSupabase: false })
          return false
        }
      },

      initRealtimeSubscription: () => {
        if (!supabaseService.isEnabled()) return () => {}
        return supabaseService.subscribeToChanges(() => {
          get().syncWithSupabase(true)
        })
      },

      addStudent: (data) => {
        const currentStudents = get().students
        const count = currentStudents.length + 1
        const id = `STU-${String(count).padStart(3, '0')}-${Date.now().toString().slice(-4)}`
        const regNo = `SL-${new Date().getFullYear()}-${String(100 + count)}`

        const due = Math.max(0, data.planAmount - data.amountPaid)
        const paymentStatus =
          data.amountPaid >= data.planAmount
            ? 'paid'
            : data.amountPaid > 0
              ? 'partial'
              : 'pending'

        const isOnline = data.registeredVia === 'online_link'

        const newStudent: Student = {
          id,
          regNo,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          photoUrl: data.photoUrl,
          emergencyContact: data.emergencyContact,
          address: data.address,
          studyGoal: data.studyGoal,
          shift: data.shift,
          seatType: data.seatType,
          seatNumber: data.seatNumber || 'Unassigned',
          lockerNumber: data.lockerNumber,
          membershipPlan: data.membershipPlan,
          planAmount: data.planAmount,
          amountPaid: data.amountPaid,
          amountDue: due,
          paymentStatus,
          startDate: data.startDate,
          endDate: data.endDate,
          status: isOnline ? 'pending' : 'active',
          registeredVia: data.registeredVia || 'admin_desk',
          createdAt: new Date().toISOString(),
          notes: data.notes,
        }

        let newTransactions = get().transactions
        let newTxn: FeeTransaction | null = null
        if (data.amountPaid > 0) {
          const now = new Date()
          newTxn = {
            id: `TXN-${Date.now().toString().slice(-6)}`,
            studentId: id,
            studentName: data.fullName,
            regNo,
            amount: data.amountPaid,
            paymentDate: now.toISOString().split('T')[0],
            paymentTime: now.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            }),
            createdAt: now.toISOString(),
            paymentMode: 'upi',
            receiptNumber: `RCP-${Date.now().toString().slice(-6)}`,
            remarks: 'Initial Admission & Membership Fee',
            seatNumber: newStudent.seatNumber,
            shift: newStudent.shift,
            membershipPlan: newStudent.membershipPlan,
            planAmount: newStudent.planAmount,
            balanceAfterPayment: due,
            phone: newStudent.phone,
            email: newStudent.email,
          }
          newTransactions = [newTxn, ...newTransactions]
        }

        // Update seats if assigned
        let newSeats = get().seats
        if (newStudent.seatNumber && newStudent.seatNumber !== 'Unassigned') {
          newSeats = newSeats.map((seat) =>
            seat.seatNumber === newStudent.seatNumber
              ? {
                  ...seat,
                  status: 'occupied',
                  currentStudentId: newStudent.id,
                  currentStudentName: newStudent.fullName,
                  shift: newStudent.shift,
                }
              : seat
          )
        }

        // Optimistic local state update
        set({
          students: [newStudent, ...currentStudents],
          transactions: newTransactions,
          seats: newSeats,
        })

        // Persist to Supabase if configured
        if (supabaseService.isEnabled()) {
          supabaseService.insertStudent(newStudent).catch((e) => {
            console.error('Background Supabase insertStudent error:', e)
          })

          if (newTxn) {
            supabaseService.insertTransaction(newTxn).catch((e) => {
              console.error('Background Supabase insertTransaction error:', e)
            })
          }

          if (newStudent.seatNumber && newStudent.seatNumber !== 'Unassigned') {
            supabaseService
              .assignSeat(
                newStudent.seatNumber,
                newStudent.id,
                newStudent.fullName,
                newStudent.shift
              )
              .catch((e) => {
                console.error('Background Supabase assignSeat error:', e)
              })
          }
        }

        return newStudent
      },

      updateStudent: (id, data) => {
        let updatedStudent: Student | null = null
        set((state) => {
          const updated = state.students.map((student) => {
            if (student.id !== id) return student

            const merged = { ...student, ...data }
            const due = Math.max(0, merged.planAmount - merged.amountPaid)
            const paymentStatus =
              merged.amountPaid >= merged.planAmount
                ? 'paid'
                : merged.amountPaid > 0
                  ? 'partial'
                  : 'pending'

            const finalObj: Student = {
              ...merged,
              amountDue: due,
              paymentStatus,
            }
            updatedStudent = finalObj
            return finalObj
          })
          return { students: updated }
        })

        if (supabaseService.isEnabled() && updatedStudent) {
          supabaseService.updateStudent(id, data).catch((e) => {
            console.error('Background Supabase updateStudent error:', e)
          })
        }
      },

      deleteStudent: (id) => {
        const studentToDelete = get().students.find((s) => s.id === id)
        const oldSeatNumber = studentToDelete?.seatNumber

        set((state) => {
          const newSeats = state.seats.map((seat) =>
            seat.currentStudentId === id
              ? {
                  ...seat,
                  status: 'available' as const,
                  currentStudentId: undefined,
                  currentStudentName: undefined,
                  shift: undefined,
                }
              : seat
          )
          return {
            students: state.students.filter((s) => s.id !== id),
            seats: newSeats,
          }
        })

        if (supabaseService.isEnabled()) {
          supabaseService.deleteStudent(id).catch((e) => {
            console.error('Background Supabase deleteStudent error:', e)
          })

          if (oldSeatNumber && oldSeatNumber !== 'Unassigned') {
            supabaseService.assignSeat(oldSeatNumber, undefined, undefined, undefined).catch((e) => {
              console.error('Background Supabase freeSeat error:', e)
            })
          }
        }
      },

      approveStudent: (id, seatNumber) => {
        const student = get().students.find((s) => s.id === id)
        if (!student) return

        const availableSeat = get().seats.find((s) => s.status === 'available')?.seatNumber
        const assignedSeat = seatNumber || (student.seatNumber && student.seatNumber !== 'Unassigned' ? student.seatNumber : (availableSeat || 'Unassigned'))

        set((state) => {
          const updatedStudents = state.students.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: 'active' as const,
                  seatNumber: assignedSeat,
                }
              : s
          )

          const updatedSeats = state.seats.map((seat) =>
            seat.seatNumber === assignedSeat
              ? {
                  ...seat,
                  status: 'occupied' as const,
                  currentStudentId: student.id,
                  currentStudentName: student.fullName,
                  shift: student.shift,
                }
              : seat
          )

          return {
            students: updatedStudents,
            seats: updatedSeats,
          }
        })

        if (supabaseService.isEnabled()) {
          supabaseService.updateStudent(id, { status: 'active', seatNumber: assignedSeat }).catch((e) => {
            console.error('Background Supabase approveStudent error:', e)
          })
          supabaseService.assignSeat(assignedSeat, student.id, student.fullName, student.shift).catch((e) => {
            console.error('Background Supabase assignSeat error:', e)
          })
        }
      },

      rejectStudent: (id) => {
        const student = get().students.find((s) => s.id === id)
        if (!student) return
        const seatToFree = student.seatNumber

        set((state) => {
          const updatedSeats = state.seats.map((seat) =>
            seat.seatNumber === seatToFree || seat.currentStudentId === id
              ? {
                  ...seat,
                  status: 'available' as const,
                  currentStudentId: undefined,
                  currentStudentName: undefined,
                  shift: undefined,
                }
              : seat
          )
          return {
            students: state.students.filter((s) => s.id !== id),
            seats: updatedSeats,
          }
        })

        if (supabaseService.isEnabled()) {
          supabaseService.deleteStudent(id).catch((e) => {
            console.error('Background Supabase rejectStudent error:', e)
          })
          if (seatToFree && seatToFree !== 'Unassigned') {
            supabaseService.assignSeat(seatToFree, undefined, undefined, undefined).catch((e) => {
              console.error('Background Supabase freeSeat on reject error:', e)
            })
          }
        }
      },

      releaseExpiredSeat: (studentId) => {
        const student = get().students.find((s) => s.id === studentId)
        if (!student) return
        const seatToFree = student.seatNumber

        set((state) => {
          const updatedStudents = state.students.map((s) =>
            s.id === studentId
              ? {
                  ...s,
                  status: 'expired' as const,
                  seatNumber: 'Unassigned',
                }
              : s
          )
          const updatedSeats = state.seats.map((seat) =>
            seat.seatNumber === seatToFree || seat.currentStudentId === studentId
              ? {
                  ...seat,
                  status: 'available' as const,
                  currentStudentId: undefined,
                  currentStudentName: undefined,
                  shift: undefined,
                }
              : seat
          )
          return {
            students: updatedStudents,
            seats: updatedSeats,
          }
        })

        if (supabaseService.isEnabled()) {
          supabaseService.updateStudent(studentId, { status: 'expired', seatNumber: 'Unassigned' }).catch((e) => {
            console.error('Background Supabase releaseExpiredSeat student error:', e)
          })
          if (seatToFree && seatToFree !== 'Unassigned') {
            supabaseService.assignSeat(seatToFree, undefined, undefined, undefined).catch((e) => {
              console.error('Background Supabase freeSeat on expire error:', e)
            })
          }
        }
      },

      autoReleaseAllExpiredSeats: (graceDays = 2) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const expiredStudentsWithSeats = get().students.filter((s) => {
          if (!s.seatNumber || s.seatNumber === 'Unassigned') return false
          if (s.status === 'pending') return false
          const [ey, em, ed] = s.endDate.split('-').map(Number)
          const endDate = new Date(ey, em - 1, ed)
          const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          return diffDays < -graceDays
        })

        if (expiredStudentsWithSeats.length === 0) {
          return { releasedCount: 0, releasedSeats: [] }
        }

        const releasedSeats: string[] = []
        expiredStudentsWithSeats.forEach((s) => {
          releasedSeats.push(s.seatNumber)
          get().releaseExpiredSeat(s.id)
        })

        return { releasedCount: expiredStudentsWithSeats.length, releasedSeats }
      },

      renewStudentMembership: (studentId, options) => {
        const student = get().students.find((s) => s.id === studentId)
        if (!student) return null

        const durationMonths = options.durationMonths || 1
        const planFee = options.planFee || 1000
        const amountPaidNow = options.amountPaidNow ?? planFee
        const paymentMode = options.paymentMode || 'upi'

        // Calculate new end date
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const [ey, em, ed] = student.endDate.split('-').map(Number)
        const existingEnd = new Date(ey, em - 1, ed)
        const baseDate = existingEnd > today ? new Date(existingEnd) : new Date(today)
        baseDate.setMonth(baseDate.getMonth() + durationMonths)
        const newEndDate = baseDate.toISOString().split('T')[0]

        // Update financial figures
        const newPlanAmount = student.planAmount + planFee
        const newAmountPaid = student.amountPaid + amountPaidNow
        const newAmountDue = Math.max(0, newPlanAmount - newAmountPaid)
        const paymentStatus =
          newAmountPaid >= newPlanAmount
            ? 'paid'
            : newAmountPaid > 0
              ? 'partial'
              : 'pending'

        let newTxn: FeeTransaction | undefined = undefined
        if (amountPaidNow > 0) {
          const now = new Date()
          const receiptNumber = `RCP-${Date.now().toString().slice(-6)}`
          newTxn = {
            id: `TXN-${Date.now().toString().slice(-6)}`,
            studentId: student.id,
            studentName: student.fullName,
            regNo: student.regNo,
            amount: amountPaidNow,
            paymentDate: now.toISOString().split('T')[0],
            paymentTime: now.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            }),
            createdAt: now.toISOString(),
            paymentMode,
            receiptNumber,
            remarks: options.remarks || `Monthly Renewal (+${durationMonths} mo)`,
            seatNumber: student.seatNumber,
            shift: student.shift,
            membershipPlan: student.membershipPlan,
            planAmount: newPlanAmount,
            balanceAfterPayment: newAmountDue,
            phone: student.phone,
            email: student.email,
          }
        }

        let updatedStudentObj: Student | null = null

        set((state) => {
          const updatedStudents = state.students.map((s) => {
            if (s.id !== studentId) return s
            const updated: Student = {
              ...s,
              status: 'active',
              endDate: newEndDate,
              planAmount: newPlanAmount,
              amountPaid: newAmountPaid,
              amountDue: newAmountDue,
              paymentStatus,
              notes: options.remarks
                ? `${s.notes ? s.notes + ' | ' : ''}Renewed: ${options.remarks}`
                : s.notes,
            }
            updatedStudentObj = updated
            return updated
          })

          const updatedSeats = state.seats.map((seat) =>
            seat.seatNumber === student.seatNumber
              ? {
                  ...seat,
                  status: 'occupied' as const,
                  currentStudentId: student.id,
                  currentStudentName: student.fullName,
                  shift: student.shift,
                }
              : seat
          )

          const updatedTransactions = newTxn
            ? [newTxn, ...state.transactions]
            : state.transactions

          return {
            students: updatedStudents,
            seats: updatedSeats,
            transactions: updatedTransactions,
          }
        })

        if (supabaseService.isEnabled() && updatedStudentObj) {
          supabaseService.updateStudent(studentId, {
            status: 'active',
            endDate: newEndDate,
            planAmount: newPlanAmount,
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            paymentStatus,
          }).catch((e) => {
            console.error('Background Supabase updateStudent renewal error:', e)
          })

          if (newTxn) {
            supabaseService.insertTransaction(newTxn).catch((e) => {
              console.error('Background Supabase insertTransaction renewal error:', e)
            })
          }
        }

        return {
          student: updatedStudentObj || student,
          transaction: newTxn,
        }
      },

      recordPayment: (studentId, amount, paymentMode, remarks) => {
        const student = get().students.find((s) => s.id === studentId)
        if (!student) return null

        const receiptNumber = `RCP-${Date.now().toString().slice(-6)}`
        const now = new Date()
        const newPaid = student.amountPaid + amount
        const newDue = Math.max(0, student.planAmount - newPaid)

        const newTransaction: FeeTransaction = {
          id: `TXN-${Date.now().toString().slice(-6)}`,
          studentId: student.id,
          studentName: student.fullName,
          regNo: student.regNo,
          amount,
          paymentDate: now.toISOString().split('T')[0],
          paymentTime: now.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }),
          createdAt: now.toISOString(),
          paymentMode,
          receiptNumber,
          remarks: remarks || `Fee payment towards ${student.membershipPlan.replace('_', ' ')} membership`,
          seatNumber: student.seatNumber,
          shift: student.shift,
          membershipPlan: student.membershipPlan,
          planAmount: student.planAmount,
          balanceAfterPayment: newDue,
          phone: student.phone,
          email: student.email,
        }
        const paymentStatus =
          newPaid >= student.planAmount
            ? 'paid'
            : newPaid > 0
              ? 'partial'
              : 'pending'

        set((state) => ({
          transactions: [newTransaction, ...state.transactions],
          students: state.students.map((s) =>
            s.id === studentId
              ? {
                  ...s,
                  amountPaid: newPaid,
                  amountDue: newDue,
                  paymentStatus,
                }
              : s
          ),
        }))

        if (supabaseService.isEnabled()) {
          supabaseService.insertTransaction(newTransaction).catch((e) => {
            console.error('Background Supabase insertTransaction error:', e)
          })
          supabaseService.updateStudent(studentId, {
            amountPaid: newPaid,
            amountDue: newDue,
            paymentStatus,
          }).catch((e) => {
            console.error('Background Supabase updateStudent payment error:', e)
          })
        }

        return newTransaction
      },

      assignSeat: (studentId, seatNumber) => {
        const student = get().students.find((s) => s.id === studentId)
        if (!student) return

        const oldSeat = student.seatNumber

        set((state) => {
          const updatedSeats = state.seats.map((seat) => {
            if (seat.seatNumber === oldSeat) {
              return {
                ...seat,
                status: 'available' as const,
                currentStudentId: undefined,
                currentStudentName: undefined,
                shift: undefined,
              }
            }
            if (seat.seatNumber === seatNumber) {
              return {
                ...seat,
                status: 'occupied' as const,
                currentStudentId: student.id,
                currentStudentName: student.fullName,
                shift: student.shift,
              }
            }
            return seat
          })

          const updatedStudents = state.students.map((s) =>
            s.id === studentId ? { ...s, seatNumber } : s
          )

          return {
            students: updatedStudents,
            seats: updatedSeats,
          }
        })

        if (supabaseService.isEnabled()) {
          if (oldSeat && oldSeat !== 'Unassigned') {
            supabaseService.assignSeat(oldSeat, undefined, undefined, undefined).catch((e) => {
              console.error('Background Supabase freeSeat error:', e)
            })
          }
          supabaseService.assignSeat(seatNumber, student.id, student.fullName, student.shift).catch((e) => {
            console.error('Background Supabase assignSeat error:', e)
          })
          supabaseService.updateStudent(studentId, { seatNumber }).catch((e) => {
            console.error('Background Supabase updateStudent seat error:', e)
          })
        }
      },

      addSeat: (data) => {
        const id = `SEAT-${data.seatNumber}`
        const newSeat: LoungeSeat = {
          id,
          seatNumber: data.seatNumber,
          type: data.type,
          section: data.section,
          status: 'available',
        }

        set((state) => ({
          seats: [...state.seats.filter((s) => s.seatNumber !== data.seatNumber), newSeat],
        }))

        if (supabaseService.isEnabled()) {
          supabaseService.insertSeat(newSeat).catch((e) => {
            console.error('Background Supabase insertSeat error:', e)
          })
        }

        return newSeat
      },

      addSeatsBulk: (seatsData) => {
        const newSeats: LoungeSeat[] = seatsData.map((data) => ({
          id: `SEAT-${data.seatNumber}`,
          seatNumber: data.seatNumber,
          type: data.type || 'dedicated',
          section: data.section,
          status: 'available',
        }))

        const newSeatNumbers = new Set(newSeats.map((s) => s.seatNumber))

        set((state) => ({
          seats: [
            ...state.seats.filter((s) => !newSeatNumbers.has(s.seatNumber)),
            ...newSeats,
          ],
        }))

        if (supabaseService.isEnabled()) {
          supabaseService.insertSeatsBulk(newSeats).catch((e) => {
            console.error('Background Supabase insertSeatsBulk error:', e)
          })
        }

        return newSeats
      },

      deleteSeat: (seatNumber) => {
        set((state) => ({
          seats: state.seats.filter((s) => s.seatNumber !== seatNumber),
          students: state.students.map((st) =>
            st.seatNumber === seatNumber ? { ...st, seatNumber: 'Unassigned' } : st
          ),
        }))

        if (supabaseService.isEnabled()) {
          supabaseService.deleteSeat(seatNumber).catch((e) => {
            console.error('Background Supabase deleteSeat error:', e)
          })
        }
      },

      resetToDefaults: () => {
        set({
          students: INITIAL_STUDENTS,
          seats: INITIAL_SEATS,
          transactions: INITIAL_TRANSACTIONS,
        })
      },
    }),
    {
      name: 'vertical-classes-library-storage-v2',
    }
  )
)
