'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  HomeIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  Bars3Icon,
  XMarkIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  const navigation = getNavigationForRole(user.role);
  const currentPage = navigation.find((n) => pathname?.startsWith(n.href));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 transform transition-transform duration-200 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-slate-100">
            <Link href="/dashboard" className="flex items-center gap-2">
              <ShieldCheckIcon className="w-6 h-6 text-primary-600" />
              <span className="text-base font-semibold text-slate-900">CivicVoice</span>
            </Link>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded text-slate-400 hover:bg-slate-100"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action */}
          {user.role === 'citizen' && (
            <div className="px-3 pt-4 pb-2">
              <Link 
                href="/dashboard/complaints/new" 
                className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-primary-700 text-white rounded-md text-sm font-medium hover:bg-primary-800 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                New Complaint
              </Link>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide px-3 mb-2">
              Menu
            </p>
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/dashboard' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <item.icon className={clsx(
                    'w-5 h-5',
                    isActive ? 'text-primary-600' : 'text-slate-400'
                  )} />
                  {item.name}
                  {item.badge && (
                    <span className="ml-auto bg-danger-100 text-danger-700 text-xs font-medium px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-slate-100 p-3">
            <div className="flex items-center gap-3 p-2 rounded-md bg-slate-50 mb-2">
              <div className="avatar avatar-sm">
                <span className="avatar-text">
                  {user.full_name?.split(' ').map(n => n[0]).join('') || user.email[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {user.full_name || 'User'}
                </p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between h-14 px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md text-slate-400 hover:bg-slate-100"
              >
                <Bars3Icon className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">
                  {currentPage?.name || 'Dashboard'}
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-md text-slate-400 cursor-pointer hover:bg-slate-200 transition-colors">
                <MagnifyingGlassIcon className="w-4 h-4" />
                <span className="text-sm">Search...</span>
                <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-xs text-slate-500 bg-white rounded border border-slate-200">
                  ⌘K
                </kbd>
              </div>
              
              {/* Notifications */}
              <Link 
                href="/dashboard/notifications"
                className="relative p-2 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <BellIcon className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full" />
              </Link>
              
              {/* Settings */}
              <Link 
                href="/dashboard/settings" 
                className="p-2 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <Cog6ToothIcon className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  badge?: number;
}

function getNavigationForRole(role: string): NavItem[] {
  const citizenNav: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, description: 'Overview of your activity' },
    { name: 'My Complaints', href: '/dashboard/complaints', icon: DocumentTextIcon, description: 'View and manage complaints' },
    { name: 'Notifications', href: '/dashboard/notifications', icon: BellIcon, description: 'Recent updates' },
  ];

  const departmentNav: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, description: 'Department overview' },
    { name: 'Assigned Complaints', href: '/dashboard/complaints', icon: DocumentTextIcon, description: 'Complaints to resolve' },
    { name: 'SLA Tracker', href: '/dashboard/sla', icon: ExclamationTriangleIcon, description: 'Monitor deadlines' },
    { name: 'Notifications', href: '/dashboard/notifications', icon: BellIcon },
  ];

  const adminNav: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, description: 'System overview' },
    { name: 'All Complaints', href: '/dashboard/complaints', icon: DocumentTextIcon, description: 'Manage all complaints' },
    { name: 'Review Queue', href: '/dashboard/review', icon: ClipboardDocumentListIcon, description: 'AI classifications to review', badge: 5 },
    { name: 'Analytics', href: '/dashboard/analytics', icon: ChartBarIcon, description: 'Reports & insights' },
    { name: 'SLA Monitor', href: '/dashboard/sla', icon: ExclamationTriangleIcon, description: 'Track SLA breaches' },
    { name: 'Notifications', href: '/dashboard/notifications', icon: BellIcon },
  ];

  switch (role) {
    case 'admin':
      return adminNav;
    case 'department':
      return departmentNav;
    default:
      return citizenNav;
  }
}
