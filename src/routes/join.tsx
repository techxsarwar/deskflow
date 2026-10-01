import { createFileRoute } from '@tanstack/react-router'
import { PublicStudentRegistration } from '@/features/public-registration'

export const Route = createFileRoute('/join')({
  component: PublicStudentRegistration,
})
