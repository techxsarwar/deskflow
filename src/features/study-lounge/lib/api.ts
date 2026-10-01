import axios from 'axios'
import { Student, FeeTransaction, LoungeSeat, LoungeSummaryStats, PaymentMode } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const studyLoungeApi = {
  // Health
  checkHealth: async () => {
    const res = await api.get('/health')
    return res.data
  },

  // Dashboard Stats
  getDashboardStats: async (): Promise<LoungeSummaryStats> => {
    const res = await api.get('/api/dashboard')
    return res.data
  },

  // Students
  getStudents: async (search?: string, shift?: string, status?: string): Promise<Student[]> => {
    const res = await api.get('/api/students', {
      params: { search, shift, status },
    })
    return res.data
  },

  getStudentById: async (id: string): Promise<Student> => {
    const res = await api.get(`/api/students/${id}`)
    return res.data
  },

  createStudent: async (student: Partial<Student>): Promise<Student> => {
    const res = await api.post('/api/students', student)
    return res.data
  },

  updateStudent: async (id: string, student: Partial<Student>): Promise<Student> => {
    const res = await api.put(`/api/students/${id}`, student)
    return res.data
  },

  deleteStudent: async (id: string): Promise<void> => {
    await api.delete(`/api/students/${id}`)
  },

  approveStudent: async (id: string, seatNumber?: string): Promise<Student> => {
    const res = await api.post(`/api/students/${id}/approve`, { seatNumber })
    return res.data
  },

  // Public Student Self-Registration
  publicRegister: async (studentData: Partial<Student>): Promise<Student> => {
    const res = await api.post('/api/public/register', studentData)
    return res.data
  },

  // Fees & Receipts
  getTransactions: async (): Promise<FeeTransaction[]> => {
    const res = await api.get('/api/fees/transactions')
    return res.data
  },

  collectFee: async (
    studentId: string,
    amount: number,
    paymentMode: PaymentMode,
    remarks?: string
  ): Promise<FeeTransaction> => {
    const res = await api.post('/api/fees/collect', {
      studentId,
      amount,
      paymentMode,
      remarks,
    })
    return res.data
  },

  // Seats & Desks
  getSeats: async (): Promise<LoungeSeat[]> => {
    const res = await api.get('/api/seats')
    return res.data
  },

  assignSeat: async (studentId: string, seatNumber: string): Promise<void> => {
    await api.post('/api/seats/assign', { studentId, seatNumber })
  },
}
