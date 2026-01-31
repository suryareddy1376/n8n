import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors.js';

// Validation middleware factory
export const validate = <T extends ZodSchema>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        throw new ValidationError('Validation failed', { errors });
      }

      // Replace request data with parsed/transformed data
      req[source] = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// =====================================================
// Validation Schemas
// =====================================================

// Common schemas
export const uuidSchema = z.string().uuid('Invalid UUID format');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// Complaint schemas
export const createComplaintSchema = z.object({
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description cannot exceed 5000 characters'),
  voice_transcript: z.string().max(10000).optional(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  location_address: z.string().max(500).optional(),
  location_landmark: z.string().max(200).optional(),
});

export const updateComplaintStatusSchema = z.object({
  status: z.enum([
    'in_progress',
    'resolved',
    'closed',
  ]),
  notes: z.string().max(2000).optional(),
  resolution_type: z.enum(['fixed', 'duplicate', 'invalid', 'referred']).optional(),
});

export const approveComplaintSchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(2000).optional(),
  department_id: z.string().uuid().optional(),
  urgency: z.enum(['normal', 'high', 'critical']).optional(),
});

export const assignComplaintSchema = z.object({
  assigned_to: z.string().uuid().optional(),
});

export const citizenFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback_text: z.string().max(1000).optional(),
});

// Complaint filter schema
export const complaintFilterSchema = z.object({
  status: z.union([
    z.enum([
      'submitted',
      'pending_review',
      'approved',
      'rejected',
      'assigned',
      'in_progress',
      'resolved',
      'closed',
      'escalated',
    ]),
    z.array(z.enum([
      'submitted',
      'pending_review',
      'approved',
      'rejected',
      'assigned',
      'in_progress',
      'resolved',
      'closed',
      'escalated',
    ])),
  ]).optional(),
  department_id: z.string().uuid().optional(),
  urgency: z.union([
    z.enum(['normal', 'high', 'critical']),
    z.array(z.enum(['normal', 'high', 'critical'])),
  ]).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  sla_breached: z.coerce.boolean().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// Webhook schemas
export const webhookPayloadSchema = z.object({
  event_type: z.string(),
  complaint_id: z.string().uuid(),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime(),
  signature: z.string(),
});

// User schemas
export const updateUserSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional(),
  avatar_url: z.string().url().optional(),
});

// Department schema
export const createDepartmentSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).toUpperCase(),
  description: z.string().max(500).optional(),
  sla_hours: z.number().int().min(1).max(720).default(72),
  escalation_email: z.string().email().optional(),
});

// ID parameter schema
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

// Export type inferences
export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;
export type ApproveComplaintInput = z.infer<typeof approveComplaintSchema>;
export type AssignComplaintInput = z.infer<typeof assignComplaintSchema>;
export type CitizenFeedbackInput = z.infer<typeof citizenFeedbackSchema>;
export type ComplaintFilterInput = z.infer<typeof complaintFilterSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
