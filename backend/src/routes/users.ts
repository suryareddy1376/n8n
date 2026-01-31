import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, updateUserSchema, idParamSchema } from '../middleware/validation.js';
import { supabaseAdmin } from '../utils/supabase.js';
import { handleDatabaseError, NotFoundError, AuthorizationError } from '../utils/errors.js';

const router = Router();

/**
 * @route   GET /api/v1/users/me
 * @desc    Get current user profile
 * @access  Authenticated
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const { data, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        department:departments(id, name, code)
      `)
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundError('User');
    }

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * @route   PUT /api/v1/users/me
 * @desc    Update current user profile
 * @access  Authenticated
 */
router.put(
  '/me',
  authenticate,
  validate(updateUserSchema, 'body'),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const updates = req.body;

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw handleDatabaseError(error);
    }

    res.json({
      success: true,
      data,
      message: 'Profile updated successfully',
    });
  })
);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Admin
 */
router.get(
  '/:id',
  authenticate,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Only admins can view other users
    if (req.user!.role !== 'admin' && req.user!.id !== id) {
      throw new AuthorizationError('Cannot view other user profiles');
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        department:departments(id, name, code)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundError('User', id);
    }

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * @route   GET /api/v1/users/me/notifications
 * @desc    Get current user's notifications
 * @access  Authenticated
 */
router.get(
  '/me/notifications',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const unreadOnly = req.query.unread === 'true';

    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

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
 * @route   POST /api/v1/users/me/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Authenticated
 */
router.post(
  '/me/notifications/:id/read',
  authenticate,
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw handleDatabaseError(error);
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  })
);

/**
 * @route   POST /api/v1/users/me/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Authenticated
 */
router.post(
  '/me/notifications/read-all',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      throw handleDatabaseError(error);
    }

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  })
);

export default router;
