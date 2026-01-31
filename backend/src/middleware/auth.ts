import { Request, Response, NextFunction } from 'express';
import { createAuthenticatedClient, supabaseAdmin } from '../utils/supabase.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';
import { AuthenticatedUser, UserRole } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      supabase?: ReturnType<typeof createAuthenticatedClient>;
    }
  }
}

// Extract and verify JWT from Authorization header
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      logger.warn('Token verification failed:', { error: error?.message });
      throw new AuthenticationError('Invalid or expired token');
    }

    // Get user profile from database
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, email, role, department_id, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      logger.error('User profile not found:', { userId: user.id, error: profileError });
      throw new AuthenticationError('User profile not found');
    }

    if (!userProfile.is_active) {
      throw new AuthorizationError('User account is deactivated');
    }

    // Attach authenticated user to request
    req.user = {
      id: userProfile.id,
      email: userProfile.email,
      role: userProfile.role as UserRole,
      department_id: userProfile.department_id,
    };

    // Create authenticated Supabase client for this request
    req.supabase = createAuthenticatedClient(token);

    next();
  } catch (error) {
    next(error);
  }
};

// Role-based access control middleware factory
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn('Access denied:', {
          userId: req.user.id,
          role: req.user.role,
          requiredRoles: allowedRoles,
          path: req.path,
        });
        throw new AuthorizationError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Check if user owns the resource or is admin
export const authorizeOwnerOrAdmin = (
  getOwnerId: (req: Request) => Promise<string | null>
) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      // Admins have full access
      if (req.user.role === 'admin') {
        return next();
      }

      const ownerId = await getOwnerId(req);

      if (!ownerId || ownerId !== req.user.id) {
        throw new AuthorizationError('Access denied to this resource');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Check if user belongs to the same department as the complaint
export const authorizeDepartment = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    // Admins have full access
    if (req.user.role === 'admin') {
      return next();
    }

    // Department users can only access their department's complaints
    if (req.user.role === 'department') {
      const complaintId = req.params.id;

      if (!complaintId) {
        throw new AuthorizationError('Complaint ID required');
      }

      const { data: complaint, error } = await supabaseAdmin
        .from('complaints')
        .select('department_id')
        .eq('id', complaintId)
        .single();

      if (error || !complaint) {
        throw new AuthorizationError('Complaint not found');
      }

      if (complaint.department_id !== req.user.department_id) {
        throw new AuthorizationError('Access denied. Complaint belongs to different department.');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Optional authentication - doesn't fail if no token provided
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (user) {
      const { data: userProfile } = await supabaseAdmin
        .from('users')
        .select('id, email, role, department_id')
        .eq('id', user.id)
        .single();

      if (userProfile) {
        req.user = {
          id: userProfile.id,
          email: userProfile.email,
          role: userProfile.role as UserRole,
          department_id: userProfile.department_id,
        };
        req.supabase = createAuthenticatedClient(token);
      }
    }

    next();
  } catch {
    // Silently continue without authentication
    next();
  }
};
