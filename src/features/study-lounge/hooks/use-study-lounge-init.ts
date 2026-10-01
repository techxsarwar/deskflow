import { useEffect } from 'react'
import { useStudyLoungeStore } from '../store/study-lounge-store'
import { supabaseService } from '../lib/supabase-service'

export function useStudyLoungeInit() {
  const syncWithSupabase = useStudyLoungeStore((s) => s.syncWithSupabase)
  const initRealtimeSubscription = useStudyLoungeStore((s) => s.initRealtimeSubscription)

  useEffect(() => {
    // Only attempt initial sync if Supabase is enabled
    if (supabaseService.isEnabled()) {
      syncWithSupabase(true).catch((err) => {
        console.error('Initial Supabase sync error:', err)
      })

      const unsubscribe = initRealtimeSubscription()
      return () => {
        unsubscribe?.()
      }
    }
  }, [syncWithSupabase, initRealtimeSubscription])
}
