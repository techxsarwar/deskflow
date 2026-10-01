import { createFileRoute } from '@tanstack/react-router'
import { StudyLoungeFees } from '@/features/study-lounge/fees'

export const Route = createFileRoute('/_authenticated/fees/')({
  component: StudyLoungeFees,
})
