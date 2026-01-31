'use client';

import { useAuthStore } from '@/store/authStore';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import Link from 'next/link';
import {
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  if (!user) return null;

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'department':
      return <DepartmentDashboard />;
    default:
      return <CitizenDashboard />;
  }
}

function CitizenDashboard() {
  const user = useAuthStore((state) => state.user);

  const { data: complaintsData, isLoading } = useQuery({
    queryKey: ['my-complaints'],
    queryFn: () => apiClient.get<{ data: any[]; pagination: { total: number } }>('/complaints?limit=5'),
  });

  const complaints = complaintsData?.data || [];
  const total = complaintsData?.pagination?.total || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Welcome, {user?.full_name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-sm text-slate-500">Track your complaints and their status</p>
        </div>
        <Link href="/dashboard/complaints/new" className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          New Complaint
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Total Submitted</p>
          <p className="text-2xl font-semibold text-slate-900">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">In Progress</p>
          <p className="text-2xl font-semibold text-slate-900">
            {complaints.filter((c: any) => c.status === 'in_progress').length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Resolved</p>
          <p className="text-2xl font-semibold text-slate-900">
            {complaints.filter((c: any) => c.status === 'resolved').length}
          </p>
        </div>
      </div>

      {/* Recent Complaints */}
      <div className="card">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Recent Complaints</h2>
          <Link href="/dashboard/complaints" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            View all <ArrowRightIcon className="w-3 h-3" />
          </Link>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 rounded" />)}
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-8 text-center">
            <DocumentTextIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500 mb-3">No complaints yet</p>
            <Link href="/dashboard/complaints/new" className="btn-primary btn-sm">
              Submit your first complaint
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {complaints.map((complaint: any) => (
              <ComplaintRow key={complaint.id} complaint={complaint} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DepartmentDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['department-complaints'],
    queryFn: () => apiClient.get<{ data: any[]; pagination: { total: number } }>('/complaints?limit=5'),
  });

  const complaints = data?.data || [];
  const total = data?.pagination?.total || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Department Dashboard</h1>
        <p className="text-sm text-slate-500">Manage assigned complaints</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Assigned</p>
          <p className="text-2xl font-semibold text-slate-900">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">In Progress</p>
          <p className="text-2xl font-semibold text-slate-900">
            {complaints.filter((c: any) => c.status === 'in_progress').length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Resolved</p>
          <p className="text-2xl font-semibold text-slate-900">
            {complaints.filter((c: any) => c.status === 'resolved').length}
          </p>
        </div>
        <div className="card p-4 relative">
          <p className="text-xs font-medium text-slate-500 mb-1">SLA At Risk</p>
          <p className="text-2xl font-semibold text-warning-600">3</p>
        </div>
      </div>

      {/* SLA Warning */}
      <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 flex items-center gap-3">
        <ExclamationTriangleIcon className="w-5 h-5 text-warning-600" />
        <p className="text-sm text-warning-800 flex-1">3 complaints approaching SLA deadline</p>
        <Link href="/dashboard/sla" className="btn-secondary btn-sm">View</Link>
      </div>

      {/* Recent */}
      <div className="card">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Assigned Complaints</h2>
          <Link href="/dashboard/complaints" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            View all <ArrowRightIcon className="w-3 h-3" />
          </Link>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 rounded" />)}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {complaints.map((complaint: any) => (
              <ComplaintRow key={complaint.id} complaint={complaint} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => apiClient.get<{ data: any }>('/analytics/dashboard'),
  });

  const { data: complaintsData } = useQuery({
    queryKey: ['all-complaints'],
    queryFn: () => apiClient.get<{ data: any[] }>('/complaints?limit=5'),
  });

  const stats = data?.data || {};
  const complaints = complaintsData?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Admin Dashboard</h1>
        <p className="text-sm text-slate-500">System-wide overview and management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="card p-4">
              <div className="skeleton h-4 w-20 mb-2" />
              <div className="skeleton h-8 w-12" />
            </div>
          ))
        ) : (
          <>
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500 mb-1">Total</p>
              <p className="text-2xl font-semibold text-slate-900">{stats.total_complaints || 0}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500 mb-1">Pending Review</p>
              <p className="text-2xl font-semibold text-slate-900">{stats.pending_review || 0}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500 mb-1">In Progress</p>
              <p className="text-2xl font-semibold text-slate-900">{stats.in_progress || 0}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500 mb-1">Resolved</p>
              <p className="text-2xl font-semibold text-slate-900">{stats.resolved || 0}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-medium text-slate-500 mb-1">SLA Breached</p>
              <p className="text-2xl font-semibold text-danger-600">{stats.sla_breached || 0}</p>
            </div>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/dashboard/review" className="card p-4 hover:bg-slate-50 transition-colors">
          <ClockIcon className="w-5 h-5 text-warning-600 mb-2" />
          <p className="text-sm font-medium text-slate-900">Review Queue</p>
          <p className="text-xs text-slate-500">AI classifications to review</p>
        </Link>
        <Link href="/dashboard/sla" className="card p-4 hover:bg-slate-50 transition-colors">
          <ExclamationTriangleIcon className="w-5 h-5 text-danger-600 mb-2" />
          <p className="text-sm font-medium text-slate-900">SLA Monitor</p>
          <p className="text-xs text-slate-500">Track deadlines</p>
        </Link>
        <Link href="/dashboard/analytics" className="card p-4 hover:bg-slate-50 transition-colors">
          <CheckCircleIcon className="w-5 h-5 text-primary-600 mb-2" />
          <p className="text-sm font-medium text-slate-900">Analytics</p>
          <p className="text-xs text-slate-500">Reports & insights</p>
        </Link>
        <Link href="/dashboard/complaints" className="card p-4 hover:bg-slate-50 transition-colors">
          <DocumentTextIcon className="w-5 h-5 text-slate-600 mb-2" />
          <p className="text-sm font-medium text-slate-900">All Complaints</p>
          <p className="text-xs text-slate-500">Manage all</p>
        </Link>
      </div>

      {/* Recent */}
      <div className="card">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
          <Link href="/dashboard/complaints" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            View all <ArrowRightIcon className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {complaints.map((complaint: any) => (
            <ComplaintRow key={complaint.id} complaint={complaint} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ComplaintRow({ complaint }: { complaint: any }) {
  const statusClass = (status: string) => {
    const map: Record<string, string> = {
      resolved: 'bg-success-50 text-success-700',
      in_progress: 'bg-primary-50 text-primary-700',
      pending_review: 'bg-warning-50 text-warning-700',
      escalated: 'bg-danger-50 text-danger-700',
    };
    return map[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <Link
      href={`/dashboard/complaints/${complaint.id}`}
      className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-900 font-medium truncate">
          {complaint.title || complaint.description}
        </p>
        <p className="text-xs text-slate-500">
          {new Date(complaint.created_at).toLocaleDateString()}
        </p>
      </div>
      <span className={clsx('badge text-xs ml-3', statusClass(complaint.status))}>
        {complaint.status.replace(/_/g, ' ')}
      </span>
    </Link>
  );
}
