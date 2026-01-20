import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  API_PORT: Joi.number().default(3000),
  API_HOST: Joi.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: Joi.string().required().description('PostgreSQL connection string'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_DB: Joi.number().default(0),

  // Keycloak / OIDC
  KEYCLOAK_ISSUER: Joi.string().required(),
  KEYCLOAK_REALM: Joi.string().required(),
  KEYCLOAK_CLIENT_ID: Joi.string().required(),
  KEYCLOAK_CLIENT_SECRET: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),

  // UCCX
  UCCX_HOST: Joi.string().required(),
  UCCX_PORT: Joi.number().default(8443),
  UCCX_USERNAME: Joi.string().required(),
  UCCX_PASSWORD: Joi.string().required(),
  UCCX_SYNC_INTERVAL_SECONDS: Joi.number().default(600),

  // MediaSense
  MEDIASENSE_HOST: Joi.string().required(),
  MEDIASENSE_PORT: Joi.number().default(8443),
  MEDIASENSE_USERNAME: Joi.string().required(),
  MEDIASENSE_PASSWORD: Joi.string().required(),
  MEDIASENSE_BATCH_SIZE: Joi.number().default(100),

  // OpenSearch
  OPENSEARCH_HOST: Joi.string().required(),
  OPENSEARCH_PORT: Joi.number().default(9200),
  OPENSEARCH_USERNAME: Joi.string().optional(),
  OPENSEARCH_PASSWORD: Joi.string().optional(),
  OPENSEARCH_USE_SSL: Joi.boolean().default(true),

  // CORS
  CORS_ORIGIN: Joi.string().default('http://localhost:5173,http://localhost:3000'),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'trace')
    .default('info'),

  // App
  APP_NAME: Joi.string().default('Cisco QMS'),
  APP_VERSION: Joi.string().default('1.0.0'),
});
