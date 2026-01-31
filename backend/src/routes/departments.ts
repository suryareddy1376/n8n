import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, createDepartmentSchema, idParamSchema } from '../middleware/validation.js';
import { supabaseAdmin } from '../utils/supabase.js';
import { handleDatabaseError, NotFoundError } from '../utils/errors.js';

const router = Router();

/**
 * @route   GET /api/v1/departments
 * @desc    Get all departments
 * @access  Authenticated
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from('departments')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw handleDatabaseError(error);
    }

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * @route   GET /api/v1/departments/:id
 * @desc    Get department by ID
 * @access  Authenticated
 */
router.get(
  '/:id',
  authenticate,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('departments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Department', id);
    }

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * @route   GET /api/v1/departments/:id/users
 * @desc    Get users in a department
 * @access  Admin, Department
 */
router.get(
  '/:id/users',
  authenticate,
  authorize('admin', 'department'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Department users can only see their own department
    if (req.user!.role === 'department' && req.user!.department_id !== id) {
      throw new NotFoundError('Department', id);
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, is_active, created_at')
      .eq('department_id', id)
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      throw handleDatabaseError(error);
    }

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * @route   POST /api/v1/departments
 * @desc    Create a new department
 * @access  Admin
 */
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate(createDepartmentSchema, 'body'),
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('departments')
      .insert(req.body)
      .select()
      .single();

    if (error) {
      throw handleDatabaseError(error);
    }

    res.status(201).json({
      success: true,
      data,
      message: 'Department created successfully',
    });
  })
);

/**
 * @route   PUT /api/v1/departments/:id
 * @desc    Update a department
 * @access  Admin
 */
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validate(idParamSchema, 'params'),
  validate(createDepartmentSchema, 'body'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('departments')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw handleDatabaseError(error);
    }

    if (!data) {
      throw new NotFoundError('Department', id);
    }

    res.json({
      success: true,
      data,
      message: 'Department updated successfully',
    });
  })
);

/**
 * @route   DELETE /api/v1/departments/:id
 * @desc    Deactivate a department (soft delete)
 * @access  Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('departments')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      throw handleDatabaseError(error);
    }

    res.json({
      success: true,
      message: 'Department deactivated successfully',
    });
  })
);

export default router;
