import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize, authorizeDepartment } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, createComplaintSchema, updateComplaintStatusSchema, approveComplaintSchema, assignComplaintSchema, citizenFeedbackSchema, complaintFilterSchema, idParamSchema } from '../middleware/validation.js';
import { aiRateLimiter, uploadRateLimiter } from '../middleware/rateLimiter.js';
import complaintService from '../services/complaintService.js';
import { supabaseAdmin } from '../utils/supabase.js';
import { config } from '../config/index.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileSizeBytes,
    files: 5, // Max 5 files per upload
  },
  fileFilter: (_req, file, cb) => {
    if (config.upload.allowedFileTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

/**
 * @route   POST /api/v1/complaints
 * @desc    Create a new complaint
 * @access  Citizen
 */
router.post(
  '/',
  authenticate,
  authorize('citizen'),
  uploadRateLimiter,
  upload.array('images', 5),
  validate(createComplaintSchema, 'body'),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const data = req.body;

    // Handle file uploads to Supabase Storage
    let imageUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const fileName = `complaints/${userId}/${Date.now()}-${file.originalname}`;
        const { data: uploadData, error } = await supabaseAdmin.storage
          .from('attachments')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
          });

        if (!error && uploadData) {
          const { data: urlData } = supabaseAdmin.storage
            .from('attachments')
            .getPublicUrl(fileName);
          imageUrls.push(urlData.publicUrl);
        }
      }
    }

    const complaint = await complaintService.createComplaint(userId, data, imageUrls);

    res.status(201).json({
      success: true,
      data: complaint,
      message: 'Complaint submitted successfully. It will be processed shortly.',
    });
  })
);

/**
 * @route   GET /api/v1/complaints
 * @desc    Get complaints with filters
 * @access  Authenticated (role-based filtering)
 */
router.get(
  '/',
  authenticate,
  validate(complaintFilterSchema, 'query'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const filters = req.query;

    const result = await complaintService.getComplaints(
      filters as Parameters<typeof complaintService.getComplaints>[0],
      user.id,
      user.role,
      user.department_id || undefined
    );

    res.json({
      success: true,
      ...result,
    });
  })
);

/**
 * @route   GET /api/v1/complaints/pending-review
 * @desc    Get complaints pending manual review
 * @access  Admin
 */
router.get(
  '/pending-review',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await complaintService.getPendingReviewComplaints(page, limit);

    res.json({
      success: true,
      ...result,
    });
  })
);

/**
 * @route   GET /api/v1/complaints/:id
 * @desc    Get complaint by ID
 * @access  Authenticated (role-based access)
 */
router.get(
  '/:id',
  authenticate,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = req.user!;

    const complaint = await complaintService.getComplaintById(
      id,
      user.id,
      user.role,
      user.department_id || undefined
    );

    res.json({
      success: true,
      data: complaint,
    });
  })
);

/**
 * @route   GET /api/v1/complaints/:id/timeline
 * @desc    Get complaint status history and escalations
 * @access  Authenticated
 */
router.get(
  '/:id/timeline',
  authenticate,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const timeline = await complaintService.getComplaintTimeline(id);

    res.json({
      success: true,
      data: timeline,
    });
  })
);

/**
 * @route   POST /api/v1/complaints/:id/approve
 * @desc    Approve or reject a pending complaint
 * @access  Admin
 */
router.post(
  '/:id/approve',
  authenticate,
  authorize('admin'),
  validate(idParamSchema, 'params'),
  validate(approveComplaintSchema, 'body'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { approved, notes, department_id, urgency } = req.body;
    const reviewerId = req.user!.id;

    const complaint = await complaintService.reviewComplaint(
      id,
      reviewerId,
      approved,
      notes,
      department_id,
      urgency
    );

    res.json({
      success: true,
      data: complaint,
      message: approved ? 'Complaint approved' : 'Complaint rejected',
    });
  })
);

/**
 * @route   POST /api/v1/complaints/:id/assign
 * @desc    Assign complaint to department user
 * @access  Admin, Department
 */
router.post(
  '/:id/assign',
  authenticate,
  authorize('admin', 'department'),
  authorizeDepartment,
  validate(idParamSchema, 'params'),
  validate(assignComplaintSchema, 'body'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { assigned_to } = req.body;

    const complaint = await complaintService.assignComplaint(id, assigned_to);

    res.json({
      success: true,
      data: complaint,
      message: 'Complaint assigned successfully',
    });
  })
);

/**
 * @route   PATCH /api/v1/complaints/:id/status
 * @desc    Update complaint status
 * @access  Department
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize('admin', 'department'),
  authorizeDepartment,
  validate(idParamSchema, 'params'),
  validate(updateComplaintStatusSchema, 'body'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes, resolution_type } = req.body;
    const updaterId = req.user!.id;

    const complaint = await complaintService.updateComplaintStatus(
      id,
      updaterId,
      status,
      notes,
      resolution_type
    );

    res.json({
      success: true,
      data: complaint,
      message: 'Status updated successfully',
    });
  })
);

/**
 * @route   POST /api/v1/complaints/:id/feedback
 * @desc    Add citizen feedback to resolved complaint
 * @access  Citizen (owner only)
 */
router.post(
  '/:id/feedback',
  authenticate,
  authorize('citizen'),
  validate(idParamSchema, 'params'),
  validate(citizenFeedbackSchema, 'body'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rating, feedback_text } = req.body;
    const userId = req.user!.id;

    const complaint = await complaintService.addCitizenFeedback(
      id,
      userId,
      rating,
      feedback_text
    );

    res.json({
      success: true,
      data: complaint,
      message: 'Thank you for your feedback',
    });
  })
);

/**
 * @route   POST /api/v1/complaints/:id/reclassify
 * @desc    Trigger AI reclassification
 * @access  Admin
 */
router.post(
  '/:id/reclassify',
  authenticate,
  authorize('admin'),
  aiRateLimiter,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get complaint
    const complaint = await complaintService.getComplaintById(id);

    // Import and run classification
    const { classifyAndProcessComplaint } = await import('../services/aiClassification.js');
    
    const result = await classifyAndProcessComplaint(
      id,
      complaint.description,
      complaint.location_lat || undefined,
      complaint.location_lng || undefined,
      complaint.location_address || undefined
    );

    // Update complaint with new classification
    await supabaseAdmin
      .from('complaints')
      .update({
        department_id: result.departmentId,
        urgency: result.classification.urgency,
        ai_confidence: result.classification.confidence,
        ai_reasoning: result.classification.reasoning,
        ai_classified_at: new Date().toISOString(),
        is_critical_area: result.isCriticalArea,
      })
      .eq('id', id);

    res.json({
      success: true,
      data: {
        classification: result.classification,
        is_auto_approved: result.isAutoApproved,
      },
      message: 'Reclassification completed',
    });
  })
);

export default router;
