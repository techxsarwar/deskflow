import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { FeesManagement } from './components/fees-management'

export function StudyLoungeFees() {
  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>Fee Management & Receipts</h2>
          <p className='text-muted-foreground'>
            Track membership fees, collect pending balances, and generate printable receipts.
          </p>
        </div>

        <FeesManagement />
      </Main>
    </>
  )
}
