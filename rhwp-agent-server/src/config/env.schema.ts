import * as Joi from 'joi';

export const envSchema = Joi.object({
  PORT: Joi.number().default(3000),

  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_MODEL: Joi.string().default('gpt-5.4'),
  OPENAI_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),

  // R-4-I: SessionService 환경변수 (default + 운영 시점 조정 가능)
  SESSION_TTL_MS: Joi.number().integer().min(1000).default(1800000),
  SESSION_MAX_HISTORY: Joi.number().integer().min(1).default(50),
}).unknown(true);
