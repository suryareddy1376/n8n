import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Environment validation schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  API_VERSION: z.string().default('v1'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Gemini AI
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default('gemini-pro'),
  AI_CONFIDENCE_THRESHOLD: z.string().transform(Number).default('0.75'),

  // n8n
  N8N_WEBHOOK_BASE_URL: z.string().url(),
  N8N_WEBHOOK_SECRET: z.string().min(1),

  // Security
  JWT_SECRET: z.string().min(32).optional(),
  WEBHOOK_SECRET: z.string().min(16),
  CORS_ORIGINS: z.string().transform((val) => val.split(',')).default('http://localhost:3000'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['combined', 'dev', 'json']).default('combined'),

  // File Upload
  MAX_FILE_SIZE_MB: z.string().transform(Number).default('10'),
  ALLOWED_FILE_TYPES: z.string().transform((val) => val.split(',')).default('image/jpeg,image/png,image/webp'),

  // SLA
  SLA_CHECK_INTERVAL_MINUTES: z.string().transform(Number).default('15'),
  SLA_WARNING_HOURS_BEFORE: z.string().transform(Number).default('6'),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => e.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables: ${missingVars}`);
    }
    throw error;
  }
};

export const env = parseEnv();

// Configuration object with grouped settings
export const config = {
  server: {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    apiVersion: env.API_VERSION,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
  },

  supabase: {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  },

  ai: {
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL,
    confidenceThreshold: env.AI_CONFIDENCE_THRESHOLD,
  },

  n8n: {
    webhookBaseUrl: env.N8N_WEBHOOK_BASE_URL,
    webhookSecret: env.N8N_WEBHOOK_SECRET,
  },

  security: {
    jwtSecret: env.JWT_SECRET,
    webhookSecret: env.WEBHOOK_SECRET,
    corsOrigins: env.CORS_ORIGINS,
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },

  upload: {
    maxFileSizeMb: env.MAX_FILE_SIZE_MB,
    maxFileSizeBytes: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    allowedFileTypes: env.ALLOWED_FILE_TYPES,
  },

  sla: {
    checkIntervalMinutes: env.SLA_CHECK_INTERVAL_MINUTES,
    warningHoursBefore: env.SLA_WARNING_HOURS_BEFORE,
  },
} as const;

export type Config = typeof config;
