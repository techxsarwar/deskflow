import {
  LayoutDashboard,
  Monitor,
  HelpCircle,
  Bell,
  Palette,
  Settings,
  Wrench,
  UserCog,
  Command,
  GraduationCap,
  IndianRupee,
  Armchair,
  Share2,
  Building2,
  Megaphone,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Admin Manager',
    email: 'admin@verticalclasseslibrary.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Vertical Classes Library',
      logo: Building2,
      plan: 'Library & Study Space Manager',
    },
    {
      name: 'Branch 2 - City Center',
      logo: Command,
      plan: 'Branch Lounge',
    },
  ],
  navGroups: [
    {
      title: 'Study Lounge',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Students Records',
          url: '/students',
          icon: GraduationCap,
        },
        {
          title: 'Fee Management',
          url: '/fees',
          icon: IndianRupee,
        },
        {
          title: 'Fee Dues & Reminders',
          url: '/dues',
          icon: Megaphone,
        },
        {
          title: 'Desks & Occupancy',
          url: '/seats',
          icon: Armchair,
        },
        {
          title: 'Student Admission Link',
          url: '/join',
          icon: Share2,
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          title: 'Settings',
          icon: Settings,
          items: [
            {
              title: 'Profile',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: 'Account',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: 'Appearance',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: 'Display',
              url: '/settings/display',
              icon: Monitor,
            },
          ],
        },
        {
          title: 'Help Center',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
