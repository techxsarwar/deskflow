import { createFileRoute } from '@tanstack/react-router'
import { PublicStudentRegistration } from '@/features/public-registration'

export const Route = createFileRoute('/register-student')({
  component: PublicStudentRegistration,
})
