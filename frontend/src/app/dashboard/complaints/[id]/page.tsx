'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/lib/api';
import { Complaint, StatusLog, ComplaintStatus } from '@/types';
import Link from 'next/link';
import clsx from 'clsx';
import {
  ArrowLeftIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

const statusStyles: Record<ComplaintStatus, string> = {
  submitted: 'bg-slate-100 text-slate-700',
  pending_review: 'bg-slate-100 text-slate-700',
  approved: 'bg-primary-50 text-primary-700',
  assigned: 'bg-primary-50 text-primary-700',
  in_progress: 'bg-warning-50 text-warning-700',
  resolved: 'bg-success-50 text-success-700',
  closed: 'bg-slate-100 text-slate-600',
  rejected: 'bg-danger-50 text-danger-700',
  escalated: 'bg-danger-50 text-danger-700',
};

export default function ComplaintDetailPage() {
  const params = useParams();
  const user = useAuthStore((state) => state.user);
  const complaintId = params.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['complaint', complaintId],
    queryFn: () => apiClient.get<{ data: Complaint }>(`/complaints/${complaintId}`),
  });

  const { data: historyData } = useQuery({
    queryKey: ['complaint-history', complaintId],
    queryFn: () => apiClient.get<{ data: StatusLog[] }>(`/complaints/${complaintId}/history`),
  });

  const complaint = data?.data;
  const history = historyData?.data || [];

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="skeleton h-6 w-32 rounded" />
        <div className="card p-4 space-y-3">
          <div className="skeleton h-5 w-3/4 rounded" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-2/3 rounded" />
        </div>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-6 text-center">
          <ExclamationTriangleIcon className="w-8 h-8 text-danger-500 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-slate-900 mb-1">Not Found</h2>
          <p className="text-sm text-slate-500 mb-4">Complaint does not exist or you lack permission.</p>
          <Link href="/dashboard/complaints" className="btn-primary">
            <ArrowLeftIcon className="w-4 h-4" />
            Back
          </Link>
        </div>
      </div>
    );
  }

  const isSLABreached = complaint.sla_deadline && new Date(complaint.sla_deadline) < new Date();
  const canUpdateStatus = (user?.role === 'department' || user?.role === 'admin') && !['closed', 'rejected'].includes(complaint.status);
  const canProvideFeedback = user?.role === 'citizen' && user?.id === complaint.user_id && complaint.status === 'resolved' && !complaint.citizen_feedback_rating;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link href="/dashboard/complaints" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">Complaint Details</h1>
            <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              #{complaint.id.slice(0, 8)}
            </span>
          </div>
        </div>
        <span className={clsx('badge text-sm px-3 py-1', statusStyles[complaint.status])}>
          {complaint.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* SLA Warning */}
      {isSLABreached && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 flex items-center gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-danger-600" />
          <div>
            <p className="text-sm font-medium text-danger-800">SLA Breached</p>
            <p className="text-xs text-danger-600">Deadline: {new Date(complaint.sla_deadline!).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left - Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-900 mb-2">Description</h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{complaint.title || complaint.description}</p>
            {complaint.title && <p className="text-sm text-slate-500 mt-2">{complaint.description}</p>}
          </div>

          {/* AI Classification */}
          {complaint.ai_confidence && (
            <div className="card p-4">
              <h3 className="text-sm font-medium text-slate-900 mb-3">AI Classification</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Category</p>
                  <p className="text-sm font-medium text-slate-900 capitalize">{complaint.category?.replace(/_/g, ' ') || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Urgency</p>
                  <p className="text-sm font-medium text-slate-900 capitalize">{complaint.urgency || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Confidence</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full',
                          complaint.ai_confidence >= 0.75 ? 'bg-success-500' : complaint.ai_confidence >= 0.5 ? 'bg-warning-500' : 'bg-danger-500'
                        )}
                        style={{ width: `${complaint.ai_confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-700">{Math.round(complaint.ai_confidence * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status History */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-900 mb-3">Status History</h3>
            {history.length > 0 ? (
              <div className="space-y-3">
                {history.map((log, idx) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className={clsx(
                      'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                      idx === 0 ? 'bg-primary-500 text-white' : 'bg-slate-200 text-slate-500'
                    )}>
                      <CheckCircleIcon className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx('badge text-xs', statusStyles[log.new_status] || 'bg-slate-100 text-slate-700')}>
                          {log.new_status.replace(/_/g, ' ')}
                        </span>
                        {log.old_status && <span className="text-xs text-slate-400">from {log.old_status.replace(/_/g, ' ')}</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(log.created_at).toLocaleString()}
                        {log.changed_by_user?.full_name && ` • ${log.changed_by_user.full_name}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No status changes yet</p>
            )}
          </div>

          {/* Feedback Display */}
          {complaint.citizen_feedback_rating && (
            <div className="card p-4">
              <h3 className="text-sm font-medium text-slate-900 mb-2">Your Feedback</h3>
              <div className="flex items-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <span key={i}>
                    {i < (complaint.citizen_feedback_rating || 0) ? (
                      <StarIconSolid className="w-4 h-4 text-warning-400" />
                    ) : (
                      <StarIcon className="w-4 h-4 text-slate-200" />
                    )}
                  </span>
                ))}
                <span className="text-xs text-slate-500 ml-1">({complaint.citizen_feedback_rating}/5)</span>
              </div>
              {complaint.citizen_feedback && <p className="text-sm text-slate-700">{complaint.citizen_feedback}</p>}
            </div>
          )}

          {canProvideFeedback && <FeedbackForm complaintId={complaint.id} />}
          {canUpdateStatus && <StatusUpdateForm complaint={complaint} />}
        </div>

        {/* Right - Sidebar */}
        <div className="space-y-4">
          {/* Details */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-900 mb-3">Details</h3>
            <div className="space-y-3">
              <DetailRow icon={MapPinIcon} label="Location" value={complaint.location_address || complaint.location || 'N/A'} />
              <DetailRow icon={CalendarIcon} label="Submitted" value={new Date(complaint.created_at).toLocaleString()} />
              {complaint.sla_deadline && (
                <DetailRow
                  icon={ClockIcon}
                  label="SLA Deadline"
                  value={new Date(complaint.sla_deadline).toLocaleString()}
                  valueClass={isSLABreached ? 'text-danger-600' : undefined}
                />
              )}
              {complaint.department && <DetailRow icon={BuildingOffice2Icon} label="Department" value={complaint.department.name} />}
              {complaint.assigned_user && <DetailRow icon={UserIcon} label="Assigned" value={complaint.assigned_user.full_name || 'Staff'} />}
            </div>
          </div>

          {/* Priority */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-900 mb-3">Priority</h3>
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14">
                <svg className="w-14 h-14 transform -rotate-90">
                  <circle cx="28" cy="28" r="24" stroke="currentColor" className="text-slate-100" strokeWidth="4" fill="none" />
                  <circle
                    cx="28" cy="28" r="24" stroke="currentColor"
                    className={clsx(
                      (complaint.priority_score || 0) >= 80 ? 'text-danger-500' :
                      (complaint.priority_score || 0) >= 60 ? 'text-warning-500' :
                      (complaint.priority_score || 0) >= 40 ? 'text-primary-500' : 'text-success-500'
                    )}
                    strokeWidth="4" fill="none"
                    strokeDasharray={`${((complaint.priority_score || 0) / 100) * 151} 151`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-semibold text-sm text-slate-900">
                  {complaint.priority_score || 0}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {(complaint.priority_score || 0) >= 80 ? 'Critical' :
                   (complaint.priority_score || 0) >= 60 ? 'High' :
                   (complaint.priority_score || 0) >= 40 ? 'Medium' : 'Low'}
                </p>
                <p className="text-xs text-slate-500">Priority Level</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, valueClass }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={clsx('text-sm text-slate-900 break-words', valueClass)}>{value}</p>
      </div>
    </div>
  );
}

function FeedbackForm({ complaintId }: { complaintId: string }) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => apiClient.post(`/complaints/${complaintId}/feedback`, { satisfaction: rating, feedback }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['complaint', complaintId] }),
  });

  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium text-slate-900 mb-3">Rate Resolution</h3>
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            className="p-0.5"
          >
            {star <= (hoveredRating || rating) ? (
              <StarIconSolid className="w-5 h-5 text-warning-400" />
            ) : (
              <StarIcon className="w-5 h-5 text-slate-200" />
            )}
          </button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={2}
        className="input-field w-full resize-none mb-3"
        placeholder="Additional comments (optional)"
      />
      <button onClick={() => mutation.mutate()} disabled={rating === 0 || mutation.isPending} className="btn-primary w-full justify-center">
        {mutation.isPending ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </div>
  );
}

function StatusUpdateForm({ complaint }: { complaint: Complaint }) {
  const [status, setStatus] = useState<ComplaintStatus>(complaint.status);
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const statusOptions: ComplaintStatus[] = ['in_progress', 'resolved', 'escalated', 'closed'];

  const mutation = useMutation({
    mutationFn: () => apiClient.patch(`/complaints/${complaint.id}`, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaint', complaint.id] });
      queryClient.invalidateQueries({ queryKey: ['complaint-history', complaint.id] });
    },
  });

  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium text-slate-900 mb-3">Update Status</h3>
      <select value={status} onChange={(e) => setStatus(e.target.value as ComplaintStatus)} className="input-field w-full mb-3">
        {statusOptions.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
        ))}
      </select>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="input-field w-full resize-none mb-3"
        placeholder="Add notes (optional)"
      />
      <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary w-full justify-center">
        {mutation.isPending ? 'Updating...' : 'Update Status'}
      </button>
    </div>
  );
}
