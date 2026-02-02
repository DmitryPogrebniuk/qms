import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

/**
 * OpenSearch integration for recording metadata indexing and search
 */

export interface OpenSearchQuery {
  index: string;
  query: any;
  sort?: any[];
  from?: number;
  size?: number;
  aggs?: any;
}

export interface OpenSearchResult {
  total: number;
  hits: any[];
  aggregations?: any;
}

@Injectable()
export class OpenSearchService implements OnModuleInit {
  private readonly logger = new Logger('OpenSearchService');
  private readonly osHost: string;
  private readonly osPort: number;
  private readonly osProtocol: string;
  private readonly osAuth?: string;
  private readonly indexPrefix: string;
  private initialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.osHost = configService.get<string>('OPENSEARCH_HOST') || 'localhost';
    this.osPort = configService.get<number>('OPENSEARCH_PORT') || 9200;
    this.osProtocol = configService.get<boolean>('OPENSEARCH_TLS') ? 'https' : 'http';
    this.indexPrefix = configService.get<string>('OPENSEARCH_INDEX_PREFIX') || 'qms';

    const username = configService.get<string>('OPENSEARCH_USERNAME');
    const password = configService.get<string>('OPENSEARCH_PASSWORD');
    if (username && password) {
      this.osAuth = Buffer.from(`${username}:${password}`).toString('base64');
    }
  }

  async onModuleInit() {
    if (this.osHost) {
      await this.ensureIndexTemplate();
      this.initialized = true;
    }
  }

  /**
   * Create index template for recordings
   */
  private async ensureIndexTemplate(): Promise<void> {
    try {
      const templateName = `${this.indexPrefix}-recordings-template`;
      const template = {
        index_patterns: [`${this.indexPrefix}-recordings-*`],
        template: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            'index.mapping.total_fields.limit': 2000,
            'index.max_result_window': 100000,
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              mediasenseSessionId: { type: 'keyword' },
              agentId: { type: 'keyword' },
              agentName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              teamCode: { type: 'keyword' },
              teamName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              startTime: { type: 'date' },
              endTime: { type: 'date' },
              durationSeconds: { type: 'integer' },
              direction: { type: 'keyword' },
              ani: { type: 'keyword', fields: { text: { type: 'text' } } },
              dnis: { type: 'keyword', fields: { text: { type: 'text' } } },
              callerName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              calledName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              csq: { type: 'keyword' },
              queueName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              skillGroup: { type: 'keyword' },
              wrapUpReason: { type: 'keyword' },
              callId: { type: 'keyword' },
              hasAudio: { type: 'boolean' },
              tags: { type: 'keyword' },
              searchText: { type: 'text', analyzer: 'standard' },
            },
          },
        },
      };

      await this.httpService.axiosRef.put(
        `${this._getBaseUrl()}/_index_template/${templateName}`,
        template,
        { headers: this._getHeaders() },
      );

      this.logger.log('OpenSearch index template created/updated');

      // Apply max_result_window to existing indices (template only affects new indices)
      await this.ensureMaxResultWindow();
    } catch (error: any) {
      if (error.response?.status !== 400) {
        this.logger.error('Failed to create index template:', error.message);
      }
    }
  }

  /**
   * Set max_result_window on existing recording indices so pagination beyond 10k works
   */
  private async ensureMaxResultWindow(): Promise<void> {
    try {
      const indexPattern = `${this.indexPrefix}-recordings-*`;
      await this.httpService.axiosRef.put(
        `${this._getBaseUrl()}/${indexPattern}/_settings`,
        { index: { max_result_window: 100000 } },
        { headers: this._getHeaders() },
      );
      this.logger.log('OpenSearch max_result_window updated for existing indices');
    } catch (error: any) {
      // Ignore if no indices exist yet (404) or other non-fatal errors
      if (error.response?.status !== 404 && error.response?.status !== 400) {
        this.logger.warn('Could not update max_result_window on existing indices:', error.message);
      }
    }
  }

  /**
   * Index a recording in OpenSearch
   */
  async indexRecording(recording: any): Promise<void> {
    if (!this.initialized) {
      this.logger.warn('OpenSearch not initialized, skipping indexing');
      return;
    }

    try {
      const indexName = this._getIndexName(new Date(recording.startTime));
      const headers = this._getHeaders();

      await this.httpService.axiosRef.post(
        `${this._getBaseUrl()}/${indexName}/_doc/${recording.id}`,
        {
          id: recording.id,
          mediasenseSessionId: recording.mediasenseSessionId,
          agentId: recording.agentId,
          agentName: recording.agentName,
          teamCode: recording.teamCode,
          teamName: recording.teamName,
          startTime: recording.startTime,
          endTime: recording.endTime,
          durationSeconds: recording.durationSeconds,
          direction: recording.direction,
          ani: recording.ani,
          dnis: recording.dnis,
          callerName: recording.callerName,
          calledName: recording.calledName,
          csq: recording.csq,
          queueName: recording.queueName,
          skillGroup: recording.skillGroup,
          wrapUpReason: recording.wrapUpReason,
          callId: recording.callId,
          hasAudio: recording.hasAudio,
          tags: recording.tags || [],
          searchText: recording.searchText,
        },
        { headers },
      );

      this.logger.debug(`Indexed recording ${recording.id} in ${indexName}`);
    } catch (error: any) {
      this.logger.error(`Failed to index recording ${recording.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Search recordings with aggregations
   */
  async searchWithAggregations(query: OpenSearchQuery): Promise<OpenSearchResult> {
    if (!this.initialized) {
      throw new Error('OpenSearch not initialized');
    }

    try {
      const body: any = {
        query: query.query,
        size: query.size || 20,
        from: query.from || 0,
        track_total_hits: true,
      };

      if (query.sort) {
        body.sort = query.sort;
      }

      if (query.aggs) {
        body.aggs = query.aggs;
      }

      // Use index with prefix so search hits the same index sync writes to (e.g. qms-recordings-*)
      const indexName =
        query.index?.startsWith(this.indexPrefix) ? query.index : `${this.indexPrefix}-recordings-*`;

      const response = await this.httpService.axiosRef.post(
        `${this._getBaseUrl()}/${indexName}/_search`,
        body,
        { headers: this._getHeaders() },
      );

      // OpenSearch 2.x returns total as { value: N }; older versions as number. Avoid passing object (causes [object Object] in UI).
      const rawTotal = response.data.hits.total;
      const total =
        typeof rawTotal === 'object' && rawTotal != null && 'value' in rawTotal
          ? Number(rawTotal.value) || 0
          : Number(rawTotal) || 0;

      return {
        total,
        hits: response.data.hits.hits || [],
        aggregations: response.data.aggregations,
      };
    } catch (error: any) {
      this.logger.error('OpenSearch search error:', error.message);
      throw error;
    }
  }

  /**
   * Legacy search method for compatibility
   */
  async searchRecordings(query: any, accessControl: any): Promise<any> {
    try {
      const indexName = `${this.indexPrefix}-recordings-*`;
      const mustClauses = [];

      if (accessControl.agentIds) {
        mustClauses.push({ terms: { agentId: accessControl.agentIds } });
      }
      if (accessControl.teamCodes) {
        mustClauses.push({ terms: { teamCode: accessControl.teamCodes } });
      }

      if (query.dateFrom || query.dateTo) {
        const rangeQuery: any = { startTime: {} };
        if (query.dateFrom) rangeQuery.startTime.gte = query.dateFrom;
        if (query.dateTo) rangeQuery.startTime.lte = query.dateTo;
        mustClauses.push({ range: rangeQuery });
      }

      if (query.csqs) {
        mustClauses.push({ terms: { csq: query.csqs } });
      }

      const headers = this._getHeaders();

      const response = await this.httpService.axiosRef.post(
        `${this._getBaseUrl()}/${indexName}/_search`,
        {
          query: { bool: { must: mustClauses.length > 0 ? mustClauses : [{ match_all: {} }] } },
          size: query.pageSize || 20,
          from: ((query.page || 1) - 1) * (query.pageSize || 20),
          sort: [{ startTime: { order: 'desc' } }],
        },
        { headers },
      );

      const rawTotal = response.data.hits.total;
      const total =
        typeof rawTotal === 'object' && rawTotal != null && 'value' in rawTotal
          ? Number(rawTotal.value) || 0
          : Number(rawTotal) || 0;

      return {
        total,
        hits: response.data.hits.hits.map((hit: any) => hit._source),
      };
    } catch (error: any) {
      this.logger.error('Search error:', error.message);
      throw error;
    }
  }

  /**
   * Delete recording from index
   */
  async deleteRecording(recordingId: string): Promise<void> {
    if (!this.initialized) return;

    try {
      await this.httpService.axiosRef.post(
        `${this._getBaseUrl()}/${this.indexPrefix}-recordings-*/_delete_by_query`,
        {
          query: { term: { id: recordingId } },
        },
        { headers: this._getHeaders() },
      );
    } catch (error: any) {
      this.logger.warn(`Failed to delete recording ${recordingId} from index:`, error.message);
    }
  }

  /**
   * Check OpenSearch health
   */
  async healthCheck(): Promise<{ status: string; cluster: string }> {
    try {
      const response = await this.httpService.axiosRef.get(
        `${this._getBaseUrl()}/_cluster/health`,
        { headers: this._getHeaders() },
      );
      return {
        status: response.data.status,
        cluster: response.data.cluster_name,
      };
    } catch {
      return { status: 'unreachable', cluster: '' };
    }
  }

  private _getBaseUrl(): string {
    return `${this.osProtocol}://${this.osHost}:${this.osPort}`;
  }

  /**
   * Get index name based on date (YYYY.MM format)
   */
  private _getIndexName(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${this.indexPrefix}-recordings-${year}.${month}`;
  }

  /**
   * Get request headers with auth if configured
   */
  private _getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.osAuth) {
      headers.Authorization = `Basic ${this.osAuth}`;
    }

    return headers;
  }
}
