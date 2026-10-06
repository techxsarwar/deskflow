import axios from 'axios'
import { Student, FeeTransaction, LoungeSeat, LoungeSummaryStats, PaymentMode } from '../types'

import { getCookie } from '@/lib/cookies'
import { ACCESS_TOKEN } from '@/stores/auth-store'

// In production on Vercel (same-origin multi-service routing), requests default to relative ''
// In local Vite dev, defaults to http://localhost:8080 unless VITE_API_URL is explicitly set
const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:8080' : '')

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach Admin Authentication Token to all outgoing requests
api.interceptors.request.use((config) => {
  if (typeof document !== 'undefined') {
    const rawCookie = getCookie(ACCESS_TOKEN)
    if (rawCookie) {
      try {
        const token = JSON.parse(rawCookie)
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
          config.headers['X-Admin-Token'] = token
        }
      } catch {
        config.headers.Authorization = `Bearer ${rawCookie}`
        config.headers['X-Admin-Token'] = rawCookie
      }
    }
  }
  return config
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

  // Monthly Student Activity Report (PDF & Telegram Channel Storage)
  generateMonthlyReport: async (params: {
    studentId: string
    year?: number
    month?: number
    sendToTelegram?: boolean
    targetChatId?: string
  }): Promise<{
    success: boolean
    reportData: any
    telegramSent: boolean
    telegramResult?: any
    pdfBase64?: string
    filename?: string
  }> => {
    const res = await api.post('/api/reports/student-monthly', params)
    return res.data
  },

  getAvailableReportPeriods: async (
    studentId: string
  ): Promise<{
    success: boolean
    studentId: string
    periods: Array<{
      year: number
      month: number
      monthName: string
      fullMonthName: string
      sessions: number
    }>
  }> => {
    const res = await api.get('/api/reports/available-periods', {
      params: { studentId },
    })
    return res.data
  },

  // Email Student Monthly Report PDF directly via Resend
  emailMonthlyReport: async (params: {
    studentId: string
    year?: number
    month?: number
    email?: string
  }): Promise<{
    success: boolean
    message: string
    recipient?: string
    filename?: string
  }> => {
    const res = await api.post('/api/reports/email-student', params)
    return res.data
  },
}


