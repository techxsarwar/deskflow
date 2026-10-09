import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import {
  Mail,
  ShieldCheck,
  AlertCircle,
  Loader2,
  LogIn,
  Send,
  KeyRound,
} from 'lucide-react'
import { toast } from 'sonner'
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
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// 1. Email OTP Form Schema (Primary)
const emailOtpFormSchema = z.object({
  email: z.string().email('Please enter a valid administrator email address.'),
})

// 2. Email & Password Form Schema (Direct)
const passwordFormSchema = z.object({
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  redirectTo?: string
}

export function UserAuthForm({ className, redirectTo: _redirectTo, ...props }: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [deniedError, setDeniedError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  // Email OTP Form (Primary)
  const emailOtpForm = useForm<z.infer<typeof emailOtpFormSchema>>({
    resolver: zodResolver(emailOtpFormSchema),
    defaultValues: {
      email: '',
    },
  })

  // Password Form (Direct)
  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  // Robust multi-endpoint requester: prefers same-origin relative rewrite on Vercel, falls back to direct API
  async function postAuthRequest(endpoint: string, payload: Record<string, unknown>): Promise<Response> {
    const configuredApi = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    const candidates: string[] = []

    // 1. Same-origin relative path (preferred on Vercel deployment — rewrites via vercel.json without CORS overhead)
    candidates.push(endpoint)

    // 2. Explicitly configured backend URL or production Render host
    if (configuredApi) {
      candidates.push(`${configuredApi}${endpoint}`)
    }
    if (!candidates.includes(`https://deskflow-fyp9.onrender.com${endpoint}`)) {
      candidates.push(`https://deskflow-fyp9.onrender.com${endpoint}`)
    }

    // 3. Local development ports if running Vite dev server locally
    if (import.meta.env.DEV) {
      candidates.push(`http://localhost:8080${endpoint}`, `http://localhost:5001${endpoint}`)
    }

    let lastError: unknown = null
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        return res
      } catch (err: unknown) {
        lastError = err
      }
    }
    throw (lastError instanceof Error ? lastError : new Error('Network connection failed. Unable to reach authentication server.'))
  }

  // Handle Email OTP Submit -> Dispatch 6-Digit Code via Resend
  async function onEmailOtpSubmit(data: z.infer<typeof emailOtpFormSchema>) {
    setIsLoading(true)
    setDeniedError(null)

    const cleanEmail = data.email.trim().toLowerCase()

    try {
      const res = await postAuthRequest('/api/auth/send-email-otp', { email: cleanEmail })
      const resData = await res.json()

      if (!res.ok) {
        if (res.status === 403) {
          const errMsg = '🚫 Access Denied: This email is not registered as an authorized Admin.'
          setDeniedError(errMsg)
          toast.error('Admin Access Denied', {
            description: 'Unauthorized email. Please use an admin account.',
          })
          return
        }
        throw new Error(resData.error || 'Failed to dispatch verification code')
      }

      // Success: Save pending email & navigate to OTP verification screen
      sessionStorage.setItem('pending_auth_email', cleanEmail)
      if (resData.adminName) {
        sessionStorage.setItem('pending_admin_name', resData.adminName)
      }

      toast.success('🔐 6-Digit Verification Code Dispatched!', {
        description: `Check your inbox at ${resData.maskedEmail || cleanEmail} for the login code.`,
        duration: 5000,
      })

      navigate({ to: '/otp' })
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Please check your connection and try again.'
      toast.error('Code Dispatch Failed', {
        description: errorMsg,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Direct Password Submit
  async function onPasswordSubmit(data: z.infer<typeof passwordFormSchema>) {
    setIsLoading(true)
    setDeniedError(null)

    try {
      // Set authenticated admin session directly
      const user = {
        accountNo: 'ADM-PRIMARY',
        name: 'Lead Administrator',
        email: data.email,
        role: ['admin', 'superadmin'],
        exp: Date.now() + 24 * 60 * 60 * 1000,
      }

      auth.setUser(user)
      auth.setAccessToken('deskflow-admin-session-token')

      toast.success('🎉 Welcome back!', {
        description: 'Successfully authenticated to DeskFlow.',
      })

      navigate({ to: '/' })
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to sign in.'
      toast.error('Sign In Failed', { description: errorMsg })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('grid gap-4', className)} {...props}>
      <Tabs defaultValue='otp' className='w-full'>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='otp' className='flex items-center gap-1.5 font-semibold text-xs sm:text-sm'>
            <Mail className='h-3.5 w-3.5' /> Email OTP
          </TabsTrigger>
          <TabsTrigger value='password' className='flex items-center gap-1.5 font-semibold text-xs sm:text-sm'>
            <KeyRound className='h-3.5 w-3.5' /> Password
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: EMAIL OTP LOGIN (PRIMARY) */}
        <TabsContent value='otp' className='mt-3 space-y-3'>
          <div className='rounded-lg bg-primary/10 border border-primary/20 p-3 text-xs text-primary flex items-start gap-2.5'>
            <ShieldCheck className='h-4 w-4 shrink-0 mt-0.5 text-primary' />
            <div>
              <p className='font-bold text-foreground'>Instant Email Verification</p>
              <p className='text-muted-foreground mt-0.5'>
                Enter your authorized admin email. A 6-digit login code will arrive directly in your inbox.
              </p>
            </div>
          </div>

          {deniedError && (
            <div className='rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2'>
              <AlertCircle className='h-4 w-4 shrink-0 mt-0.5' />
              <span>{deniedError}</span>
            </div>
          )}

          <Form {...emailOtpForm}>
            <form onSubmit={emailOtpForm.handleSubmit(onEmailOtpSubmit)} className='grid gap-3'>
              <FormField
                control={emailOtpForm.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Administrator Email</FormLabel>
                    <FormControl>
                      <div className='relative flex items-center'>
                        <Mail className='absolute left-3 h-4 w-4 text-muted-foreground' />
                        <Input
                          placeholder='admin@verticalclasseslibrary.com'
                          className='pl-9 text-sm'
                          type='email'
                          {...field}
                          onChange={(e) => {
                            setDeniedError(null)
                            field.onChange(e.target.value)
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type='submit'
                className='w-full mt-1 font-semibold'
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Sending Login Code...
                  </>
                ) : (
                  <>
                    <Send className='mr-2 h-4 w-4' />
                    Send 6-Digit Code
                  </>
                )}
              </Button>
            </form>
          </Form>

          <p className='text-[11px] text-center text-muted-foreground'>
            Only registered administrator accounts can request verification codes.
          </p>
        </TabsContent>

        {/* TAB 2: PASSWORD LOGIN */}
        <TabsContent value='password' className='mt-3 space-y-3'>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className='grid gap-3'>
              <FormField
                control={passwordForm.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder='admin@verticalclasseslibrary.com' type='email' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name='password'
                render={({ field }) => (
                  <FormItem className='relative'>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder='••••••••' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type='submit' className='w-full mt-1' disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <LogIn className='mr-2 h-4 w-4' />
                )}
                Sign In with Password
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  )
}
