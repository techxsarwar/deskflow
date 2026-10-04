import { Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { OtpForm } from './components/otp-form'

export function Otp() {
  const phone = typeof window !== 'undefined' ? sessionStorage.getItem('pending_auth_phone') : null
  const adminName = typeof window !== 'undefined' ? sessionStorage.getItem('pending_admin_name') : null
  const displayTarget = phone ? `+91 ${phone}` : 'your registered Admin mobile'

  return (
    <AuthLayout>
      <Card className='max-w-md gap-4'>
        <CardHeader>
          <CardTitle className='text-base tracking-tight flex items-center justify-between'>
            <span>Admin Token Verification</span>
            <span className='rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-500/20'>
              Telegram 4-Digit Token
            </span>
          </CardTitle>
          <CardDescription>
            {adminName ? <span>Welcome, <b>{adminName}</b>. </span> : null}
            Enter the 4-character token (letters & numbers) sent to your Telegram Bot{' '}
            <a
              href='https://t.me/controllibrarybot'
              target='_blank'
              rel='noreferrer'
              className='font-medium text-primary underline underline-offset-4'
            >
              @controllibrarybot
            </a>{' '}
            for <b className='text-foreground'>{displayTarget}</b>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OtpForm />
        </CardContent>
        <CardFooter>
          <p className='px-8 text-center text-sm text-muted-foreground'>
            Haven't received the Telegram alert?{' '}
            <Link
              to='/sign-in'
              className='underline underline-offset-4 hover:text-primary'
            >
              Resend code or restart sign in
            </Link>
            .
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
