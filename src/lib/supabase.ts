import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig {
  url: string
  anonKey: string
  isValid: boolean
  source: 'env' | 'localStorage' | 'none'
}

export const getSupabaseConfig = (): SupabaseConfig => {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

  let url = envUrl
  let anonKey = envKey
  let source: 'env' | 'localStorage' | 'none' = envUrl && envKey ? 'env' : 'none'

  if (typeof window !== 'undefined') {
    const localUrl = (localStorage.getItem('vcl_supabase_url') || '').trim()
    const localKey = (localStorage.getItem('vcl_supabase_anon_key') || '').trim()
    if (localUrl && localKey && (!envUrl || !envKey)) {
      url = localUrl
      anonKey = localKey
      source = 'localStorage'
    }
  }

  const isValid = Boolean(
    url &&
      anonKey &&
      url.startsWith('https://') &&
      !url.includes('your-project') &&
      anonKey.length > 20
  )

  return { url, anonKey, isValid, source }
}

let cachedClient: SupabaseClient | null = null
let lastConfigKey = ''

export const getSupabaseClient = (): SupabaseClient | null => {
  const config = getSupabaseConfig()
  if (!config.isValid) {
    cachedClient = null
    return null
  }

  const currentKey = `${config.url}_${config.anonKey}`
  if (!cachedClient || lastConfigKey !== currentKey) {
    try {
      cachedClient = createClient(config.url, config.anonKey)
      lastConfigKey = currentKey
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e)
      cachedClient = null
    }
  }

  return cachedClient
}

export const isSupabaseConfigured = (): boolean => {
  return getSupabaseConfig().isValid
}

export const setSupabaseConfig = (url: string, anonKey: string): boolean => {
  if (typeof window === 'undefined') return false
  const cleanUrl = url.trim()
  const cleanKey = anonKey.trim()

  if (!cleanUrl.startsWith('https://') || cleanKey.length < 20) {
    return false
  }

  localStorage.setItem('vcl_supabase_url', cleanUrl)
  localStorage.setItem('vcl_supabase_anon_key', cleanKey)
  lastConfigKey = ''
  cachedClient = null
  return true
}

export const clearSupabaseConfig = (): void => {
  if (typeof window === 'undefined') return
  localStorage.removeItem('vcl_supabase_url')
  localStorage.removeItem('vcl_supabase_anon_key')
  lastConfigKey = ''
  cachedClient = null
}

// Default export getter
export const supabase = getSupabaseClient()
