/**
 * Recordings API Service
 * Provides type-safe access to the recordings search, stream, and export APIs
 */

import { httpClient } from '../hooks/useHttpClient';

// ============================================================================
// Types
// ============================================================================

export interface RecordingSearchParams {
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  datePreset?: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth';
  durationMin?: number;
  durationMax?: number;
  direction?: 'inbound' | 'outbound' | 'internal';
  hasAudio?: boolean;
  agents?: string[];
  teams?: string[];
  queues?: string[];
  tags?: string[];
  ani?: string;
  dnis?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface RecordingParticipant {
  id: string;
  role: string;
  deviceRef: string;
  ani?: string;
  dnis?: string;
  name?: string;
  joinTime?: string;
  leaveTime?: string;
  durationSeconds?: number;
}

export interface RecordingTag {
  id: string;
  tagName: string;
  tagValue?: string;
  name?: string; // alias for tagName (display)
  color?: string; // alias for tagValue
  createdAt: string;
  createdBy?: string;
}

export interface RecordingNote {
  id: string;
  noteText: string;
  text?: string; // alias for noteText (display)
  timestamp?: number;
  createdAt: string;
  createdBy?: string;
}

export interface Recording {
  id: string;
  mediasenseSessionId?: string;
  agentId?: string;
  agentName?: string;
  teamCode?: string;
  teamName?: string;
  startTime?: string;
  endTime?: string;
  durationSeconds?: number;
  direction?: string;
  ani?: string;
  dnis?: string;
  callerName?: string;
  calledName?: string;
  csq?: string;
  queueName?: string;
  skillGroup?: string;
  wrapUpReason?: string;
  callId?: string;
  hasAudio: boolean;
  audioUrl?: string;
  audioFormat?: string;
  audioCodec?: string;
  audioSampleRate?: number;
  audioChannels?: number;
  audioBitrate?: number;
  fileSize?: number;
  trackCount?: number;
  sessionType?: string;
  sessionState?: string;
  ccmid?: string;
  ucmid?: string;
  callManagerId?: string;
  clusterId?: string;
  routePointDn?: string;
  routePointPartition?: string;
  originatingDeviceName?: string;
  originatingLine?: string;
  destinationDeviceName?: string;
  destinationLine?: string;
  holdCount?: number;
  holdTimeSeconds?: number;
  transferCount?: number;
  conferenceCount?: number;
  silencePercentage?: number;
  talkOverPercentage?: number;
  avgSilenceDuration?: number;
  longestSilence?: number;
  onDemandRecording?: boolean;
  scheduledRecording?: boolean;
  isPaused?: boolean;
  isResumed?: boolean;
  isExported?: boolean;
  isArchived?: boolean;
  retentionDate?: string;
  mediaStreamCount?: number;
  forkedStreams?: boolean;
  createdAt: string;
  updatedAt: string;
  participants?: RecordingParticipant[];
  tags?: (RecordingTag | string)[]; // search returns string[], details return RecordingTag[]
  notes?: RecordingNote[];
  evaluations?: any[];
  _score?: number;
  _highlight?: Record<string, string[]>;
}

export interface SearchFacets {
  agents: Array<{ key: string; name?: string; count: number }>;
  teams: Array<{ key: string; name?: string; count: number }>;
  queues: Array<{ key: string; name?: string; count: number }>;
  directions: Array<{ key: string; count: number }>;
  tags: Array<{ key: string; count: number }>;
  durationBuckets: Array<{ key: string; from: number; to?: number; count: number }>;
  dateHistogram: Array<{ key: string; date: string; count: number }>;
}

export interface SearchResponse {
  items: Recording[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: SearchFacets;
  queryTime?: number;
  source?: 'opensearch' | 'postgres';
}

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface ExportJob {
  id: string;
  recordingId: string;
  format: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  downloadUrl?: string;
  fileSize?: number;
  error?: string;
  expiresAt?: string;
  createdAt: string;
  completedAt?: string;
}

export interface SyncStatus {
  state: {
    id: string;
    sourceType: string;
    isEnabled: boolean;
    isSyncing: boolean;
    lastSyncAt?: string;
    lastSyncDuration?: number;
    lastSyncError?: string;
    totalRecordsSynced: number;
    recordsSyncedToday: number;
    lastRecordTimestamp?: string;
    syncCheckpoint?: string;
    avgSyncDuration?: number;
    successRate?: number;
    createdAt: string;
    updatedAt: string;
  } | null;
  recordingsCount: number;
  recentHistory: Array<{
    id: string;
    startedAt: string;
    completedAt?: string;
    status: string;
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsFailed: number;
    error?: string;
    durationMs?: number;
  }>;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Compute dateFrom/dateTo (ISO) from datePreset.
 * Uses LOCAL timezone so "yesterday" = yesterday in user's timezone (e.g. Kyiv UTC+2).
 * Fixes mismatch when DB stores UTC and UI shows local time.
 */
function dateRangeFromPreset(preset: RecordingSearchParams['datePreset']): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  const toEndOfDayLocal = (d: Date) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    return x.toISOString();
  };
  const toStartOfDayLocal = (d: Date) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    return x.toISOString();
  };
  switch (preset) {
    case 'today':
      return { dateFrom: toStartOfDayLocal(now), dateTo: toEndOfDayLocal(now) };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { dateFrom: toStartOfDayLocal(y), dateTo: toEndOfDayLocal(y) };
    }
    case 'last7days': {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { dateFrom: toStartOfDayLocal(from), dateTo: toEndOfDayLocal(now) };
    }
    case 'last30days': {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { dateFrom: toStartOfDayLocal(from), dateTo: toEndOfDayLocal(now) };
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: toStartOfDayLocal(start), dateTo: toEndOfDayLocal(now) };
    }
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { dateFrom: toStartOfDayLocal(start), dateTo: end.toISOString() };
    }
    default:
      return {};
  }
}

