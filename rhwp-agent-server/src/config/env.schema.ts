import * as Joi from 'joi';

export const envSchema = Joi.object({
  PORT: Joi.number().default(3000),

  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_MODEL: Joi.string().default('gpt-5.4'),
  OPENAI_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
}).unknown(true);
