import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { DefaultersManagement } from './components/defaulters-management'

export function StudyLoungeDefaulters() {
  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>Fee Dues & Community Reminders</h2>
          <p className='text-muted-foreground'>
            Track students with pending balances, send 1-on-1 payment reminders, or broadcast the due list to your WhatsApp Community.
          </p>
        </div>

        <DefaultersManagement />
      </Main>
    </>
  )
}
