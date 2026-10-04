import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import {
  Phone,
  ShieldCheck,
  AlertCircle,
  Loader2,
  LogIn,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
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

// 1. Phone Auth Schema
const phoneFormSchema = z.object({
  phone: z
    .string()
    .min(10, 'Please enter a valid 10-digit mobile number.')
    .max(13, 'Phone number is too long.'),
})

// 2. Fallback Email Schema
const emailFormSchema = z.object({
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

  // Phone Form
  const phoneForm = useForm<z.infer<typeof phoneFormSchema>>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: {
      phone: '',
    },
  })

  // Email Form
  const emailForm = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  // Handle Phone Submit -> Generate 4-digit token to Telegram
  async function onPhoneSubmit(data: z.infer<typeof phoneFormSchema>) {
    setIsLoading(true)
    setDeniedError(null)

    // Clean phone number
    let cleanPhone = data.phone.replace(/[^0-9]/g, '')
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.substring(2)
    }

    try {
      const apiUrl = 'http://localhost:5001/api/auth/send-token'
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      })

      const resData = await res.json()

      if (!res.ok) {
        if (res.status === 403) {
          const errMsg =
            '🚫 Access Denied: This mobile number is not registered as an authorized Admin. Only linked Telegram administrators can log in.'
          setDeniedError(errMsg)
          toast.error('Admin Access Denied', {
            description: 'Unauthorized phone number. Telegram ID binding required.',
          })
          return
        }
        throw new Error(resData.error || 'Failed to generate token')
      }

      // Success: Save pending phone & navigate to OTP verification screen
      sessionStorage.setItem('pending_auth_phone', cleanPhone)
      if (resData.adminName) {
        sessionStorage.setItem('pending_admin_name', resData.adminName)
      }

      toast.success('🔐 4-Digit Security Token Sent!', {
        description: 'Check @controllibrarybot on Telegram for your access code.',
        duration: 5000,
      })

      navigate({ to: '/otp' })
    } catch (err: any) {
      console.error('Phone login error:', err)
      toast.error('Token Generation Failed', {
        description: err.message || 'Please check your connection and try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Email Submit (Legacy fallback)
  async function onEmailSubmit(data: z.infer<typeof emailFormSchema>) {
    setIsLoading(true)
    setDeniedError(null)

    try {
      sessionStorage.setItem('pending_auth_email', data.email)
      try {
        await fetch('http://localhost:5001/api/auth/send-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email }),
        })
      } catch (e) {}

      toast.success('🔐 Verification code sent to Telegram!')
      navigate({ to: '/otp' })
    } catch (error: any) {
      toast.error('Login failed', { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('grid gap-4', className)} {...props}>
      <Tabs defaultValue='phone' className='w-full'>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='phone' className='flex items-center gap-1.5 font-semibold text-xs sm:text-sm'>
            <Phone className='h-3.5 w-3.5' /> Admin Phone
          </TabsTrigger>
          <TabsTrigger value='email' className='flex items-center gap-1.5 font-semibold text-xs sm:text-sm'>
            <LogIn className='h-3.5 w-3.5' /> Email / Password
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PHONE TOKEN LOGIN (PRIMARY) */}
        <TabsContent value='phone' className='mt-3 space-y-3'>
          <div className='rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5'>
            <ShieldCheck className='h-4 w-4 shrink-0 mt-0.5 text-emerald-600' />
            <div>
              <p className='font-bold'>Zero Password • 4-Digit Telegram Token</p>
              <p className='text-muted-foreground mt-0.5'>
                Enter your registered admin phone number. A 4-character token will arrive on your bot (<b>@controllibrarybot</b>).
              </p>
            </div>
          </div>

          {deniedError && (
            <div className='rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2'>
              <AlertCircle className='h-4 w-4 shrink-0 mt-0.5' />
              <span>{deniedError}</span>
            </div>
          )}

          <Form {...phoneForm}>
            <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className='grid gap-3'>
              <FormField
                control={phoneForm.control}
                name='phone'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Mobile Number</FormLabel>
                    <FormControl>
                      <div className='relative flex items-center'>
                        <span className='absolute left-3 text-xs font-bold text-muted-foreground select-none'>
                          🇮🇳 +91
                        </span>
                        <Input
                          placeholder='9149847965'
                          className='pl-14 text-sm font-mono tracking-wider'
                          maxLength={10}
                          {...field}
                          onChange={(e) => {
                            setDeniedError(null)
                            field.onChange(e.target.value.replace(/[^0-9]/g, ''))
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
                    Verifying Admin Identity...
                  </>
                ) : (
                  <>
                    <Send className='mr-2 h-4 w-4' />
                    Generate Admin Token
                  </>
                )}
              </Button>
            </form>
          </Form>

          <p className='text-[11px] text-center text-muted-foreground'>
            Unregistered numbers are automatically blocked to prevent unauthorized access.
          </p>
        </TabsContent>

        {/* TAB 2: EMAIL LOGIN (FALLBACK) */}
        <TabsContent value='email' className='mt-3 space-y-3'>
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className='grid gap-3'>
              <FormField
                control={emailForm.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder='admin@deskflow.com' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={emailForm.control}
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
                Sign in with Email
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  )
}
