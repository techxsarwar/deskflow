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
  const email = typeof window !== 'undefined' ? sessionStorage.getItem('pending_auth_email') : null
  const adminName = typeof window !== 'undefined' ? sessionStorage.getItem('pending_admin_name') : null
  const displayTarget = email ? email : 'your registered Admin email'

  return (
    <AuthLayout>
      <Card className='max-w-md gap-4'>
        <CardHeader>
          <CardTitle className='text-base tracking-tight flex items-center justify-between'>
            <span>Admin Code Verification</span>
            <span className='rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20'>
              Email 6-Digit Code
            </span>
          </CardTitle>
          <CardDescription>
            {adminName ? <span>Welcome, <b>{adminName}</b>. </span> : null}
            Enter the 6-digit verification code sent to your inbox for{' '}
            <b className='text-foreground'>{displayTarget}</b>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OtpForm />
        </CardContent>
        <CardFooter>
          <p className='px-8 text-center text-sm text-muted-foreground'>
            Didn&apos;t receive the email code?{' '}
            <Link
              to='/sign-in'
              className='underline underline-offset-4 hover:text-primary font-medium'
            >
              Request a new code or switch email
            </Link>
            .
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
