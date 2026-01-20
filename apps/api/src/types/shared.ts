// Shared types for API (copied from packages/shared to avoid monorepo complexity)

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

// Search request
export interface SearchRequest {
  query?: string;
  filters?: SearchFilters;
  sort?: { field: string; order: 'asc' | 'desc' };
  page?: number;
  pageSize?: number;
}

// Search filters
export interface SearchFilters {
  agentIds?: string[];
  teamCodes?: string[];
  startDate?: Date;
  endDate?: Date;
  direction?: 'inbound' | 'outbound';
  [key: string]: any;
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
