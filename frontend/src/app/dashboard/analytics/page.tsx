'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { DashboardStats, DepartmentStats, TrendData } from '@/types';
import clsx from 'clsx';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarIcon,
  BuildingOffice2Icon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

type DateRange = '7d' | '30d' | '90d' | '1y';

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['analytics-stats', dateRange],
    queryFn: () => apiClient.get<{ data: DashboardStats }>('/analytics/dashboard'),
  });

  const { data: deptStats, isLoading: deptLoading } = useQuery({
    queryKey: ['analytics-departments', dateRange],
    queryFn: () => apiClient.get<{ data: DepartmentStats[] }>('/analytics/departments'),
  });

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['analytics-trends', dateRange],
    queryFn: () =>
      apiClient.get<{ data: TrendData[] }>(`/analytics/trends?range=${dateRange}`),
  });

  const dashboardStats = stats?.data;
  const departments = deptStats?.data || [];
  const trends = trendData?.data || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500">System performance and insights</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-1.5">
          <CalendarIcon className="w-4 h-4 text-slate-400" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="text-sm font-medium text-slate-700 bg-transparent border-none focus:ring-0 cursor-pointer"
          >
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
            <option value="1y">1 year</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Complaints"
          value={dashboardStats?.total_complaints || 0}
          change={12.5}
          loading={statsLoading}
          icon={ChartBarIcon}
          color="primary"
        />
        <MetricCard
          title="Resolution Rate"
          value={`${Math.round(dashboardStats?.resolution_rate || 0)}%`}
          change={-2.3}
          loading={statsLoading}
          icon={CheckCircleIcon}
          color="success"
        />
        <MetricCard
          title="SLA Compliance"
          value={`${Math.round(dashboardStats?.sla_compliance_rate || 0)}%`}
          change={5.1}
          loading={statsLoading}
          icon={ClockIcon}
          color="warning"
        />
        <MetricCard
          title="Avg Resolution"
          value={`${Math.round(dashboardStats?.avg_resolution_hours || 0)}h`}
          change={-8.2}
          loading={statsLoading}
          icon={ArrowTrendingUpIcon}
          color="accent"
          inverseColor
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Complaints Trend Chart */}
        <div className="card p-4">
          <h3 className="text-sm font-medium text-slate-900 mb-4">Complaint Trends</h3>
          {trendLoading ? (
            <div className="h-64 skeleton rounded-xl" />
          ) : (
            <div className="h-64 flex items-end gap-1">
              {trends.slice(-14).map((point, idx) => {
                const maxCount = Math.max(...trends.map((t) => t.count), 1);
                const height = (point.count / maxCount) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="relative w-full">
                      <div
                        className="w-full bg-primary-500 rounded-t hover:bg-primary-600 transition-colors cursor-pointer"
                        style={{ height: `${Math.max(height, 4)}px` }}
                      />
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {point.count} complaints
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Distribution */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Status Distribution</h3>
          <div className="space-y-5">
            <StatusBar
              label="Pending Review"
              count={dashboardStats?.pending_review || 0}
              total={dashboardStats?.total_complaints || 1}
              color="slate"
            />
            <StatusBar
              label="In Progress"
              count={dashboardStats?.in_progress || 0}
              total={dashboardStats?.total_complaints || 1}
              color="warning"
            />
            <StatusBar
              label="Resolved"
              count={dashboardStats?.resolved || 0}
              total={dashboardStats?.total_complaints || 1}
              color="success"
            />
            <StatusBar
              label="SLA Breached"
              count={dashboardStats?.sla_breached || 0}
              total={dashboardStats?.total_complaints || 1}
              color="danger"
            />
          </div>
        </div>
      </div>

      {/* Department Performance */}
      <div className="card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">Department Performance</h3>
        </div>
        {deptLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Open</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Breached</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Resolution</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((dept) => {
                  const performance = dept.total_complaints > 0 
                    ? Math.round(((dept.total_complaints - dept.breached_complaints) / dept.total_complaints) * 100)
                    : 100;
                  return (
                    <tr key={dept.department_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center">
                            <BuildingOffice2Icon className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-slate-900">{dept.department_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-medium">{dept.total_complaints}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{dept.open_complaints}</td>
                      <td className="px-6 py-4">
                        <span className={clsx(
                          'text-sm font-medium',
                          dept.breached_complaints > 0 ? 'text-danger-600' : 'text-slate-600'
                        )}>
                          {dept.breached_complaints}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {dept.avg_resolution_hours ? `${Math.round(dept.avg_resolution_hours)}h` : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div 
                              className={clsx(
                                'h-full rounded-full transition-all',
                                performance >= 80 ? 'bg-success-500' : performance >= 50 ? 'bg-warning-500' : 'bg-danger-500'
                              )}
                              style={{ width: `${performance}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-600">{performance}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number | string;
  change: number;
  loading?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'accent';
  inverseColor?: boolean;
}

function MetricCard({ title, value, change, loading, icon: Icon, color, inverseColor }: MetricCardProps) {
  const isPositive = inverseColor ? change < 0 : change > 0;

  if (loading) {
    return (
      <div className="card p-4">
        <div className="skeleton h-8 w-8 rounded mb-3" />
        <div className="skeleton h-6 w-16 mb-1" />
        <div className="skeleton h-4 w-24" />
      </div>
    );
  }

  return (
    <div className="card p-4">
      <Icon className={clsx('w-5 h-5 mb-3', 
        color === 'primary' && 'text-primary-500',
        color === 'success' && 'text-success-500',
        color === 'warning' && 'text-warning-500',
        color === 'danger' && 'text-danger-500',
      )} />
      <div className="text-2xl font-semibold text-slate-900 mb-1">{value}</div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{title}</span>
        <span className={clsx(
          'text-xs font-medium flex items-center gap-0.5',
          isPositive ? 'text-success-600' : 'text-danger-600'
        )}>
          {isPositive ? <ArrowTrendingUpIcon className="w-3 h-3" /> : <ArrowTrendingDownIcon className="w-3 h-3" />}
          {Math.abs(change)}%
        </span>
      </div>
    </div>
  );
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percentage = Math.round((count / total) * 100);
  const colorClasses: Record<string, string> = {
    slate: 'bg-slate-400',
    warning: 'bg-warning-500',
    success: 'bg-success-500',
    danger: 'bg-danger-500',
    primary: 'bg-primary-500',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm text-slate-500">{count} ({percentage}%)</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={clsx('h-full rounded-full transition-all duration-500', colorClasses[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
