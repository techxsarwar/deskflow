import { createFileRoute } from '@tanstack/react-router'
import { StudyLoungeDefaulters } from '@/features/study-lounge/defaulters'

export const Route = createFileRoute('/_authenticated/dues/')({
  component: StudyLoungeDefaulters,
})
