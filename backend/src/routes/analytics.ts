import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import analyticsService from '../services/analyticsService.js';
import slaService from '../services/slaService.js';

const router = Router();

/**
 * @route   GET /api/v1/analytics/dashboard
 * @desc    Get dashboard statistics
 * @access  Admin
 */
router.get(
  '/dashboard',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req, res) => {
    const stats = await analyticsService.getDashboardStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @route   GET /api/v1/analytics/departments
 * @desc    Get complaints by department
 * @access  Admin
 */
router.get(
  '/departments',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req, res) => {
    const data = await analyticsService.getComplaintsByDepartment();

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * @route   GET /api/v1/analytics/ai-performance
 * @desc    Get AI classification performance metrics
 * @access  Admin
 */
router.get(
  '/ai-performance',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const data = await analyticsService.getAIPerformanceMetrics(days);

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * @route   GET /api/v1/analytics/trends
 * @desc    Get complaints trend over time
 * @access  Admin
 */
router.get(
  '/trends',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const groupBy = (req.query.group_by as 'day' | 'week' | 'month') || 'day';
    
    const data = await analyticsService.getComplaintsTrend(days, groupBy);

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * @route   GET /api/v1/analytics/urgency
 * @desc    Get urgency distribution
 * @access  Admin
 */
router.get(
  '/urgency',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req, res) => {
    const data = await analyticsService.getUrgencyDistribution();

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * @route   GET /api/v1/analytics/resolution-time
 * @desc    Get average resolution time by department
 * @access  Admin
 */
router.get(
  '/resolution-time',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req, res) => {
    const data = await analyticsService.getResolutionTimeByDepartment();

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * @route   GET /api/v1/analytics/geographic
 * @desc    Get geographic distribution of complaints
 * @access  Admin
 */
router.get(
  '/geographic',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req, res) => {
    const data = await analyticsService.getGeographicDistribution();

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * @route   GET /api/v1/analytics/satisfaction
 * @desc    Get citizen satisfaction metrics
 * @access  Admin
 */
router.get(
  '/satisfaction',
  authenticate,
  authorize('admin'),
  asyncHandler(async (_req, res) => {
    const data = await analyticsService.getCitizenSatisfaction();

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * @route   GET /api/v1/analytics/sla
 * @desc    Get SLA statistics
 * @access  Admin, Department
 */
router.get(
  '/sla',
  authenticate,
  authorize('admin', 'department'),
  asyncHandler(async (req, res) => {
    const departmentId = req.user!.role === 'department' 
      ? req.user!.department_id || undefined
      : req.query.department_id as string;

    const data = await slaService.getSLAStatistics(departmentId);

    res.json({
      success: true,
      data,
    });
  })
);

export default router;