/**
 * Search recordings with filters and facets
 * Maps frontend params to API: datePreset→dateFrom/dateTo, durationMin/Max→durationFrom/To, sortBy/Order→sort/order, agents/teams/queues→agentIds/teamCodes/queueIds
 */
export async function searchRecordings(params: RecordingSearchParams): Promise<SearchResponse> {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set('q', params.q);
  // API expects dateFrom/dateTo; convert datePreset to range when no explicit dates
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
  if (params.dateTo) searchParams.set('dateTo', params.dateTo);
  if (!params.dateFrom && !params.dateTo && params.datePreset) {
    const range = dateRangeFromPreset(params.datePreset);
    if (range.dateFrom) searchParams.set('dateFrom', range.dateFrom);
    if (range.dateTo) searchParams.set('dateTo', range.dateTo);
  }
  if (params.durationMin !== undefined) searchParams.set('durationFrom', String(params.durationMin));
  if (params.durationMax !== undefined) searchParams.set('durationTo', String(params.durationMax));
  if (params.direction) searchParams.set('direction', params.direction);
  if (params.hasAudio !== undefined) searchParams.set('hasAudio', String(params.hasAudio));
  if (params.agents?.length) searchParams.set('agentIds', params.agents.join(','));
  if (params.teams?.length) searchParams.set('teamCodes', params.teams.join(','));
  if (params.queues?.length) searchParams.set('queueIds', params.queues.join(','));
  if (params.tags?.length) searchParams.set('tags', params.tags.join(','));
  if (params.ani) searchParams.set('ani', params.ani);
  if (params.dnis) searchParams.set('dnis', params.dnis);
  if (params.sortBy) searchParams.set('sort', params.sortBy);
  if (params.sortOrder) searchParams.set('order', params.sortOrder);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));

  const response = await httpClient.get<SearchResponse>(`/recordings/search?${searchParams.toString()}`);
  return response.data;
}

/**
 * Get a single recording by ID
 */
export async function getRecording(id: string): Promise<Recording> {
  const response = await httpClient.get<Recording>(`/recordings/${id}`);
  return response.data;
}

/**
 * Get filter options for a specific field
 */
export async function getFilterOptions(field: string): Promise<FilterOption[]> {
  const response = await httpClient.get<FilterOption[]>(`/recordings/filter-options/${field}`);
  return response.data;
}

