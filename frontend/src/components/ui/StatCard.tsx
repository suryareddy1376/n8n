'use client';

import clsx from 'clsx';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: { value: number; trend: 'up' | 'down' };
  alert?: boolean;
}

export function StatCard({ label, value, change, alert }: StatCardProps) {
  return (
    <div className="relative bg-white border border-slate-200 rounded-lg p-4">
      {alert && (
        <span className="absolute top-3 right-3 w-2 h-2 bg-warning-500 rounded-full" />
      )}
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      {change && (
        <p
          className={clsx(
            'text-xs mt-1',
            change.trend === 'up' ? 'text-success-600' : 'text-danger-600'
          )}
        >
          {change.trend === 'up' ? '↑' : '↓'} {Math.abs(change.value)}%
        </p>
      )}
    </div>
  );
}

export default StatCard;
