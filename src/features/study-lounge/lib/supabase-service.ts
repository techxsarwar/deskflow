import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase'
import { Student, FeeTransaction, LoungeSeat } from '../types'
import { sortSeatsNaturally } from './seat-utils'

export const supabaseService = {
  // Check if Supabase client is ready and configured
  isEnabled: () => {
    return isSupabaseConfigured() && getSupabaseClient() !== null
  },

  // Test the connection against the public.students or public.seats table
  testConnection: async (): Promise<{ success: boolean; message: string; rowCount?: number }> => {
    const client = getSupabaseClient()
    if (!client) {
      return { success: false, message: 'Supabase client is not configured with valid URL & Key.' }
    }

    try {
      const { error, count } = await client
        .from('students')
        .select('*', { count: 'exact', head: true })

      if (error) {
        // Check if table doesn't exist
        if (error.code === '42P01') {
          return {
            success: false,
            message: 'Tables not found in Supabase! Please execute supabase/schema.sql in your Supabase SQL Editor.',
          }
        }
        return { success: false, message: error.message }
      }

      return {
        success: true,
        message: 'Connected to Supabase database successfully!',
        rowCount: count ?? 0,
      }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to connect to Supabase.' }
    }
  },

  // -------------------------------------------------------------------------
  // STUDENTS CRUD
  // -------------------------------------------------------------------------
  fetchStudents: async (): Promise<Student[] | null> => {
    const client = getSupabaseClient()
    if (!client) return null

    try {
      const { data, error } = await client
        .from('students')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching students from Supabase:', error.message)
        return null
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        regNo: row.reg_no,
        fullName: row.full_name,
        email: row.email || '',
        phone: row.phone,
        photoUrl: row.photo_url || undefined,
        emergencyContact: row.emergency_contact || '',
        address: row.address || '',
        studyGoal: row.study_goal || '',
        shift: row.shift,
        seatType: row.seat_type,
        seatNumber: row.seat_number || 'Unassigned',
        lockerNumber: row.locker_number || undefined,
        membershipPlan: row.membership_plan,
        planAmount: row.plan_amount,
        amountPaid: row.amount_paid,
        amountDue: row.amount_due,
        paymentStatus: row.payment_status,
        startDate: row.start_date,
        endDate: row.end_date,
        status: row.status,
        registeredVia: row.registered_via,
        createdAt: row.created_at,
        notes: row.notes || undefined,
      }))
    } catch (err) {
      console.error('Supabase fetchStudents exception:', err)
      return null
    }
  },

  insertStudent: async (student: Student): Promise<boolean> => {
    const client = getSupabaseClient()
    if (!client) return false

    try {
      const { error } = await client.from('students').insert({
        id: student.id,
        reg_no: student.regNo,
        full_name: student.fullName,
        email: student.email || null,
        phone: student.phone,
        photo_url: student.photoUrl || null,
        emergency_contact: student.emergencyContact || null,
        address: student.address || null,
        study_goal: student.studyGoal || null,
        shift: student.shift,
        seat_type: student.seatType,
        seat_number: student.seatNumber || 'Unassigned',
        locker_number: student.lockerNumber || null,
        membership_plan: student.membershipPlan,
        plan_amount: student.planAmount,
        amount_paid: student.amountPaid,
        amount_due: student.amountDue,
        payment_status: student.paymentStatus,
        start_date: student.startDate,
        end_date: student.endDate,
        status: student.status,
        registered_via: student.registeredVia,
        notes: student.notes || null,
      })

      if (error) {
        console.error('Error inserting student to Supabase:', error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('Supabase insertStudent exception:', err)
      return false
    }
  },

  updateStudent: async (id: string, updates: Partial<Student>): Promise<boolean> => {
    const client = getSupabaseClient()
    if (!client) return false

    try {
      const dbPayload: Record<string, any> = {}
      if (updates.fullName !== undefined) dbPayload.full_name = updates.fullName
      if (updates.email !== undefined) dbPayload.email = updates.email
      if (updates.phone !== undefined) dbPayload.phone = updates.phone
      if (updates.photoUrl !== undefined) dbPayload.photo_url = updates.photoUrl
      if (updates.emergencyContact !== undefined) dbPayload.emergency_contact = updates.emergencyContact
      if (updates.address !== undefined) dbPayload.address = updates.address
      if (updates.studyGoal !== undefined) dbPayload.study_goal = updates.studyGoal
      if (updates.shift !== undefined) dbPayload.shift = updates.shift
      if (updates.seatType !== undefined) dbPayload.seat_type = updates.seatType
      if (updates.seatNumber !== undefined) dbPayload.seat_number = updates.seatNumber
      if (updates.lockerNumber !== undefined) dbPayload.locker_number = updates.lockerNumber
      if (updates.membershipPlan !== undefined) dbPayload.membership_plan = updates.membershipPlan
      if (updates.planAmount !== undefined) dbPayload.plan_amount = updates.planAmount
      if (updates.amountPaid !== undefined) dbPayload.amount_paid = updates.amountPaid
      if (updates.amountDue !== undefined) dbPayload.amount_due = updates.amountDue
      if (updates.paymentStatus !== undefined) dbPayload.payment_status = updates.paymentStatus
      if (updates.startDate !== undefined) dbPayload.start_date = updates.startDate
      if (updates.endDate !== undefined) dbPayload.end_date = updates.endDate
      if (updates.status !== undefined) dbPayload.status = updates.status
      if (updates.notes !== undefined) dbPayload.notes = updates.notes

      const { error } = await client.from('students').update(dbPayload).eq('id', id)
      if (error) {
        console.error('Error updating student in Supabase:', error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('Supabase updateStudent exception:', err)
      return false
    }
  },

  deleteStudent: async (id: string): Promise<boolean> => {
    const client = getSupabaseClient()
    if (!client) return false

    try {
      const { error } = await client.from('students').delete().eq('id', id)
      if (error) {
        console.error('Error deleting student from Supabase:', error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('Supabase deleteStudent exception:', err)
      return false
    }
  },

  // -------------------------------------------------------------------------
  // STORAGE (S3 Photo Uploads)
  // -------------------------------------------------------------------------
  uploadStudentPhoto: async (file: File | Blob, identifier: string): Promise<string | null> => {
    const client = getSupabaseClient()
    if (!client) return null

    try {
      const bucket = 'student-photos'
      const fileExt = file instanceof File ? file.name.split('.').pop() || 'jpg' : 'jpg'
      const cleanId = (identifier || 'student').toLowerCase().replace(/[^a-z0-9_-]/g, '')
      const fileName = `${cleanId}_${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await client.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        console.error('Supabase storage upload error:', uploadError.message)
        return null
      }

      const { data: publicUrlData } = client.storage
        .from(bucket)
        .getPublicUrl(filePath)

      return publicUrlData.publicUrl
    } catch (err) {
      console.error('Exception during uploadStudentPhoto:', err)
      return null
    }
  },

  // -------------------------------------------------------------------------
  // TRANSACTIONS
  // -------------------------------------------------------------------------
  fetchTransactions: async (): Promise<FeeTransaction[] | null> => {
    const client = getSupabaseClient()
    if (!client) return null

    try {
      const { data, error } = await client
        .from('fee_transactions')
        .select('*')
        .order('payment_date', { ascending: false })

      if (error) {
        console.error('Error fetching transactions from Supabase:', error.message)
        return null
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        studentId: row.student_id,
        studentName: row.student_name,
        regNo: row.reg_no,
        amount: row.amount,
        paymentDate: row.payment_date,
        createdAt: row.created_at || undefined,
        paymentTime: row.created_at
          ? new Date(row.created_at).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            })
          : undefined,
        paymentMode: row.payment_mode,
        receiptNumber: row.receipt_number,
        remarks: row.remarks || undefined,
      }))
    } catch (err) {
      console.error('Supabase fetchTransactions exception:', err)
      return null
    }
  },

  insertTransaction: async (txn: FeeTransaction): Promise<boolean> => {
    const client = getSupabaseClient()
    if (!client) return false

    try {
      const { error } = await client.from('fee_transactions').insert({
        id: txn.id,
        student_id: txn.studentId,
        student_name: txn.studentName,
        reg_no: txn.regNo,
        amount: txn.amount,
        payment_date: txn.paymentDate,
        payment_mode: txn.paymentMode,
        receipt_number: txn.receiptNumber,
        remarks: txn.remarks || null,
      })

      if (error) {
        console.error('Error inserting transaction to Supabase:', error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('Supabase insertTransaction exception:', err)
      return false
    }
  },

  // -------------------------------------------------------------------------
  // SEATS
  // -------------------------------------------------------------------------
  fetchSeats: async (): Promise<LoungeSeat[] | null> => {
    const client = getSupabaseClient()
    if (!client) return null

    try {
      const { data, error } = await client
        .from('seats')
        .select('*')
        .order('seat_number')

      if (error) {
        console.error('Error fetching seats from Supabase:', error.message)
        return null
      }

      const mappedSeats: LoungeSeat[] = (data || []).map((row: any) => ({
        id: row.id,
        seatNumber: row.seat_number,
        type: row.type,
        section: row.section,
        status: row.status,
        currentStudentId: row.current_student_id || undefined,
        currentStudentName: row.current_student_name || undefined,
        shift: row.shift || undefined,
      }))

      return sortSeatsNaturally(mappedSeats)
    } catch (err) {
      console.error('Supabase fetchSeats exception:', err)
      return null
    }
  },

  assignSeat: async (
    seatNumber: string,
    studentId?: string,
    studentName?: string,
    shift?: string
  ): Promise<boolean> => {
    const client = getSupabaseClient()
    if (!client) return false

    try {
      const { error } = await client
        .from('seats')
        .update({
          status: studentId ? 'occupied' : 'available',
          current_student_id: studentId || null,
          current_student_name: studentName || null,
          shift: shift || null,
        })
        .eq('seat_number', seatNumber)

      if (error) {
        console.error('Error assigning seat in Supabase:', error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('Supabase assignSeat exception:', err)
      return false
    }
  },

  insertSeat: async (seat: LoungeSeat): Promise<boolean> => {
    const client = getSupabaseClient()
    if (!client) return false

    try {
      const { error } = await client.from('seats').upsert(
        {
          id: seat.id,
          seat_number: seat.seatNumber,
          type: seat.type || 'dedicated',
          section: seat.section,
          status: seat.status || 'available',
        },
        { onConflict: 'seat_number' }
      )

      if (error) {
        console.error('Error inserting seat into Supabase:', error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('Supabase insertSeat exception:', err)
      return false
    }
  },

  insertSeatsBulk: async (seatsList: LoungeSeat[]): Promise<boolean> => {
    const client = getSupabaseClient()
    if (!client || seatsList.length === 0) return false

    try {
      const rows = seatsList.map((seat) => ({
        id: seat.id,
        seat_number: seat.seatNumber,
        type: seat.type || 'dedicated',
        section: seat.section,
        status: seat.status || 'available',
      }))

      const { error } = await client.from('seats').upsert(rows, { onConflict: 'seat_number' })

      if (error) {
        console.error('Error bulk inserting seats into Supabase:', error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('Supabase insertSeatsBulk exception:', err)
      return false
    }
  },

  deleteSeat: async (seatNumber: string): Promise<boolean> => {
    const client = getSupabaseClient()
    if (!client) return false

    try {
      const { error } = await client.from('seats').delete().eq('seat_number', seatNumber)
      if (error) {
        console.error('Error deleting seat from Supabase:', error.message)
        return false
      }
      return true
    } catch (err) {
      console.error('Supabase deleteSeat exception:', err)
      return false
    }
  },

  // -------------------------------------------------------------------------
  // REAL-TIME SUBSCRIPTION
  // -------------------------------------------------------------------------
  subscribeToChanges: (onChanges: () => void) => {
    const client = getSupabaseClient()
    if (!client) return () => {}

    try {
      const channel = client
        .channel('vcl-realtime-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'students' },
          () => {
            onChanges()
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'fee_transactions' },
          () => {
            onChanges()
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'seats' },
          () => {
            onChanges()
          }
        )
        .subscribe()

      return () => {
        client.removeChannel(channel)
      }
    } catch (err) {
      console.error('Failed to setup Supabase realtime subscription:', err)
      return () => {}
    }
  },
}
