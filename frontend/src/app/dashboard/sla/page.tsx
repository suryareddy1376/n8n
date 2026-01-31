'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { SLAComplaint } from '@/types';
import { useAuthStore } from '@/store/authStore';
import clsx from 'clsx';
import Link from 'next/link';
import { useState } from 'react';
import {
  ClockIcon,
  ExclamationTriangleIcon,
  BellAlertIcon,
  CheckBadgeIcon,
  ArrowPathIcon,
  EyeIcon,
  ArrowUpIcon,
  ChartBarIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

type SLAFilter = 'all' | 'breached' | 'at-risk';

export default function SLAMonitorPage() {
  const user = useAuthStore((state) => state.user);
  const [filter, setFilter] = useState<SLAFilter>('all');
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sla-complaints', filter],
    queryFn: () =>
      apiClient.get<{ data: SLAComplaint[] }>(
        `/sla/monitoring${filter !== 'all' ? `?status=${filter}` : ''}`
      ),
  });

  const escalateMutation = useMutation({
    mutationFn: (complaintId: string) =>
      apiClient.post(`/complaints/${complaintId}/escalate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-complaints'] });
    },
  });

  const complaints = data?.data || [];
  const breachedCount = complaints.filter((c) => c.sla_status === 'breached').length;
  const atRiskCount = complaints.filter((c) => c.sla_status === 'at-risk').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">SLA Monitor</h1>
          <p className="text-sm text-slate-500">Track service level agreements</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowPathIcon className={clsx('w-4 h-4', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <SummaryCard
          title="SLA Breached"
          count={breachedCount}
          color="danger"
          icon={ExclamationTriangleIcon}
          description="Requires immediate attention"
        />
        <SummaryCard
          title="At Risk"
          count={atRiskCount}
          color="warning"
          icon={BellAlertIcon}
          description="Approaching deadline"
        />
        <SummaryCard
          title="On Track"
          count={complaints.length - breachedCount - atRiskCount}
          color="success"
          icon={CheckBadgeIcon}
          description="Within SLA limits"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-slate-400">
          <FunnelIcon className="h-4 w-4" />
        </div>
        {(['all', 'breached', 'at-risk'] as SLAFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-lg transition-all',
              filter === f
                ? 'bg-primary-100 text-primary-700'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {f === 'all' ? 'All Issues' : f === 'breached' ? 'Breached' : 'At Risk'}
            {f === 'breached' && breachedCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-danger-100 text-danger-700 rounded-full">{breachedCount}</span>
            )}
            {f === 'at-risk' && atRiskCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-warning-100 text-warning-700 rounded-full">{atRiskCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Complaints List */}
      <div className="card">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
        ) : complaints.length === 0 ? (
          <div className="empty-state py-8">
            <CheckBadgeIcon className="w-8 h-8 text-success-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 mb-1">All Clear</h3>
            <p className="text-sm text-slate-500">No SLA issues found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {complaints.map((complaint) => (
              <SLAComplaintRow
                key={complaint.id}
                complaint={complaint}
                onEscalate={() => escalateMutation.mutate(complaint.id)}
                isEscalating={escalateMutation.isPending}
                userRole={user?.role}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  count: number;
  color: 'danger' | 'warning' | 'success';
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

function SummaryCard({ title, count, color, icon: Icon, description }: SummaryCardProps) {
  const colorMap = {
    danger: {
      bg: 'bg-danger-50',
      iconBg: 'bg-danger-100',
      iconColor: 'text-danger-600',
      countColor: 'text-danger-600',
      border: 'border-danger-100',
    },
    warning: {
      bg: 'bg-warning-50',
      iconBg: 'bg-warning-100',
      iconColor: 'text-warning-600',
      countColor: 'text-warning-600',
      border: 'border-warning-100',
    },
    success: {
      bg: 'bg-success-50',
      iconBg: 'bg-success-100',
      iconColor: 'text-success-600',
      countColor: 'text-success-600',
      border: 'border-success-100',
    },
  };

  const colors = colorMap[color];

  return (
    <div className={clsx('rounded-lg p-4 border', colors.bg, colors.border)}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={clsx('w-5 h-5', colors.iconColor)} />
        <span className={clsx('text-2xl font-semibold', colors.countColor)}>{count}</span>
      </div>
      <h3 className="text-sm font-medium text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );
}

interface SLAComplaintRowProps {
  complaint: SLAComplaint;
  onEscalate: () => void;
  isEscalating: boolean;
  userRole?: string;
}

function SLAComplaintRow({ complaint, onEscalate, isEscalating, userRole }: SLAComplaintRowProps) {
  const hoursRemaining = complaint.hours_remaining;
  const isBreached = complaint.sla_status === 'breached';
  const isAtRisk = complaint.sla_status === 'at-risk';

  const getEscalationLevel = () => {
    if (!complaint.escalation_level) return null;
    const levels = {
      1: { label: 'Level 1', color: 'warning' },
      2: { label: 'Level 2', color: 'danger' },
      3: { label: 'Critical', color: 'danger' },
    };
    return levels[complaint.escalation_level as keyof typeof levels];
  };

  const escalation = getEscalationLevel();

  return (
    <div className="p-5 hover:bg-slate-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full',
              isBreached ? 'bg-danger-100 text-danger-700' : isAtRisk ? 'bg-warning-100 text-warning-700' : 'bg-success-100 text-success-700'
            )}>
              {isBreached && <ExclamationTriangleIcon className="h-3.5 w-3.5" />}
              {isAtRisk && <BellAlertIcon className="h-3.5 w-3.5" />}
              {isBreached ? 'SLA Breached' : isAtRisk ? 'At Risk' : 'On Track'}
            </span>
            {escalation && (
              <span className={clsx(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                escalation.color === 'warning' ? 'bg-warning-100 text-warning-700' : 'bg-danger-100 text-danger-700'
              )}>
                {escalation.label} Escalation
              </span>
            )}
          </div>
          
          <h4 className="text-base font-semibold text-slate-900 truncate mb-1">
            {complaint.title}
          </h4>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <ChartBarIcon className="h-4 w-4" />
              Priority: {complaint.priority_score || 'N/A'}
            </span>
            <span className="flex items-center gap-1">
              <ClockIcon className="h-4 w-4" />
              {isBreached ? (
                <span className="text-danger-600 font-medium">
                  Overdue by {Math.abs(hoursRemaining)}h
                </span>
              ) : (
                <span className={isAtRisk ? 'text-warning-600 font-medium' : ''}>
                  {hoursRemaining}h remaining
                </span>
              )}
            </span>
            <span>
              Category: {complaint.category?.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/complaints/${complaint.id}`}
            className="btn-secondary text-sm py-2 flex items-center gap-1.5"
          >
            <EyeIcon className="h-4 w-4" />
            View
          </Link>
          {(userRole === 'admin' || userRole === 'department') && (
            <button
              onClick={onEscalate}
              disabled={isEscalating || (complaint.escalation_level || 0) >= 3}
              className={clsx(
                'text-sm py-2 flex items-center gap-1.5',
                (complaint.escalation_level || 0) >= 3
                  ? 'btn-secondary opacity-50 cursor-not-allowed'
                  : 'btn-danger'
              )}
            >
              <ArrowUpIcon className="h-4 w-4" />
              Escalate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
