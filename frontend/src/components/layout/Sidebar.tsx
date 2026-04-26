'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  DocumentTextIcon,
  UserCircleIcon,
  MagnifyingGlassIcon,
  BriefcaseIcon,
  BookmarkIcon,
} from '@heroicons/react/24/outline';

interface SidebarProps {
  isOpen: boolean;
  userRole: 'candidate' | 'hr';
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  role: 'candidate' | 'hr' | 'both';
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard/candidate', icon: HomeIcon, role: 'candidate' },
  { name: 'My Resume', href: '/dashboard/candidate/resume', icon: DocumentTextIcon, role: 'candidate' },
  { name: 'My Jobs', href: '/dashboard/candidate/jobs', icon: BriefcaseIcon, role: 'candidate' },
  { name: 'Profile', href: '/dashboard/profile', icon: UserCircleIcon, role: 'candidate' },
  
  { name: 'Dashboard', href: '/dashboard/hr', icon: HomeIcon, role: 'hr' },
  { name: 'Search Candidates', href: '/dashboard/hr/search', icon: MagnifyingGlassIcon, role: 'hr' },
  { name: 'Job Postings', href: '/dashboard/hr/jobs', icon: BriefcaseIcon, role: 'hr' },
  { name: 'Saved Candidates', href: '/dashboard/hr/saved', icon: BookmarkIcon, role: 'hr' },
  { name: 'Profile', href: '/dashboard/profile', icon: UserCircleIcon, role: 'hr' },
];

export default function Sidebar({ isOpen, userRole }: SidebarProps) {
  const pathname = usePathname();

  const filteredNavItems = navItems.filter(
    (item) => item.role === userRole || item.role === 'both'
  );

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => {}}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-56 bg-white dark:bg-gray-900 border-r border-gray-300 dark:border-gray-700
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-14 flex items-center px-4 border-b border-gray-300 dark:border-gray-700">
          <h1 className="text-xl font-semibold text-purple-700 dark:text-purple-500">Resume RAG</h1>
        </div>

        <nav className="py-2">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center space-x-3 px-4 py-2.5 mx-2 rounded
                  transition-colors duration-150 text-sm font-medium
                  ${
                    active
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-2 right-2">
          <div className="bg-gray-100 dark:bg-gray-800 rounded px-3 py-2 text-center border border-gray-300 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Role</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{userRole}</p>
          </div>
        </div>
      </aside>
    </>
  );
}
