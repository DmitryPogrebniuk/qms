import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { OpenSearchService } from '../opensearch/opensearch.service';
import { ConfigService } from '@nestjs/config';

/**
 * Recording Search Service
 * 
 * Provides advanced search capabilities using OpenSearch (primary) or Postgres (fallback)
 * Supports full-text search, faceted filtering, and role-based access control
 */

export interface SearchFilters {
  q?: string; // Full-text search query
  dateFrom?: Date;
  dateTo?: Date;
  durationFrom?: number; // seconds
  durationTo?: number;
  direction?: string | string[];
  agentIds?: string[];
  teamCodes?: string[];
  queueIds?: string[]; // CSQ
  ani?: string;
  dnis?: string;
  callId?: string;
  sessionId?: string;
  tags?: string[];
  hasAudio?: boolean;
  wrapUpReasons?: string[];
}

export interface SearchSort {
  field: 'startTime' | 'endTime' | 'duration' | 'score';
  order: 'asc' | 'desc';
}

export interface SearchRequest {
  filters: SearchFilters;
  sort?: SearchSort;
  page: number;
  pageSize: number;
}

export interface AccessControl {
  role: string;
  userId: string;
  agentId?: string;
  teamCodes?: string[];
}

export interface FacetBucket {
  key: string;
  count: number;
  label?: string;
}

export interface SearchFacets {
  agents: FacetBucket[];
  teams: FacetBucket[];
  queues: FacetBucket[];
  directions: FacetBucket[];
  tags: FacetBucket[];
  durationBuckets: FacetBucket[];
  dateHistogram: FacetBucket[];
  wrapUpReasons: FacetBucket[];
}

export interface RecordingSearchResult {
  id: string;
  mediasenseSessionId: string;
  startTime: Date;
  endTime?: Date;
  durationSeconds: number;
  direction: string;
  ani?: string;
  dnis?: string;
  agentId?: string;
  agentName?: string;
  teamCode?: string;
  teamName?: string;
  csq?: string;
  queueName?: string;
  wrapUpReason?: string;
  hasAudio: boolean;
  callId?: string;
  tags?: string[];
  score?: number; // relevance score for full-text search
  hasEvaluation?: boolean;
}

export interface SearchResponse {
  items: RecordingSearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets?: SearchFacets;
  searchTime?: number;
}

