// Role definitions
export enum Role {
  ADMIN = 'ADMIN',
  QA = 'QA',
  SUPERVISOR = 'SUPERVISOR',
  USER = 'USER',
}

// User claims from Keycloak
export interface UserClaims {
  sub: string; // User ID
  preferred_username: string; // AD login == agentId
  email?: string;
  name?: string;
  roles: Role[];
}

// Recording metadata
export interface RecordingMetadata {
  id: string;
  mediasenseRecordingId: string;
  agentId: string;
  teamCode: string;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  callId?: string;
  contactId?: string;
  direction: 'inbound' | 'outbound';
  ani?: string;
  dnis?: string;
  csq?: string;
  wrapUpReason?: string;
  transferCount?: number;
  holdTimeSeconds?: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Chat metadata
export interface ChatMetadata {
  id: string;
  agentId: string;
  teamCode: string;
  contactId?: string;
  startTime: Date;
  endTime?: Date;
  participants: string[];
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Scorecard template
export interface ScorecardTemplate {
  id: string;
  name: string;
  version: number;
  description?: string;
  sections: ScorecardSection[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScorecardSection {
  id: string;
  title: string;
  questions: ScorecardQuestion[];
}

export interface ScorecardQuestion {
  id: string;
  text: string;
  weight: number;
  maxScore: number;
  isFatal: boolean;
  allowNA: boolean;
}

// Evaluation
export interface Evaluation {
  id: string;
  recordingId?: string;
  chatId?: string;
  scorecardTemplateId: string;
  evaluatorId: string;
  agentId: string;
  teamCode: string;
  status: 'DRAFT' | 'SUBMITTED' | 'ACKNOWLEDGED' | 'DISPUTED' | 'RESOLVED';
  responses: EvaluationResponse[];
  totalScore?: number;
  comments?: string;
  bookmarks?: EvaluationBookmark[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EvaluationResponse {
  questionId: string;
  score?: number;
  comment?: string;
  isNA: boolean;
}

export interface EvaluationBookmark {
  timestamp: number; // seconds
  comment?: string;
}

// Dispute
export interface Dispute {
  id: string;
  evaluationId: string;
  userId: string;
  comment: string;
  resolvedBy?: string;
  resolutionComment?: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: Date;
  updatedAt: Date;
}

// Coaching plan
export interface CoachingPlan {
  id: string;
  evaluationId: string;
  agentId: string;
  supervisorId: string;
  actionItems: CoachingActionItem[];
  followUpEvaluationId?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
}

export interface CoachingActionItem {
  id: string;
  description: string;
  dueDate: Date;
  completedAt?: Date;
}

// Sampling rule
export interface SamplingRule {
  id: string;
  name: string;
  description?: string;
  samplePercentage: number;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  criteria: SamplingCriteria;
  assignedQAs: string[]; // User IDs
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SamplingCriteria {
  minDurationSeconds?: number;
  minHoldTimeSeconds?: number;
  minTransferCount?: number;
  wrapUpReasons?: string[];
  csqs?: string[];
  teams?: string[];
  agents?: string[];
}

// Agent (from UCCX)
export interface Agent {
  id: string;
  agentId: string; // AD login
  fullName: string;
  email?: string;
  activeFlag: boolean;
  teamCodes: string[];
  skills: AgentSkill[];
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
}

export interface AgentSkill {
  skillId: string;
  skillName: string;
  proficiency?: number;
}

// Team (from UCCX)
export interface Team {
  id: string;
  teamCode: string;
  displayName: string;
  description?: string;
  supervisorIds: string[];
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
}

// Daily statistics (from UCCX)
export interface DailyAgentStats {
  id: string;
  agentId: string;
  date: Date;
  callsHandled: number;
  avgHandleTime: number;
  holdTime: number;
  transfers: number;
  wrapUpCounts: Record<string, number>;
}

// Audit log
export interface AuditLog {
  id: string;
  userId: string;
  userRole: Role;
  action: 'LOGIN' | 'SEARCH' | 'RECORD_VIEW' | 'PLAYBACK_START' | 'EVALUATION_CREATED' | 'COACHING_CREATED';
  resourceId?: string;
  filters?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Search request
export interface SearchRequest {
  query?: string;
  filters: SearchFilters;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchFilters {
  dateFrom?: Date;
  dateTo?: Date;
  agentIds?: string[];
  teamCodes?: string[];
  csqs?: string[];
  callIds?: string[];
  anis?: string[];
  dnis?: string[];
  wrapUpReasons?: string[];
}

// Keycloak integration
export interface KeycloakUser {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
}

// MediaSense API response
export interface MediaSenseRecording {
  recordingId: string;
  agentId: string;
  contactId: string;
  startTime: string;
  endTime: string;
  duration: number;
  direction: string;
  ani: string;
  dnis: string;
  mediaTypeId: number;
  metadata: Record<string, any>;
  archived: boolean;
}

export * from './constants';