/**
 * Get audio stream URL for a recording
 */
export function getStreamUrl(recordingId: string): string {
  const token = localStorage.getItem('jwt_token');
  const t = token && token !== 'null' ? token : '';
  return `/api/recordings/${recordingId}/stream?token=${t}`;
}

/**
 * Download exported file (when job is COMPLETED)
 */
async function downloadExportFile(jobId: string): Promise<Blob> {
  const response = await httpClient.get<Blob>(`/recordings/exports/${jobId}/download`, {
    responseType: 'blob',
    validateStatus: () => true,
  });
  if (response.status !== 200) {
    throw new Error(`Export download failed: HTTP ${response.status}`);
  }
  const blob = response.data;
  if (blob instanceof Blob && (blob.size === 0 || (response.headers['content-type'] || '').includes('application/json'))) {
    throw new Error('MEDIASENSE_UNAVAILABLE');
  }
  return blob;
}

/**
 * Build download filename: IGTAS_YYYY-MM-DD_HH-MM-SS_DNIS_ANI.ext
 */
export function buildDownloadFilename(recording: Recording, format: string = 'mp3'): string {
  const d = recording.startTime ? new Date(recording.startTime) : new Date();
  const dateStr = d.toISOString().slice(0, 10);
  const timeStr = d.toISOString().slice(11, 19).replace(/:/g, '-');
  const dnis = (recording.dnis || '').replace(/[^0-9+]/g, '') || 'unknown';
  const ani = (recording.ani || '').replace(/[^0-9+]/g, '') || 'unknown';
  return `IGTAS_${dateStr}_${timeStr}_${dnis}_${ani}.${format}`;
}

/**
 * Download recording as MP3 (or wav/ogg).
 * Handles 202 (async export): polls until ready, then downloads.
 */
export async function downloadRecording(recordingId: string, format: string = 'mp3'): Promise<Blob> {
  const response = await httpClient.get<Blob>(`/recordings/${recordingId}/download?format=${format}`, {
    responseType: 'blob',
    validateStatus: () => true,
  });
  if (response.status === 503) {
    throw new Error('MEDIASENSE_UNAVAILABLE');
  }
  if (response.status === 202) {
    // Async export in progress — parse jobId and poll until ready
    const text = await (response.data as Blob).text();
    let json: { jobId?: string };
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('EXPORT_PROCESSING');
    }
    const jobId = json.jobId;
    if (!jobId) throw new Error('EXPORT_PROCESSING');
    const maxAttempts = 60;
    const intervalMs = 2000;
    for (let i = 0; i < maxAttempts; i++) {
      const job = await getExportStatus(jobId);
      const status = (job.status || '').toUpperCase();
      if (status === 'COMPLETED') {
        return downloadExportFile(jobId);
      }
      if (status === 'FAILED') {
        throw new Error(job.error || 'Export failed');
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('EXPORT_TIMEOUT');
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.status === 400 ? 'DOWNLOAD_BAD_REQUEST' : `HTTP ${response.status}`);
  }
  const blob = response.data;
  const contentType = response.headers['content-type'] || '';
  if (blob instanceof Blob) {
    if (blob.size === 0) {
      throw new Error('MEDIASENSE_UNAVAILABLE');
    }
    if (contentType.includes('application/json')) {
      throw new Error('MEDIASENSE_UNAVAILABLE');
    }
  }
  return blob;
}

/**
 * Start async export job for large recordings
 */
export async function startExport(
  recordingId: string,
  format: string = 'mp3',
  options?: { bitrate?: number; sampleRate?: number; mono?: boolean }
): Promise<ExportJob> {
  const response = await httpClient.post<ExportJob>(`/recordings/${recordingId}/export`, {
    format,
    ...options,
  });
  return response.data;
}

/**
 * Get export job status
 */
export async function getExportStatus(jobId: string): Promise<ExportJob> {
  const response = await httpClient.get<ExportJob>(`/recordings/exports/${jobId}`);
  return response.data;
}

/**
 * Add tag to recording
 */
