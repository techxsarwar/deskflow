import { createFileRoute } from '@tanstack/react-router'
import { StudyLoungeSeats } from '@/features/study-lounge/seats'

export const Route = createFileRoute('/_authenticated/seats/')({
  component: StudyLoungeSeats,
})
