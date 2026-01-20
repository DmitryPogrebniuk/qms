// UI Language constants
export const SUPPORTED_LANGUAGES = {
  UK: 'uk',
  EN: 'en',
} as const;

export const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES.UK;

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Search defaults
export const DEFAULT_SEARCH_PRESET = 'week'; // yesterday | week | month | custom

// Audit constants
export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  SEARCH: 'SEARCH',
  RECORD_VIEW: 'RECORD_VIEW',
  PLAYBACK_START: 'PLAYBACK_START',
  EVALUATION_CREATED: 'EVALUATION_CREATED',
  COACHING_CREATED: 'COACHING_CREATED',
} as const;

// Role-based access control
export const RBAC_RULES = {
  ADMIN: {
    canAccessAll: true,
    canManageUsers: true,
    canManageSystemConfig: true,
    canAccessMediaStream: true,
  },
  QA: {
    canAccessAll: true,
    canAccessMediaStream: true,
    canCreateEvaluations: true,
    canCreateCoaching: true,
    canResolveDisputes: true,
  },
  SUPERVISOR: {
    canAccessTeamOnly: true,
    canAccessMediaStream: true,
    canCreateEvaluations: true,
    canCreateCoaching: true,
  },
  USER: {
    canAccessOwnOnly: true,
    canViewEvaluations: true,
    canAcknowledgeEvaluations: true,
    canSubmitDisputes: true,
  },
} as const;

// Streaming constants
export const STREAMING_CONFIG = {
  MAX_CONCURRENT_STREAMS_PER_USER: 3,
  READ_TIMEOUT_SECONDS: 300,
  BUFFER_SIZE: 65536, // 64KB
} as const;

// Sampling engine defaults
export const SAMPLING_DEFAULTS = {
  MIN_SAMPLE_PERCENTAGE: 5,
  MAX_SAMPLE_PERCENTAGE: 100,
  PERIOD_TYPES: ['DAILY', 'WEEKLY', 'MONTHLY'],
} as const;

// OpenSearch defaults
export const OPENSEARCH_CONFIG = {
  INDEX_PREFIX: 'recordings-',
  ALIAS_NAME: 'recordings-current',
  INDEX_PATTERN: 'recordings-YYYY.MM',
} as const;

// Evaluation workflow states
export const EVALUATION_STATES = ['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'DISPUTED', 'RESOLVED'] as const;

// UCCX sync intervals (in seconds)
export const UCCX_SYNC = {
  FULL_SYNC_INTERVAL: 86400, // 24 hours
  INCREMENTAL_SYNC_INTERVAL: 600, // 10 minutes
  RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_MS: 5000,
} as const;

// MediaSense sync constants
export const MEDIASENSE_SYNC = {
  BATCH_SIZE: 100,
  WATERMARK_KEY: 'lastModified',
  EXPECTED_DAILY_RECORDINGS: 10000,
} as const;