@Injectable()
export class RecordingsSearchService {
  private readonly logger = new Logger('RecordingsSearchService');
  private readonly useOpenSearch: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly openSearchService: OpenSearchService,
    private readonly configService: ConfigService,
  ) {
    this.useOpenSearch = Boolean(configService.get<string>('OPENSEARCH_HOST'));
  }

  /**
   * Search recordings with access control
   */
  async search(
    request: SearchRequest,
    accessControl: AccessControl,
  ): Promise<SearchResponse> {
    const startTime = Date.now();

    // Apply RBAC to filters
    const rbacFilters = this.applyAccessControl(request.filters, accessControl);

    let response: SearchResponse;

    if (this.useOpenSearch) {
      try {
        response = await this.searchOpenSearch(rbacFilters, request.sort, request.page, request.pageSize);
      } catch (error) {
        this.logger.warn('OpenSearch search failed, falling back to Postgres', { error: (error as Error).message });
        response = await this.searchPostgres(rbacFilters, request.sort, request.page, request.pageSize);
      }
    } else {
      response = await this.searchPostgres(rbacFilters, request.sort, request.page, request.pageSize);
    }

    response.searchTime = Date.now() - startTime;
    return response;
  }

  /**
   * Apply role-based access control to search filters
   */
  private applyAccessControl(filters: SearchFilters, access: AccessControl): SearchFilters {
    const result = { ...filters };

    switch (access.role) {
      case 'ADMIN':
      case 'QA':
        // Full access - no additional filters
        break;

      case 'SUPERVISOR':
        // Can only see their teams
        if (access.teamCodes && access.teamCodes.length > 0) {
          // If user specified teams, intersect with allowed teams
          if (result.teamCodes && result.teamCodes.length > 0) {
            result.teamCodes = result.teamCodes.filter(t => access.teamCodes!.includes(t));
          } else {
            result.teamCodes = access.teamCodes;
          }
        }
        break;

      case 'USER':
        // Can only see own recordings
        if (access.agentId) {
          result.agentIds = [access.agentId];
        } else {
          // No agent ID - return empty results
          result.agentIds = ['__none__'];
        }
        break;

      default:
        // Unknown role - no access
        result.agentIds = ['__none__'];
    }

    return result;
  }

  /**
   * Search using OpenSearch
   */
  private async searchOpenSearch(
    filters: SearchFilters,
    sort?: SearchSort,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<SearchResponse> {
    const must: any[] = [];
    const filter: any[] = [];

    // Full-text search
    if (filters.q) {
      must.push({
        multi_match: {
          query: filters.q,
          fields: ['ani^2', 'dnis^2', 'agentName', 'callId', 'sessionId', 'searchText'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Date range
    if (filters.dateFrom || filters.dateTo) {
      const range: any = { startTime: {} };
      if (filters.dateFrom) range.startTime.gte = filters.dateFrom.toISOString();
      if (filters.dateTo) range.startTime.lte = filters.dateTo.toISOString();
      filter.push({ range });
    }

    // Duration range
    if (filters.durationFrom !== undefined || filters.durationTo !== undefined) {
      const range: any = { durationSeconds: {} };
      if (filters.durationFrom !== undefined) range.durationSeconds.gte = filters.durationFrom;
      if (filters.durationTo !== undefined) range.durationSeconds.lte = filters.durationTo;
      filter.push({ range });
    }

    // Direction
    if (filters.direction) {
      const directions = Array.isArray(filters.direction) ? filters.direction : [filters.direction];
      filter.push({ terms: { direction: directions } });
    }

    // Agent IDs
    if (filters.agentIds && filters.agentIds.length > 0) {
      filter.push({ terms: { agentId: filters.agentIds } });
    }

    // Team codes
    if (filters.teamCodes && filters.teamCodes.length > 0) {
      filter.push({ terms: { teamCode: filters.teamCodes } });
    }

    // Queue/CSQ
    if (filters.queueIds && filters.queueIds.length > 0) {
      filter.push({ terms: { csq: filters.queueIds } });
    }

    // ANI (partial match)
    if (filters.ani) {
      filter.push({ wildcard: { ani: `*${filters.ani}*` } });
    }

    // DNIS (partial match)
    if (filters.dnis) {
      filter.push({ wildcard: { dnis: `*${filters.dnis}*` } });
    }

    // Call ID / Session ID (exact match)
    if (filters.callId) {
      filter.push({ term: { callId: filters.callId } });
    }
    if (filters.sessionId) {
      filter.push({ term: { mediasenseSessionId: filters.sessionId } });
    }

    // Tags
    if (filters.tags && filters.tags.length > 0) {
      filter.push({ terms: { tags: filters.tags } });
    }

    // Has audio
    if (filters.hasAudio !== undefined) {
      filter.push({ term: { hasAudio: filters.hasAudio } });
    }

    // Wrap-up reasons
    if (filters.wrapUpReasons && filters.wrapUpReasons.length > 0) {
      filter.push({ terms: { wrapUpReason: filters.wrapUpReasons } });
    }

    // Build query
    const query: any = {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        filter,
      },
    };

    // Sorting
    const sortConfig: any[] = [];
    if (sort) {
      if (sort.field === 'duration') {
        sortConfig.push({ durationSeconds: { order: sort.order } });
      } else if (sort.field === 'score' && filters.q) {
        sortConfig.push({ _score: { order: sort.order } });
      } else {
        sortConfig.push({ [sort.field]: { order: sort.order } });
      }
    } else {
      sortConfig.push({ startTime: { order: 'desc' } });
    }

    // Aggregations for facets
    const aggs = {
      agents: {
        terms: { field: 'agentId', size: 50 },
      },
      agentNames: {
        terms: { field: 'agentName.keyword', size: 50 },
      },
      teams: {
        terms: { field: 'teamCode', size: 30 },
      },
      queues: {
        terms: { field: 'csq', size: 30 },
      },
      directions: {
        terms: { field: 'direction', size: 10 },
      },
      tags: {
        terms: { field: 'tags', size: 50 },
      },
      wrapUpReasons: {
        terms: { field: 'wrapUpReason', size: 30 },
      },
      durationBuckets: {
        range: {
          field: 'durationSeconds',
          ranges: [
            { key: '0-30s', from: 0, to: 30 },
            { key: '30s-1m', from: 30, to: 60 },
            { key: '1-5m', from: 60, to: 300 },
            { key: '5-15m', from: 300, to: 900 },
            { key: '15-30m', from: 900, to: 1800 },
            { key: '30m+', from: 1800 },
          ],
        },
      },
      dateHistogram: {
        date_histogram: {
          field: 'startTime',
          calendar_interval: 'day',
          format: 'yyyy-MM-dd',
        },
      },
    };

    // Execute search
    const result = await this.openSearchService.searchWithAggregations({
      index: 'recordings-*',
      query,
      sort: sortConfig,
      from: (page - 1) * pageSize,
      size: pageSize,
      aggs,
    });

    // Map results
    const items: RecordingSearchResult[] = result.hits.map((hit: any) => ({
      id: hit._source.id || hit._id,
      mediasenseSessionId: hit._source.mediasenseSessionId,
      startTime: new Date(hit._source.startTime),
      endTime: hit._source.endTime ? new Date(hit._source.endTime) : undefined,
      durationSeconds: hit._source.durationSeconds,
      direction: hit._source.direction,
      ani: hit._source.ani,
      dnis: hit._source.dnis,
      agentId: hit._source.agentId,
      agentName: hit._source.agentName,
      teamCode: hit._source.teamCode,
      teamName: hit._source.teamName,
      csq: hit._source.csq,
      queueName: hit._source.queueName,
      wrapUpReason: hit._source.wrapUpReason,
      hasAudio: hit._source.hasAudio,
      callId: hit._source.callId,
      tags: hit._source.tags,
      score: hit._score,
    }));

    // Map facets
    const facets = this.mapFacets(result.aggregations);

    return {
      items,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.ceil(result.total / pageSize),
      facets,
    };
  }

  /**
   * Search using Postgres (fallback)
   */
  private async searchPostgres(
    filters: SearchFilters,
    sort?: SearchSort,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<SearchResponse> {
    const where: any = { AND: [], isDeleted: false };

    // Full-text search on searchVector
    if (filters.q) {
      where.AND.push({
        OR: [
          { ani: { contains: filters.q, mode: 'insensitive' } },
          { dnis: { contains: filters.q, mode: 'insensitive' } },
          { agentName: { contains: filters.q, mode: 'insensitive' } },
          { callId: { contains: filters.q, mode: 'insensitive' } },
          { mediasenseSessionId: { contains: filters.q, mode: 'insensitive' } },
          { searchVector: { contains: filters.q, mode: 'insensitive' } },
        ],
      });
    }

    // Date range
    if (filters.dateFrom) {
      where.AND.push({ startTime: { gte: filters.dateFrom } });
    }
    if (filters.dateTo) {
      where.AND.push({ startTime: { lte: filters.dateTo } });
    }

    // Duration range
    if (filters.durationFrom !== undefined) {
      where.AND.push({ durationSeconds: { gte: filters.durationFrom } });
    }
    if (filters.durationTo !== undefined) {
      where.AND.push({ durationSeconds: { lte: filters.durationTo } });
    }

    // Direction
    if (filters.direction) {
      const directions = Array.isArray(filters.direction) ? filters.direction : [filters.direction];
      where.AND.push({ direction: { in: directions } });
    }

    // Agent IDs
    if (filters.agentIds && filters.agentIds.length > 0) {
      where.AND.push({ agentId: { in: filters.agentIds } });
    }

    // Team codes
    if (filters.teamCodes && filters.teamCodes.length > 0) {
      where.AND.push({ teamCode: { in: filters.teamCodes } });
    }

    // Queue/CSQ
    if (filters.queueIds && filters.queueIds.length > 0) {
      where.AND.push({ csq: { in: filters.queueIds } });
    }

    // ANI
    if (filters.ani) {
      where.AND.push({ ani: { contains: filters.ani } });
    }

    // DNIS
    if (filters.dnis) {
      where.AND.push({ dnis: { contains: filters.dnis } });
    }

    // Call ID / Session ID
    if (filters.callId) {
      where.AND.push({ callId: filters.callId });
    }
    if (filters.sessionId) {
      where.AND.push({ mediasenseSessionId: filters.sessionId });
    }

    // Has audio
    if (filters.hasAudio !== undefined) {
      where.AND.push({ hasAudio: filters.hasAudio });
    }

    // Wrap-up reasons
    if (filters.wrapUpReasons && filters.wrapUpReasons.length > 0) {
      where.AND.push({ wrapUpReason: { in: filters.wrapUpReasons } });
    }

    // Tags (through relation)
    if (filters.tags && filters.tags.length > 0) {
      where.AND.push({
        tags: {
          some: {
            tagName: { in: filters.tags },
          },
        },
      });
    }

    // Clean up empty AND
    if (where.AND.length === 0) {
      delete where.AND;
    }

    // Sorting
    const orderBy: any = {};
    if (sort) {
      if (sort.field === 'duration') {
        orderBy.durationSeconds = sort.order;
      } else if (sort.field === 'score') {
        orderBy.startTime = 'desc'; // Fallback for score in Postgres
      } else {
        orderBy[sort.field] = sort.order;
      }
    } else {
      orderBy.startTime = 'desc';
    }

    // Execute queries
    const [items, total] = await Promise.all([
      this.prisma.recording.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          mediasenseSessionId: true,
          startTime: true,
          endTime: true,
          durationSeconds: true,
          direction: true,
          ani: true,
          dnis: true,
          agentId: true,
          agentName: true,
          teamCode: true,
          teamName: true,
          csq: true,
          queueName: true,
          wrapUpReason: true,
          hasAudio: true,
          callId: true,
          tags: {
            select: { tagName: true },
          },
          evaluation: {
            select: { id: true },
          },
        },
      }),
      this.prisma.recording.count({ where }),
    ]);

    // Get facets (limited in Postgres)
    const facets = await this.getPostgresFacets(where);

    return {
      items: items.map(item => ({
        ...item,
        tags: item.tags.map(t => t.tagName),
        hasEvaluation: Boolean(item.evaluation),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      facets,
    };
  }

  /**
   * Get facets using Postgres (limited functionality)
   */
  private async getPostgresFacets(where: any): Promise<SearchFacets> {
    const [
      agents,
      teams,
      directions,
      queues,
    ] = await Promise.all([
      this.prisma.recording.groupBy({
        by: ['agentId', 'agentName'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 50,
      }),
      this.prisma.recording.groupBy({
        by: ['teamCode', 'teamName'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 30,
      }),
      this.prisma.recording.groupBy({
        by: ['direction'],
        where,
        _count: { id: true },
      }),
      this.prisma.recording.groupBy({
        by: ['csq'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 30,
      }),
    ]);

    return {
      agents: agents.map(a => ({
        key: a.agentId || 'unknown',
        count: a._count.id,
        label: a.agentName || a.agentId || 'Unknown',
      })),
      teams: teams.map(t => ({
        key: t.teamCode || 'unknown',
        count: t._count.id,
        label: t.teamName || t.teamCode || 'Unknown',
      })),
      queues: queues.filter(q => q.csq).map(q => ({
        key: q.csq!,
        count: q._count.id,
      })),
      directions: directions.map(d => ({
        key: d.direction,
        count: d._count.id,
      })),
      tags: [], // Would need separate query
      durationBuckets: [], // Would need raw SQL
      dateHistogram: [], // Would need raw SQL
      wrapUpReasons: [],
    };
  }

  /**
   * Map OpenSearch aggregations to facets
   */
  private mapFacets(aggregations: any): SearchFacets {
    const mapBuckets = (agg: any): FacetBucket[] => {
      if (!agg?.buckets) return [];
      return agg.buckets.map((b: any) => ({
        key: b.key_as_string || String(b.key),
        count: b.doc_count,
      }));
    };

    return {
      agents: mapBuckets(aggregations?.agents),
      teams: mapBuckets(aggregations?.teams),
      queues: mapBuckets(aggregations?.queues),
      directions: mapBuckets(aggregations?.directions),
      tags: mapBuckets(aggregations?.tags),
      durationBuckets: mapBuckets(aggregations?.durationBuckets),
      dateHistogram: mapBuckets(aggregations?.dateHistogram),
      wrapUpReasons: mapBuckets(aggregations?.wrapUpReasons),
    };
  }

  /**
   * Get distinct values for filter dropdowns
   */
  async getFilterOptions(
    field: 'agents' | 'teams' | 'queues' | 'wrapUpReasons' | 'tags',
    accessControl: AccessControl,
    search?: string,
  ): Promise<Array<{ value: string; label: string }>> {
    const where: any = { isDeleted: false };

    // Apply access control
    if (accessControl.role === 'SUPERVISOR' && accessControl.teamCodes) {
      where.teamCode = { in: accessControl.teamCodes };
    } else if (accessControl.role === 'USER' && accessControl.agentId) {
      where.agentId = accessControl.agentId;
    }

    switch (field) {
      case 'agents':
        const agents = await this.prisma.recording.findMany({
          where: {
            ...where,
            ...(search && {
              OR: [
                { agentId: { contains: search, mode: 'insensitive' } },
                { agentName: { contains: search, mode: 'insensitive' } },
              ],
            }),
          },
          select: { agentId: true, agentName: true },
          distinct: ['agentId'],
          take: 100,
        });
        return agents.filter(a => a.agentId).map(a => ({
          value: a.agentId!,
          label: a.agentName || a.agentId!,
        }));

      case 'teams':
        const teams = await this.prisma.recording.findMany({
          where: {
            ...where,
            ...(search && {
              OR: [
                { teamCode: { contains: search, mode: 'insensitive' } },
                { teamName: { contains: search, mode: 'insensitive' } },
              ],
            }),
          },
          select: { teamCode: true, teamName: true },
          distinct: ['teamCode'],
          take: 100,
        });
        return teams.filter(t => t.teamCode).map(t => ({
          value: t.teamCode!,
          label: t.teamName || t.teamCode!,
        }));

      case 'queues':
        const queues = await this.prisma.recording.findMany({
          where: {
            ...where,
            csq: { not: null },
            ...(search && { csq: { contains: search, mode: 'insensitive' } }),
          },
          select: { csq: true, queueName: true },
          distinct: ['csq'],
          take: 100,
        });
        return queues.filter(q => q.csq).map(q => ({
          value: q.csq!,
          label: q.queueName || q.csq!,
        }));

      case 'wrapUpReasons':
        const wrapUps = await this.prisma.recording.findMany({
          where: {
            ...where,
            wrapUpReason: { not: null },
            ...(search && { wrapUpReason: { contains: search, mode: 'insensitive' } }),
          },
          select: { wrapUpReason: true },
          distinct: ['wrapUpReason'],
          take: 100,
        });
        return wrapUps.filter(w => w.wrapUpReason).map(w => ({
          value: w.wrapUpReason!,
          label: w.wrapUpReason!,
        }));

      case 'tags':
        const tags = await this.prisma.recordingTag.findMany({
          where: {
            ...(search && { tagName: { contains: search, mode: 'insensitive' } }),
          },
          select: { tagName: true },
          distinct: ['tagName'],
          take: 100,
        });
        return tags.map(t => ({
          value: t.tagName,
          label: t.tagName,
        }));

      default:
        return [];
    }
  }
}
