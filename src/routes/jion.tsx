import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/jion')({
  beforeLoad: () => {
    throw redirect({ to: '/join' })
  },
})
