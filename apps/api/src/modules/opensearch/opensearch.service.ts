import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

/**
 * OpenSearch integration for recording metadata indexing
 */
@Injectable()
export class OpenSearchService {
  private readonly logger = new Logger('OpenSearchService');
  private readonly osHost: string;
  private readonly osPort: number;
  private readonly osAuth?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.osHost = configService.get<string>('OPENSEARCH_HOST') || 'localhost';
    this.osPort = configService.get<number>('OPENSEARCH_PORT') || 9200;

    const username = configService.get<string>('OPENSEARCH_USERNAME');
    const password = configService.get<string>('OPENSEARCH_PASSWORD');
    if (username && password) {
      this.osAuth = Buffer.from(`${username}:${password}`).toString('base64');
    }
  }

  /**
   * Index a recording in OpenSearch
   */
  async indexRecording(recording: any): Promise<void> {
    try {
      const indexName = this._getIndexName(new Date(recording.startTime));
      const headers = this._getHeaders();

      await this.httpService.axiosRef.post(
        `http://${this.osHost}:${this.osPort}/${indexName}/_doc/${recording.id}`,
        {
          agentId: recording.agentId,
          teamCode: recording.teamCode,
          startTime: recording.startTime,
          endTime: recording.endTime,
          durationSeconds: recording.durationSeconds,
          callId: recording.callId,
          ani: recording.ani,
          dnis: recording.dnis,
          csq: recording.csq,
          wrapUpReason: recording.wrapUpReason,
          transferCount: recording.transferCount,
          holdTimeSeconds: recording.holdTimeSeconds,
          isArchived: recording.isArchived,
        },
        { headers },
      );

      this.logger.debug(`Indexed recording ${recording.id} in ${indexName}`);
    } catch (error) {
      this.logger.error(`Failed to index recording ${recording.id}:`, error);
      throw error;
    }
  }

  /**
   * Search recordings with RBAC
   */
  async searchRecordings(query: any, accessControl: any): Promise<any> {
    try {
      const indexName = `${this._getIndexName(new Date())}*`; // Search current month + all previous

      // Build OpenSearch query with access control
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
        `http://${this.osHost}:${this.osPort}/${indexName}/_search`,
        {
          query: { bool: { must: mustClauses.length > 0 ? mustClauses : [{ match_all: {} }] } },
          size: query.pageSize || 20,
          from: ((query.page || 1) - 1) * (query.pageSize || 20),
          sort: [{ startTime: { order: 'desc' } }],
        },
        { headers },
      );

      return {
        total: response.data.hits.total.value,
        hits: response.data.hits.hits.map((hit: any) => hit._source),
      };
    } catch (error) {
      this.logger.error('Search error:', error);
      throw error;
    }
  }

  /**
   * Get index name based on date (YYYY.MM format)
   */
  private _getIndexName(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `recordings-${year}.${month}`;
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
