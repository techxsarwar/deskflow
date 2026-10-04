import { create } from 'zustand'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

export const ACCESS_TOKEN = 'thisisjustarandomstring'
export const USER_KEY = 'deskflow_auth_user'

export interface AuthUser {
  accountNo: string
  email: string
  name?: string
  role: string[]
  exp: number
}

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    accessToken: string
    setAccessToken: (accessToken: string) => void
    resetAccessToken: () => void
    reset: () => void
  }
}

function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function checkIsAuthenticated(): boolean {
  const rawCookie = getCookie(ACCESS_TOKEN)
  if (!rawCookie) return false
  try {
    const parsed = JSON.parse(rawCookie)
    return typeof parsed === 'string' ? parsed.trim().length > 0 : !!parsed
  } catch {
    return rawCookie.trim().length > 0 && rawCookie !== '""'
  }
}

export const useAuthStore = create<AuthState>()((set) => {
  const cookieState = getCookie(ACCESS_TOKEN)
  let initToken = ''
  if (cookieState) {
    try {
      initToken = JSON.parse(cookieState)
    } catch {
      initToken = cookieState
    }
  }

  const initialUser = getStoredUser()

  return {
    auth: {
      user: initialUser,
      setUser: (user) =>
        set((state) => {
          if (typeof window !== 'undefined') {
            if (user) {
              localStorage.setItem(USER_KEY, JSON.stringify(user))
            } else {
              localStorage.removeItem(USER_KEY)
            }
          }
          return { ...state, auth: { ...state.auth, user } }
        }),
      accessToken: initToken,
      setAccessToken: (accessToken) =>
        set((state) => {
          setCookie(ACCESS_TOKEN, JSON.stringify(accessToken))
          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      resetAccessToken: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      reset: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          if (typeof window !== 'undefined') {
            localStorage.removeItem(USER_KEY)
            sessionStorage.removeItem('pending_auth_phone')
            sessionStorage.removeItem('pending_auth_email')
            sessionStorage.removeItem('pending_admin_name')
          }
          return {
            ...state,
            auth: { ...state.auth, user: null, accessToken: '' },
          }
        }),
    },
  }
})
