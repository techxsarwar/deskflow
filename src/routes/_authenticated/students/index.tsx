import { createFileRoute } from '@tanstack/react-router'
import { StudyLoungeStudents } from '@/features/study-lounge'

export const Route = createFileRoute('/_authenticated/students/')({
  component: StudyLoungeStudents,
})
