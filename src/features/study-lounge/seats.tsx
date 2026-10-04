import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { SeatsLayoutView } from './components/seats-layout-view'

export function StudyLoungeSeats() {
  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>Desk Layout & Occupancy</h2>
          <p className='text-muted-foreground'>
            Interactive floor plan and real-time private desk availability organized by halls.
          </p>
        </div>

        <SeatsLayoutView />
      </Main>
    </>
  )
}
