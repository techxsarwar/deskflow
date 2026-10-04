import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { SignIn } from '@/features/auth/sign-in'
import { checkIsAuthenticated } from '@/stores/auth-store'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  beforeLoad: ({ search }) => {
    if (checkIsAuthenticated()) {
      throw redirect({ to: search.redirect || '/' })
    }
  },
  component: SignIn,
  validateSearch: searchSchema,
})
