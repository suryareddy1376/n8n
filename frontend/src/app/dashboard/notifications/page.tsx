'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import clsx from 'clsx';
import {
  CheckIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  InboxIcon,
} from '@heroicons/react/24/outline';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  created_at: string;
  complaint_id?: string;
}

type NotificationFilter = 'all' | 'unread';

export default function NotificationsPage() {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: () =>
      apiClient.get<{ data: Notification[] }>(`/notifications?filter=${filter}`),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.post('/notifications/read-all', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = data?.data || [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const groupedNotifications = notifications.reduce<Record<string, Notification[]>>((acc, notification) => {
    const date = new Date(notification.created_at).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(notification);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="btn-secondary flex items-center gap-2"
          >
            <CheckIcon className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl w-fit">
        <button
          onClick={() => setFilter('all')}
          className={clsx(
            'px-4 py-2 text-sm font-medium rounded-lg transition-all',
            filter === 'all'
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={clsx(
            'px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2',
            filter === 'unread'
              ? 'bg-white text-primary-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          Unread
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="empty-state py-20">
          <InboxIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Notifications</h3>
          <p className="text-slate-500">
            {filter === 'unread'
              ? "You've read all your notifications!"
              : "You don't have any notifications yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedNotifications).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-slate-500 mb-4">{date}</h3>
              <div className="space-y-3">
                {items.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onMarkRead={() => markReadMutation.mutate(notification.id)}
                    onDelete={() => deleteMutation.mutate(notification.id)}
                    isMarkingRead={markReadMutation.isPending}
                    isDeleting={deleteMutation.isPending}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface NotificationCardProps {
  notification: Notification;
  onMarkRead: () => void;
  onDelete: () => void;
  isMarkingRead: boolean;
  isDeleting: boolean;
}

function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
  isMarkingRead,
  isDeleting,
}: NotificationCardProps) {
  const typeConfig = {
    info: {
      icon: InformationCircleIcon,
      bg: 'bg-primary-50',
      iconBg: 'bg-primary-100',
      iconColor: 'text-primary-600',
      border: 'border-primary-100',
    },
    warning: {
      icon: ExclamationTriangleIcon,
      bg: 'bg-warning-50',
      iconBg: 'bg-warning-100',
      iconColor: 'text-warning-600',
      border: 'border-warning-100',
    },
    success: {
      icon: CheckCircleIcon,
      bg: 'bg-success-50',
      iconBg: 'bg-success-100',
      iconColor: 'text-success-600',
      border: 'border-success-100',
    },
    error: {
      icon: ExclamationTriangleIcon,
      bg: 'bg-danger-50',
      iconBg: 'bg-danger-100',
      iconColor: 'text-danger-600',
      border: 'border-danger-100',
    },
  };

  const config = typeConfig[notification.type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        'p-4 rounded-xl border transition-all',
        notification.read
          ? 'bg-white border-slate-200'
          : config.bg + ' ' + config.border
      )}
    >
      <div className="flex items-start gap-4">
        <div className={clsx('p-2 rounded-lg shrink-0', config.iconBg)}>
          <Icon className={clsx('h-5 w-5', config.iconColor)} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className={clsx(
                'text-sm font-semibold',
                notification.read ? 'text-slate-700' : 'text-slate-900'
              )}>
                {notification.title}
                {!notification.read && (
                  <span className="ml-2 inline-block w-2 h-2 bg-primary-500 rounded-full" />
                )}
              </h4>
              <p className={clsx(
                'text-sm mt-0.5',
                notification.read ? 'text-slate-500' : 'text-slate-600'
              )}>
                {notification.message}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!notification.read && (
                <button
                  onClick={onMarkRead}
                  disabled={isMarkingRead}
                  className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  title="Mark as read"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={onDelete}
                disabled={isDeleting}
                className="p-2 text-slate-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                title="Delete"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5" />
              {new Date(notification.created_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
            {notification.complaint_id && (
              <a
                href={`/dashboard/complaints/${notification.complaint_id}`}
                className="flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium"
              >
                <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                View Complaint
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
