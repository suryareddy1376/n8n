'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/lib/api';
import { Complaint, ComplaintStatus, UrgencyLevel } from '@/types';
import Link from 'next/link';
import clsx from 'clsx';
import {
  FunnelIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  XMarkIcon,
  ClockIcon,
  MapPinIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const statusConfig: Record<ComplaintStatus, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' }> = {
  submitted: { label: 'Submitted', variant: 'default' },
  pending_review: { label: 'Pending Review', variant: 'warning' },
  approved: { label: 'Approved', variant: 'primary' },
  assigned: { label: 'Assigned', variant: 'primary' },
  in_progress: { label: 'In Progress', variant: 'primary' },
  resolved: { label: 'Resolved', variant: 'success' },
  closed: { label: 'Closed', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'danger' },
  escalated: { label: 'Escalated', variant: 'danger' },
};

const urgencyConfig: Record<UrgencyLevel, { label: string; variant: 'default' | 'warning' | 'danger' }> = {
  normal: { label: 'Normal', variant: 'default' },
  high: { label: 'High', variant: 'warning' },
  critical: { label: 'Critical', variant: 'danger' },
};

export default function ComplaintsListPage() {
  const user = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    urgency: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: '10',
    ...(filters.status && { status: filters.status }),
    ...(filters.urgency && { urgency: filters.urgency }),
    ...(filters.search && { search: filters.search }),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['complaints', page, filters],
    queryFn: () =>
      apiClient.get<{
        data: Complaint[];
        pagination: { total: number; page: number; limit: number; total_pages: number };
      }>(`/complaints?${queryParams}`),
  });

  const complaints = data?.data || [];
  const pagination = data?.pagination;
  const activeFilters = [filters.status, filters.urgency].filter(Boolean).length;

  const clearFilters = () => {
    setFilters({ status: '', urgency: '', search: '' });
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            {user?.role === 'citizen' ? 'My Complaints' : 'All Complaints'}
          </h1>
          <p className="text-sm text-slate-500">
            {pagination?.total || 0} total complaints
          </p>
        </div>
        {user?.role === 'citizen' && (
          <Link href="/dashboard/complaints/new" className="btn-primary">
            <PlusIcon className="w-4 h-4" />
            New Complaint
          </Link>
        )}
      </div>

      {/* Search and Filters */}
      <div className="card p-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search complaints..."
              value={filters.search}
              onChange={(e) => {
                setFilters({ ...filters, search: e.target.value });
                setPage(1);
              }}
              className="input pl-9"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'btn-secondary relative',
              showFilters && 'bg-slate-100'
            )}
          >
            <FunnelIcon className="w-4 h-4" />
            Filters
            {activeFilters > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-700">Filter by</span>
              {activeFilters > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <XMarkIcon className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <select
                value={filters.status}
                onChange={(e) => {
                  setFilters({ ...filters, status: e.target.value });
                  setPage(1);
                }}
                className="input"
              >
                <option value="">All Statuses</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
                <option value="rejected">Rejected</option>
                <option value="escalated">Escalated</option>
              </select>
              <select
                value={filters.urgency}
                onChange={(e) => {
                  setFilters({ ...filters, urgency: e.target.value });
                  setPage(1);
                }}
                className="input"
              >
                <option value="">All Urgencies</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Complaints List */}
      <div className="card">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-16 rounded" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <ExclamationTriangleIcon className="w-8 h-8 text-danger-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-900">Failed to load complaints</p>
            <p className="text-sm text-slate-500">Please try again later</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="empty-state">
            <DocumentTextIcon className="empty-state-icon" />
            <h3 className="empty-state-title">No complaints found</h3>
            <p className="empty-state-description">
              {activeFilters > 0
                ? 'Try adjusting your filters'
                : user?.role === 'citizen'
                ? 'Submit your first complaint to get started'
                : 'No complaints have been submitted yet'}
            </p>
            {user?.role === 'citizen' && !activeFilters && (
              <Link href="/dashboard/complaints/new" className="btn-primary mt-4">
                <PlusIcon className="w-4 h-4" />
                Submit Complaint
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {complaints.map((complaint) => (
              <ComplaintRow key={complaint.id} complaint={complaint} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * pagination.limit + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="btn-secondary btn-icon disabled:opacity-50"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(pagination.total_pages, 5) }, (_, i) => {
              let pageNum: number;
              if (pagination.total_pages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= pagination.total_pages - 2) {
                pageNum = pagination.total_pages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={clsx(
                    'w-8 h-8 rounded-md text-sm font-medium transition-colors',
                    page === pageNum
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === pagination.total_pages}
              className="btn-secondary btn-icon disabled:opacity-50"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ComplaintRow({ complaint }: { complaint: Complaint }) {
  const status = statusConfig[complaint.status];
  const urgency = urgencyConfig[complaint.urgency] || urgencyConfig.normal;
  const isOverdue = complaint.sla_deadline && new Date(complaint.sla_deadline) < new Date();

  const badgeClass = (variant: string) => {
    const classes: Record<string, string> = {
      default: 'text-slate-700 bg-slate-100',
      primary: 'text-primary-700 bg-primary-50',
      success: 'text-success-700 bg-success-50',
      warning: 'text-warning-700 bg-warning-50',
      danger: 'text-danger-700 bg-danger-50',
    };
    return classes[variant] || classes.default;
  };

  return (
    <Link
      href={`/dashboard/complaints/${complaint.id}`}
      className="block px-4 py-3 hover:bg-slate-50 transition-colors"
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-400">
              #{complaint.id.slice(0, 8)}
            </span>
            {complaint.is_critical_area && (
              <span className="badge badge-danger text-xs">CRITICAL AREA</span>
            )}
            {isOverdue && (
              <span className="badge badge-danger text-xs flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                SLA BREACHED
              </span>
            )}
          </div>
          <p className="text-sm text-slate-900 font-medium truncate">
            {complaint.title || complaint.description}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
            {complaint.category && (
              <span className="inline-flex items-center gap-1">
                <DocumentTextIcon className="w-3 h-3" />
                {complaint.category.replace(/_/g, ' ')}
              </span>
            )}
            {(complaint.location_address || complaint.location) && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="w-3 h-3" />
                {complaint.location_address || complaint.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" />
              {new Date(complaint.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={clsx('badge text-xs', badgeClass(status.variant))}>
            {status.label}
          </span>
          <span className={clsx('badge text-xs', badgeClass(urgency.variant))}>
            {urgency.label}
          </span>
        </div>
      </div>
    </Link>
  );
}
