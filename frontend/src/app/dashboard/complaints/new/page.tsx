'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { Category, UrgencyLevel, Complaint } from '@/types';
import {
  ArrowLeftIcon,
  PhotoIcon,
  MapPinIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import clsx from 'clsx';

interface ComplaintFormData {
  description: string;
  location: string;
  category?: Category;
  urgency?: UrgencyLevel;
  latitude?: number;
  longitude?: number;
}

const categories: { value: Category; label: string }[] = [
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'sanitation', label: 'Sanitation' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'public_safety', label: 'Public Safety' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'environment', label: 'Environment' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' },
];

const urgencyLevels: { value: UrgencyLevel; label: string; desc: string }[] = [
  { value: 'normal', label: 'Normal', desc: 'Standard processing' },
  { value: 'high', label: 'High', desc: '1-2 days' },
  { value: 'critical', label: 'Critical', desc: 'Immediate' },
];

export default function NewComplaintPage() {
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [createdComplaint, setCreatedComplaint] = useState<Complaint | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ComplaintFormData>();

  const description = watch('description');
  const selectedCategory = watch('category');
  const selectedUrgency = watch('urgency');

  const submitMutation = useMutation({
    mutationFn: async (data: ComplaintFormData) => {
      setStep('processing');
      const response = await apiClient.post<{ data: Complaint }>('/complaints', {
        description: data.description,
        location: data.location,
        category: data.category,
        urgency: data.urgency,
        latitude: data.latitude,
        longitude: data.longitude,
      });
      return response.data;
    },
    onSuccess: (complaint) => {
      setCreatedComplaint(complaint);
      setStep('success');
    },
    onError: () => {
      setStep('form');
    },
  });

  const onSubmit = (data: ComplaintFormData) => {
    submitMutation.mutate(data);
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(() => {}, () => {});
  };

  if (step === 'processing') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-6 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-900">Processing your complaint...</p>
          <p className="text-xs text-slate-500 mt-1">Analyzing and routing</p>
        </div>
      </div>
    );
  }

  if (step === 'success' && createdComplaint) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircleIcon className="w-6 h-6 text-success-600" />
            <h2 className="text-base font-semibold text-slate-900">Complaint Submitted</h2>
          </div>
          
          <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">ID</span>
              <span className="font-mono text-slate-900">#{createdComplaint.id.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Category</span>
              <span className="text-slate-900">{createdComplaint.category?.replace(/_/g, ' ') || 'Pending'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Status</span>
              <span className="text-slate-900">{createdComplaint.status.replace(/_/g, ' ')}</span>
            </div>
            {createdComplaint.ai_confidence && (
              <div className="flex justify-between text-sm items-center">
                <span className="text-slate-500">AI Confidence</span>
                <span className="text-slate-900">{Math.round(createdComplaint.ai_confidence * 100)}%</span>
              </div>
            )}
          </div>

          {createdComplaint.status === 'pending_review' && (
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 mb-4 text-sm text-warning-800">
              Your complaint requires admin review before assignment.
            </div>
          )}

          <div className="flex gap-3">
            <Link href={`/dashboard/complaints/${createdComplaint.id}`} className="btn-primary flex-1 justify-center">
              View <ArrowRightIcon className="w-4 h-4" />
            </Link>
            <Link href="/dashboard/complaints" className="btn-secondary flex-1 justify-center">
              Back to List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <Link href="/dashboard/complaints" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-2">
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          Back
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">New Complaint</h1>
        <p className="text-sm text-slate-500">Describe your issue. AI will classify and route it.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Description */}
        <div className="card p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Description <span className="text-danger-500">*</span>
          </label>
          <textarea
            {...register('description', {
              required: 'Required',
              minLength: { value: 20, message: 'At least 20 characters' },
              maxLength: { value: 2000, message: 'Max 2000 characters' },
            })}
            rows={4}
            className={clsx('input-field w-full resize-none', errors.description && 'border-danger-300')}
            placeholder="Describe your complaint in detail..."
          />
          <div className="flex justify-between mt-1">
            {errors.description ? (
              <p className="text-xs text-danger-600">{errors.description.message}</p>
            ) : (
              <span />
            )}
            <span className="text-xs text-slate-400">{(description as string)?.length || 0}/2000</span>
          </div>
        </div>

        {/* Location */}
        <div className="card p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Location <span className="text-danger-500">*</span>
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <MapPinIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                {...register('location', { required: 'Required', minLength: { value: 5, message: 'Be more specific' } })}
                type="text"
                className={clsx('input-with-icon w-full', errors.location && 'border-danger-300')}
                placeholder="Street address or landmark"
              />
            </div>
            <button type="button" onClick={getCurrentLocation} className="btn-secondary px-3">
              <MapPinIcon className="w-4 h-4" />
            </button>
          </div>
          {errors.location && <p className="text-xs text-danger-600 mt-1">{errors.location.message}</p>}
        </div>

        {/* Category */}
        <div className="card p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Category <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setValue('category', selectedCategory === cat.value ? undefined : cat.value as any)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg border text-sm transition-colors',
                  selectedCategory === cat.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Urgency */}
        <div className="card p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Urgency <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {urgencyLevels.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => setValue('urgency', selectedUrgency === level.value ? undefined : level.value as any)}
                className={clsx(
                  'p-3 rounded-lg border text-left transition-colors',
                  selectedUrgency === level.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <span className="text-sm font-medium text-slate-900 block">{level.label}</span>
                <span className="text-xs text-slate-500">{level.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Attachments */}
        <div className="card p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Attachments <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-slate-300 transition-colors cursor-pointer">
            <PhotoIcon className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600">
              Drop files or <span className="text-primary-600">browse</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">PNG, JPG, PDF up to 10MB</p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <Link href="/dashboard/complaints" className="btn-secondary flex-1 justify-center">
            Cancel
          </Link>
          <button type="submit" disabled={submitMutation.isPending} className="btn-primary flex-1 justify-center">
            {submitMutation.isPending ? 'Submitting...' : 'Submit Complaint'}
          </button>
        </div>
      </form>
    </div>
  );
}
