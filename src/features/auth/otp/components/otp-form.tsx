import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'

const formSchema = z.object({
  token: z
    .string()
    .min(4, 'Please enter the verification code.')
    .max(6, 'Code must not exceed 6 characters.'),
})

type OtpFormProps = React.HTMLAttributes<HTMLFormElement>

export function OtpForm({ className, ...props }: OtpFormProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const { auth } = useAuthStore()

  const email = typeof window !== 'undefined' ? sessionStorage.getItem('pending_auth_email') : null
  const phone = typeof window !== 'undefined' ? sessionStorage.getItem('pending_auth_phone') : null

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { token: '' },
  })

  const tokenValue = form.watch('token')

  async function fetchWithFallback(endpoint: string, options: RequestInit): Promise<Response> {
    const configuredApi = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    const candidates: string[] = []

    // 1. Same-origin relative path (preferred on Vercel deployment)
    candidates.push(endpoint)

    // 2. Explicitly configured backend URL or production Render host
    if (configuredApi) {
      candidates.push(`${configuredApi}${endpoint}`)
    }
    if (!candidates.includes(`https://deskflow-fyp9.onrender.com${endpoint}`)) {
      candidates.push(`https://deskflow-fyp9.onrender.com${endpoint}`)
    }

    // 3. Local development ports
    if (import.meta.env.DEV) {
      candidates.push(`http://localhost:8080${endpoint}`, `http://localhost:5001${endpoint}`)
    }

    let lastError: unknown = null
    for (const url of candidates) {
      try {
        const res = await fetch(url, options)
        return res
      } catch (err: unknown) {
        lastError = err
      }
    }
    throw (lastError instanceof Error ? lastError : new Error('Network connection failed. Unable to reach authentication server.'))
  }

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    try {
      if (email) {
        // 1. Primary: Verify 6-digit Email OTP via Resend backend
        const res = await fetchWithFallback('/api/auth/verify-email-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            code: data.token.trim(),
          }),
        })
        const result = await res.json()

        if (!res.ok) {
          throw new Error(result.error || 'Invalid verification code')
        }

        // Set authenticated admin session
        const user = {
          accountNo: result.user?.accountNo || 'ADM-PRIMARY',
          name: result.user?.name || sessionStorage.getItem('pending_admin_name') || 'Lead Administrator',
          email: result.user?.email || email,
          role: result.user?.role || ['admin', 'superadmin'],
          exp: Date.now() + 24 * 60 * 60 * 1000,
        }

        auth.setUser(user)
        auth.setAccessToken(result.token || 'deskflow-admin-session-token')
        sessionStorage.removeItem('pending_auth_email')
        sessionStorage.removeItem('pending_admin_name')

        toast.success(`🎉 Welcome, ${user.name}!`, {
          description: 'Access granted to DeskFlow Library Operating System.',
        })

        navigate({ to: '/' })
      } else if (phone) {
        // Fallback for phone
        const res = await fetchWithFallback('/api/auth/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            token: data.token.toUpperCase().trim(),
          }),
        })
        const result = await res.json()

        if (!res.ok) {
          throw new Error(result.error || 'Invalid token')
        }

        const user = {
          accountNo: result.user?.accountNo || 'ADM-001',
          name: result.user?.name || sessionStorage.getItem('pending_admin_name') || 'Lead Administrator',
          email: result.user?.email || `+91 ${phone}`,
          role: result.user?.role || ['admin'],
          exp: Date.now() + 24 * 60 * 60 * 1000,
        }

        auth.setUser(user)
        auth.setAccessToken(result.token || 'deskflow-admin-session-token')
        sessionStorage.removeItem('pending_auth_phone')

        toast.success(`🎉 Welcome, ${user.name}!`)
        navigate({ to: '/' })
      } else {
        // Direct local entry fallback
        navigate({ to: '/sign-in' })
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Please check your code in your email and try again.'
      toast.error('Verification Failed', {
        description: errorMsg,
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    setIsResending(true)
    try {
      if (email) {
        const res = await fetchWithFallback('/api/auth/send-email-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        toast.success('Fresh 6-digit verification code sent to your email!')
      } else if (phone) {
        const res = await fetchWithFallback('/api/auth/send-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        toast.success('Fresh verification code sent!')
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Resend request failed'
      toast.error('Resend failed', { description: errorMsg })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='token'
          render={({ field }) => (
            <FormItem className='flex flex-col items-center gap-2'>
              <FormLabel className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                Enter 6-Digit Verification Code
              </FormLabel>
              <FormControl>
                <InputOTP
                  maxLength={6}
                  value={field.value}
                  onChange={(val) => field.onChange(val.toUpperCase())}
                  pattern='^[a-zA-Z0-9]+$'
                  containerClassName='justify-center gap-2 sm:[&>[data-slot="input-otp-group"]>div]:w-11 sm:[&>[data-slot="input-otp-group"]>div]:h-12 sm:[&>[data-slot="input-otp-group"]>div]:text-xl font-mono font-bold'
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type='submit'
          className='w-full mt-2 font-semibold h-11 text-sm'
          disabled={tokenValue.length < 4 || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Verifying Code...
            </>
          ) : (
            <>
              <ShieldCheck className='mr-2 h-4 w-4' />
              Verify & Enter Dashboard
            </>
          )}
        </Button>

        <div className='flex items-center justify-center pt-1'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='text-xs text-muted-foreground hover:text-foreground'
            onClick={handleResend}
            disabled={isResending || isLoading}
          >
            {isResending ? (
              <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
            ) : (
              <RefreshCw className='mr-1.5 h-3.5 w-3.5' />
            )}
            Resend Code to Email
          </Button>
        </div>
      </form>
    </Form>
  )
}
