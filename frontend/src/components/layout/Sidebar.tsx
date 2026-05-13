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
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => {}}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-64 border-r
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ 
          backgroundColor: 'var(--sidebar-bg)',
          borderColor: 'var(--border)'
        }}
      >
        <div className="h-16 flex items-center px-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <h1 className="text-xl font-bold" style={{ color: 'var(--secondary)' }}>
            Resume RAG
          </h1>
        </div>

        <nav className="py-4 px-3">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center space-x-3 px-4 py-2.5 mb-1 rounded-lg
                  transition-colors duration-150 text-sm font-medium
                `}
                style={
                  active
                    ? { 
                        backgroundColor: 'var(--accent)', 
                        color: 'var(--secondary)' 
                      }
                    : { color: 'var(--foreground)' }
                }
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'var(--accent)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-6 left-3 right-3">
          <div className="rounded-lg px-4 py-3 text-center border" style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--border)' }}>
            <p className="text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--muted)' }}>Role</p>
            <p className="text-sm font-semibold capitalize mt-1" style={{ color: 'var(--foreground)' }}>{userRole}</p>
          </div>
        </div>
      </aside>
    </>
  );
}