export async function addTag(recordingId: string, name: string, color?: string): Promise<RecordingTag> {
  const response = await httpClient.post<RecordingTag>(`/recordings/${recordingId}/tags`, {
    tagName: name,
    tagValue: color,
  });
  return response.data;
}

/**
 * Remove tag from recording
 */
export async function removeTag(recordingId: string, tagId: string): Promise<void> {
  await httpClient.delete(`/recordings/${recordingId}/tags/${tagId}`);
}

/**
 * Add note to recording
 */
export async function addNote(recordingId: string, text: string, timestamp?: number): Promise<RecordingNote> {
  const response = await httpClient.post<RecordingNote>(`/recordings/${recordingId}/notes`, {
    noteText: text,
    timestamp,
  });
  return response.data;
}

/**
 * Remove note from recording
 */
export async function removeNote(recordingId: string, noteId: string): Promise<void> {
  await httpClient.delete(`/recordings/${recordingId}/notes/${noteId}`);
}

/**
 * Log playback event (for analytics)
 */
export async function logPlayback(
  recordingId: string,
  event: 'play' | 'pause' | 'seek' | 'complete',
  position?: number
): Promise<void> {
  await httpClient.post(`/recordings/${recordingId}/playback`, { event, position });
}

// ============================================================================
// Admin API Functions
// ============================================================================

/**
 * Get sync status (admin only)
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const response = await httpClient.get<SyncStatus>('/recordings/admin/sync-status');
  return response.data;
}

/**
 * Trigger manual sync (admin only)
 */
export async function triggerSync(): Promise<{ message: string }> {
  const response = await httpClient.post<{ message: string }>('/recordings/admin/sync-now');
  return response.data;
}

/**
 * Reset sync state (admin only)
 */
export async function resetSync(backfillDays?: number): Promise<{ message: string }> {
  const response = await httpClient.post<{ message: string }>('/recordings/admin/sync-reset', { backfillDays });
  return response.data;
}

/**
 * Reconcile sync - check MediaSense for period, import missing records (admin only)
 */
export interface ReconcileSyncResult {
  success: boolean;
  correlationId: string;
  duration: number;
  stats: { fetched: number; created: number; updated: number; skipped: number; errors: number };
  error?: string;
}

export async function reconcileSync(dateFrom: string, dateTo: string): Promise<ReconcileSyncResult> {
  const response = await httpClient.post<ReconcileSyncResult>('/recordings/admin/sync-reconcile', {
    dateFrom,
    dateTo,
  });
  return response.data;
}

/**
 * Sync diagnostics response (admin only)
 */
export interface SyncDiagnostics {
  config: { enabled: boolean; apiUrlMasked?: string };
  syncState: {
    backfillComplete: boolean;
    lastSyncTime?: string;
    status?: string;
    totalFetched: number;
    totalCreated: number;
  } | null;
  recordingCount: number;
  testFetch: {
    fromTime: string;
    toTime: string;
    count: number;
    error?: string;
    hint?: string;
  };
}

/**
 * Get sync diagnostics for troubleshooting (admin only)
 */
export async function getSyncDiagnostics(): Promise<SyncDiagnostics> {
  const response = await httpClient.get<SyncDiagnostics>('/recordings/admin/sync-diagnostics');
  return response.data;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds?: number): string {
  if (!seconds) return '00:00';

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Get direction display name
 */
export function getDirectionLabel(direction?: string): string {
  switch (direction) {
    case 'inbound':
      return 'Inbound';
    case 'outbound':
      return 'Outbound';
    case 'internal':
      return 'Internal';
    default:
      return direction || 'Unknown';
  }
}

/**
 * Parse date preset to date range
 */
export function parseDatePreset(preset: string): { from: Date; to: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(today);
  to.setDate(to.getDate() + 1); // End of today

  switch (preset) {
    case 'today':
      return { from: today, to };
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: yesterday, to: today };
    case 'last7days':
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 7);
      return { from: last7, to };
    case 'last30days':
      const last30 = new Date(today);
      last30.setDate(last30.getDate() - 30);
      return { from: last30, to };
    case 'thisMonth':
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: thisMonth, to };
    case 'lastMonth':
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: lastMonth, to: lastMonthEnd };
    default:
      return { from: today, to };
  }
}
