import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(5000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test', 'provision').default('development'),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  STRIPE_SECRET_KEY: Joi.string().allow('').optional(),
  RESEND_API_KEY: Joi.string().allow('').optional(),
});
