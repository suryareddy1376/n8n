'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { Complaint } from '@/types';
import clsx from 'clsx';
import Link from 'next/link';
import {
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  InboxIcon,
  SparklesIcon,
  ClockIcon,
  UserIcon,
  TagIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

type ReviewFilter = 'pending' | 'spam' | 'approved';

export default function ReviewQueuePage() {
  const [filter, setFilter] = useState<ReviewFilter>('pending');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['review-queue', filter],
    queryFn: () =>
      apiClient.get<{ data: Complaint[] }>(`/complaints/review?filter=${filter}`),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/complaints/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/complaints/${id}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    },
  });

  const complaints = data?.data || [];

  const filterTabs = [
    { key: 'pending' as ReviewFilter, label: 'Pending Review', icon: ClockIcon },
    { key: 'spam' as ReviewFilter, label: 'Spam Flagged', icon: XCircleIcon },
    { key: 'approved' as ReviewFilter, label: 'Approved', icon: CheckCircleIcon },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Review Queue</h1>
        <p className="text-sm text-slate-500">Moderate and verify complaints</p>
      </div>

      {/* AI Assistance Banner */}
      <div className="bg-primary-50 rounded-lg p-3 border border-primary-100 flex items-center gap-3">
        <SparklesIcon className="w-5 h-5 text-primary-600" />
        <p className="text-sm text-slate-700">
          <span className="font-medium">AI moderation active.</span> Review classifications and make final decisions.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1 rounded-lg">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded transition-colors',
              filter === tab.key
                ? 'bg-white text-primary-700'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Complaints Grid */}
      {isLoading ? (
        <div className="grid lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-48 rounded-lg" />
          ))}
        </div>
      ) : complaints.length === 0 ? (
        <div className="empty-state py-8">
          <InboxIcon className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 mb-1">Queue Empty</h3>
          <p className="text-sm text-slate-500">
            {filter === 'pending'
              ? 'No complaints waiting for review.'
              : filter === 'spam'
              ? 'No spam-flagged complaints.'
              : 'No approved complaints.'}
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {complaints.map((complaint) => (
            <ReviewCard
              key={complaint.id}
              complaint={complaint}
              onApprove={() => approveMutation.mutate(complaint.id)}
              onReject={() => rejectMutation.mutate(complaint.id)}
              isApproving={approveMutation.isPending}
              isRejecting={rejectMutation.isPending}
              showActions={filter === 'pending' || filter === 'spam'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ReviewCardProps {
  complaint: Complaint;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
  showActions: boolean;
}

function ReviewCard({
  complaint,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  showActions,
}: ReviewCardProps) {
  const isSpam = complaint.is_spam_flagged || false;
  const confidence = complaint.ai_confidence || 0;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {isSpam && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-danger-100 text-danger-700 rounded-full">
                  <XCircleIcon className="h-3.5 w-3.5" />
                  Spam Flagged
                </span>
              )}
              <span className={clsx(
                'px-2 py-0.5 text-xs font-medium rounded-full',
                complaint.urgency === 'critical' ? 'bg-danger-100 text-danger-700' :
                complaint.urgency === 'high' ? 'bg-warning-100 text-warning-700' :
                'bg-slate-100 text-slate-600'
              )}>
                {complaint.urgency?.charAt(0).toUpperCase() + complaint.urgency?.slice(1)} Priority
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 truncate">
              {complaint.title || complaint.description.slice(0, 50)}
            </h3>
          </div>
          <Link
            href={`/dashboard/complaints/${complaint.id}`}
            className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <EyeIcon className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <p className="text-sm text-slate-600 line-clamp-3 mb-4">
          {complaint.description}
        </p>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <UserIcon className="h-4 w-4 text-slate-400" />
            <span className="truncate">{complaint.citizen?.full_name || 'Anonymous'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <TagIcon className="h-4 w-4 text-slate-400" />
            <span className="truncate">{complaint.category?.replace(/_/g, ' ') || 'Pending'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <ClockIcon className="h-4 w-4 text-slate-400" />
            <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <ChatBubbleLeftRightIcon className="h-4 w-4 text-slate-400" />
            <span>{complaint.ai_sentiment || 'Neutral'}</span>
          </div>
        </div>

        {/* AI Confidence */}
        {confidence > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">AI Confidence</span>
              <span className="text-xs font-semibold text-primary-600">{Math.round(confidence * 100)}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all"
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <button
            onClick={onApprove}
            disabled={isApproving || isRejecting}
            className="flex-1 btn-primary flex items-center justify-center gap-2"
          >
            <CheckCircleIcon className="h-5 w-5" />
            {isApproving ? 'Approving...' : 'Approve'}
          </button>
          <button
            onClick={onReject}
            disabled={isApproving || isRejecting}
            className="flex-1 btn-danger flex items-center justify-center gap-2"
          >
            <XCircleIcon className="h-5 w-5" />
            {isRejecting ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      )}
    </div>
  );
}
