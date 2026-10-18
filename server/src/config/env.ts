import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  CLIENT_URL_EXTRA: z.string().optional(), // comma-separated extra allowed origins
  
  // Database
  DATABASE_URL: z.string().url(),

  // Redis (Upstash REST — serverless-friendly, no TCP connection overhead)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Auth
  ACCESS_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRES_HOURS: z.coerce.number().min(2).max(4).default(3),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().min(1).max(30).default(7),
  REFRESH_TOKEN_COOKIE_NAME: z.string().default('mollari_refresh_token'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  
  // Keycloak
  KEYCLOAK_REALM_URL: z.string().url().optional(),
  KEYCLOAK_CLIENT_ID: z.string().optional(),
  KEYCLOAK_CLIENT_SECRET: z.string().optional(),
  
  // SSLCommerz
  SSLCOMMERZ_STORE_ID: z.string().default('testbox'),
  SSLCOMMERZ_STORE_PASSWD: z.string().default('qwerty'),
  SSLCOMMERZ_IS_LIVE: z.string().transform(v => v === 'true').default('false'),
  SSLCOMMERZ_SUCCESS_URL: z.string().url().default('http://localhost:4000/api/payments/sslcommerz/success'),
  SSLCOMMERZ_FAIL_URL: z.string().url().default('http://localhost:4000/api/payments/sslcommerz/fail'),
  SSLCOMMERZ_CANCEL_URL: z.string().url().default('http://localhost:4000/api/payments/sslcommerz/cancel'),
  SSLCOMMERZ_IPN_URL: z.string().url().default('http://localhost:4000/api/payments/sslcommerz/ipn'),
  
  // File uploads
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(5),
  
  // Misc
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  TZ: z.string().default('Asia/Dhaka'),
});

export type Environment = z.infer<typeof envSchema>;

let env: Environment | null = null;

export function loadEnv(): Environment {
  if (env) return env;
  
  try {
    env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Environment validation failed:');
      error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw new Error('Invalid environment variables');
  }
}

export function getEnv(): Environment {
  if (!env) {
    loadEnv();
  }
  return env!;
}
