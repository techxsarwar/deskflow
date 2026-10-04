import { createFileRoute } from '@tanstack/react-router'
import { LegalHub } from '@/features/legal/legal-hub'

export const Route = createFileRoute('/legal')({
  component: () => <LegalHub defaultTab='terms' />,
})
