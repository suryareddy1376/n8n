import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { logger } from './logger.js';

// Supabase client for authenticated user operations (uses anon key)
export const supabaseClient = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
  }
);

// Supabase admin client for backend operations (uses service role key)
// This client bypasses RLS policies
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Create authenticated client with user's JWT
export const createAuthenticatedClient = (accessToken: string): SupabaseClient => {
  return createClient(config.supabase.url, config.supabase.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Health check for Supabase connection
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('departments')
      .select('id')
      .limit(1);

    if (error) {
      logger.error('Supabase connection check failed:', error);
      return false;
    }

    logger.info('Supabase connection verified');
    return true;
  } catch (error) {
    logger.error('Supabase connection error:', error);
    return false;
  }
};

export default supabaseAdmin;
