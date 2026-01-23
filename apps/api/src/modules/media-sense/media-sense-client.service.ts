import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import https from 'https';
import { MediaSenseLogger } from './media-sense-logger.service';

/**
 * MediaSense API Client
 * Implements authentication and API calls to Cisco MediaSense
 * 
 * MediaSense API typically uses:
 * - Port 8440 for HTTPS API
 * - /ora/ prefix for API paths
 * - JSESSIONID cookie for session authentication
 * 
 * Reference: Cisco MediaSense Developer Guide
 */

export interface MediaSenseClientConfig {
  baseUrl: string;
  apiKey: string; // Maps to username
  apiSecret: string; // Maps to password
  timeout?: number;
  allowSelfSigned?: boolean;
}

export interface MediaSenseSession {
  sessionId: string;
  cookies: string[];
  expiresAt: Date;
}

export interface MediaSenseResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  requestId: string;
  duration: number;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  details?: {
    step: string;
    status: 'ok' | 'error';
    message?: string;
    duration?: number;
  }[];
  recommendations?: string[];
}

@Injectable()
export class MediaSenseClientService {
  private readonly logger = new Logger('MediaSenseClient');
  private axiosInstance: AxiosInstance | null = null;
  private session: MediaSenseSession | null = null;
  private config: MediaSenseClientConfig | null = null;

  // Configurable endpoints - can be updated based on MediaSense version
  private readonly endpoints = {
    // Authentication endpoints (varies by MediaSense version)
    login: '/ora/authenticationService/authentication/login',
    logout: '/ora/authenticationService/authentication/logout',
    // Alternative auth for some versions
    loginAlt: '/ora/authenticate',
    // Service info / health check
    serviceInfo: '/ora/serviceInfo',
    serviceInfoAlt: '/ora/queryService/query/serviceInfo',
    // Query service
    querySessions: '/ora/queryService/query/sessions',
    querySessionById: '/ora/queryService/query/sessionBySessionId',
    // Event service
    subscribeEvents: '/ora/eventService/event/subscribeToEvents',
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly msLogger: MediaSenseLogger,
  ) {}

  /**
   * Initialize client with configuration
   */
  configure(config: MediaSenseClientConfig): void {
    this.config = config;
    this.session = null;

    const httpsAgent = new https.Agent({
      rejectUnauthorized: !config.allowSelfSigned,
    });

    this.axiosInstance = axios.create({
      baseURL: this.normalizeBaseUrl(config.baseUrl),
      timeout: config.timeout || 10000,
      httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (req) => {
        const requestId = this.generateRequestId();
        (req as any).requestId = requestId;
        (req as any).startTime = Date.now();

        this.msLogger.debug(`[${requestId}] Request: ${req.method?.toUpperCase()} ${req.url}`, {
          requestId,
          method: req.method,
          url: this.maskSensitiveUrl(req.url || ''),
          headers: this.maskSensitiveHeaders(req.headers),
        });

        return req;
      },
      (error) => {
        this.msLogger.error('Request interceptor error', { error: error.message });
        return Promise.reject(error);
      },
    );

    // Response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const requestId = (response.config as any).requestId;
        const startTime = (response.config as any).startTime;
        const duration = Date.now() - startTime;

        this.msLogger.debug(
          `[${requestId}] Response: ${response.status} (${duration}ms)`,
          {
            requestId,
            status: response.status,
            duration,
            dataPreview: this.truncateData(response.data, 500),
          },
        );

        return response;
      },
      (error: AxiosError) => {
        const requestId = (error.config as any)?.requestId || 'unknown';
        const startTime = (error.config as any)?.startTime;
        const duration = startTime ? Date.now() - startTime : 0;

        this.msLogger.error(
          `[${requestId}] Request failed: ${error.message}`,
          {
            requestId,
            status: error.response?.status,
            duration,
            code: error.code,
            errorData: this.truncateData(error.response?.data, 300),
          },
        );

        return Promise.reject(error);
      },
    );

    if (config.allowSelfSigned) {
      this.msLogger.warn('Self-signed certificates allowed - NOT recommended for production', {
        baseUrl: this.maskSensitiveUrl(config.baseUrl),
      });
    }

    this.msLogger.info('MediaSense client configured', {
      baseUrl: this.maskSensitiveUrl(config.baseUrl),
      timeout: config.timeout || 10000,
    });
  }

  /**
   * Normalize base URL to ensure proper format
   */
  private normalizeBaseUrl(url: string): string {
    let normalized = url.trim();

    // Ensure https://
    if (!normalized.startsWith('https://') && !normalized.startsWith('http://')) {
      normalized = 'https://' + normalized;
    }

    // Add default port 8440 if not specified
    const urlObj = new URL(normalized);
    if (!url.includes(':' + urlObj.port) && urlObj.port === '') {
      urlObj.port = '8440';
      normalized = urlObj.toString();
    }

    // Remove trailing slash
    return normalized.replace(/\/$/, '');
  }

  /**
   * Authenticate with MediaSense and obtain session
   */
  async login(): Promise<MediaSenseSession> {
    if (!this.axiosInstance || !this.config) {
      throw new Error('Client not configured');
    }

    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.msLogger.info(`[${requestId}] Attempting MediaSense login`, {
      requestId,
      baseUrl: this.maskSensitiveUrl(this.config.baseUrl),
    });

    // Try primary login endpoint
    try {
      const response = await this.axiosInstance.post(
        this.endpoints.login,
        {
          username: this.config.apiKey,
          password: this.config.apiSecret,
        },
        {
          validateStatus: () => true, // Don't throw on any status
        },
      );

      if (response.status === 200 || response.status === 201) {
        const cookies = response.headers['set-cookie'] || [];
        const jsessionId = this.extractJSessionId(cookies);

        if (jsessionId) {
          this.session = {
            sessionId: jsessionId,
            cookies,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min default
          };

          this.msLogger.info(`[${requestId}] Login successful`, {
            requestId,
            duration: Date.now() - startTime,
            sessionIdMasked: this.maskSessionId(jsessionId),
          });

          return this.session;
        }
      }

      // If primary fails, try alternative endpoint
      return this.loginAlternative(requestId);
    } catch (error) {
      this.msLogger.warn(`[${requestId}] Primary login failed, trying alternative`, {
        requestId,
        error: (error as Error).message,
      });

      return this.loginAlternative(requestId);
    }
  }

  /**
   * Alternative login method for different MediaSense versions
   */
  private async loginAlternative(parentRequestId: string): Promise<MediaSenseSession> {
    if (!this.axiosInstance || !this.config) {
      throw new Error('Client not configured');
    }

    const requestId = `${parentRequestId}-alt`;
    const startTime = Date.now();

    // Try Basic Auth
    const auth = Buffer.from(
      `${this.config.apiKey}:${this.config.apiSecret}`,
    ).toString('base64');

    try {
      const response = await this.axiosInstance.get(this.endpoints.serviceInfo, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        validateStatus: () => true,
      });

      if (response.status === 200 || response.status === 201) {
        const cookies = response.headers['set-cookie'] || [];
        const jsessionId = this.extractJSessionId(cookies);

        // Even if no JSESSIONID, Basic Auth might work for all requests
        this.session = {
          sessionId: jsessionId || `basic-${Date.now()}`,
          cookies: jsessionId ? cookies : [`Authorization=Basic ${auth}`],
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        };

        this.msLogger.info(`[${requestId}] Alternative login successful (Basic Auth)`, {
          requestId,
          duration: Date.now() - startTime,
          method: jsessionId ? 'session' : 'basic',
        });

        return this.session;
      }

      throw new Error(`Authentication failed: HTTP ${response.status}`);
    } catch (error) {
      const axiosError = error as AxiosError;
      const duration = Date.now() - startTime;

      this.msLogger.error(`[${requestId}] Login failed`, {
        requestId,
        duration,
        error: axiosError.message,
        status: axiosError.response?.status,
      });

      throw this.enhanceError(axiosError, 'Login failed');
    }
  }

  /**
   * Execute authenticated request
   */
  async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: any,
    options?: { retries?: number; headers?: Record<string, string> },
  ): Promise<MediaSenseResponse<T>> {
    if (!this.axiosInstance || !this.config) {
      throw new Error('Client not configured');
    }

    const requestId = this.generateRequestId();
    const startTime = Date.now();
    const maxRetries = options?.retries ?? 2;

    // Ensure we have a valid session
    if (!this.session || this.session.expiresAt < new Date()) {
      await this.login();
    }

    const config: AxiosRequestConfig = {
      method,
      url: path,
      data: body,
      headers: {
        ...this.getSessionHeaders(),
        ...options?.headers,
      },
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.axiosInstance.request<T>(config);

        return {
          success: true,
          data: response.data,
          statusCode: response.status,
          requestId,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        const axiosError = error as AxiosError;
        const isRetryable = this.isRetryableError(axiosError);

        if (isRetryable && attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 1000;
          this.msLogger.warn(
            `[${requestId}] Request failed, retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries})`,
            {
              requestId,
              attempt: attempt + 1,
              maxRetries,
              backoff,
              error: axiosError.message,
            },
          );
          await this.sleep(backoff);
          continue;
        }

        return {
          success: false,
          error: this.formatError(axiosError),
          statusCode: axiosError.response?.status,
          requestId,
          duration: Date.now() - startTime,
        };
      }
    }

    return {
      success: false,
      error: 'Max retries exceeded',
      requestId,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Test connection to MediaSense
   */
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.config) {
      return {
        success: false,
        message: 'Client not configured',
        recommendations: ['Configure MediaSense URL and credentials first'],
      };
    }

    const details: TestConnectionResult['details'] = [];
    const recommendations: string[] = [];
    const startTime = Date.now();

    // Step 1: Validate URL
    try {
      const urlObj = new URL(this.normalizeBaseUrl(this.config.baseUrl));
      details.push({
        step: 'URL Validation',
        status: 'ok',
        message: `Valid URL: ${urlObj.protocol}//${urlObj.host}`,
      });

      if (urlObj.protocol !== 'https:') {
        recommendations.push('Use HTTPS for production environments');
      }

      if (urlObj.port !== '8440') {
        recommendations.push(`Non-standard port ${urlObj.port} - MediaSense typically uses 8440`);
      }
    } catch (error) {
      details.push({
        step: 'URL Validation',
        status: 'error',
        message: `Invalid URL: ${(error as Error).message}`,
      });
      return {
        success: false,
        message: 'Invalid MediaSense URL',
        details,
        recommendations: ['Check URL format: https://mediasense.example.com:8440'],
      };
    }

    // Step 2: Test authentication
    try {
      const loginStart = Date.now();
      await this.login();
      details.push({
        step: 'Authentication',
        status: 'ok',
        message: 'Login successful',
        duration: Date.now() - loginStart,
      });
    } catch (error) {
      const err = error as Error;
      details.push({
        step: 'Authentication',
        status: 'error',
        message: err.message,
      });

      // Add specific recommendations based on error
      if (err.message.includes('401') || err.message.includes('403')) {
        recommendations.push('Check API Key (username) and API Secret (password)');
      } else if (err.message.includes('ECONNREFUSED')) {
        recommendations.push('MediaSense server not reachable - check host and port');
      } else if (err.message.includes('certificate') || err.message.includes('SSL') || err.message.includes('TLS')) {
        recommendations.push('TLS certificate error - verify certificate or enable "Allow Self-Signed" for testing');
      } else if (err.message.includes('ENOTFOUND')) {
        recommendations.push('DNS resolution failed - check MediaSense hostname');
      } else if (err.message.includes('timeout')) {
        recommendations.push('Connection timeout - check network connectivity and firewall rules for port 8440');
      }

      return {
        success: false,
        message: 'Authentication failed',
        details,
        recommendations,
      };
    }

    // Step 3: Test API access (service info or simple query)
    try {
      const apiStart = Date.now();
      let apiResponse = await this.request('GET', this.endpoints.serviceInfo);

      if (!apiResponse.success) {
        // Try alternative endpoint
        apiResponse = await this.request('GET', this.endpoints.serviceInfoAlt);
      }

      if (!apiResponse.success) {
        // Try query endpoint with minimal request
        apiResponse = await this.request('POST', this.endpoints.querySessions, {
          queryType: 'sessions',
          startTime: new Date(Date.now() - 60000).toISOString(),
          endTime: new Date().toISOString(),
          maxResults: 1,
        });
      }

      if (apiResponse.success) {
        details.push({
          step: 'API Access',
          status: 'ok',
          message: 'API responding correctly',
          duration: Date.now() - apiStart,
        });
      } else {
        details.push({
          step: 'API Access',
          status: 'error',
          message: apiResponse.error || 'API request failed',
        });

        // Still consider partial success if auth worked
        recommendations.push(
          'API endpoints may differ based on MediaSense version - check Developer Guide',
        );
      }
    } catch (error) {
      details.push({
        step: 'API Access',
        status: 'error',
        message: (error as Error).message,
      });
    }

    // Add NAT warning
    recommendations.push(
      'Note: If MediaSense returns URLs in responses, ensure the hostname/IP is accessible from this server. NAT configurations may require URL rewriting.',
    );

    const allStepsOk = details.every((d) => d.status === 'ok');
    const authOk = details.find((d) => d.step === 'Authentication')?.status === 'ok';

    return {
      success: allStepsOk || authOk, // Consider success if at least auth works
      message: allStepsOk
        ? 'MediaSense connection successful'
        : authOk
        ? 'MediaSense authentication successful (some API endpoints may not be available)'
        : 'MediaSense connection failed',
      details,
      recommendations: recommendations.filter((r) => r),
    };
  }

  /**
   * Query sessions from MediaSense
   */
  async querySessions(params: {
    startTime: Date;
    endTime: Date;
    maxResults?: number;
    offset?: number;
    agentId?: string;
  }): Promise<MediaSenseResponse<any[]>> {
    return this.request('POST', this.endpoints.querySessions, {
      queryType: 'sessions',
      startTime: params.startTime.toISOString(),
      endTime: params.endTime.toISOString(),
      maxResults: params.maxResults || 100,
      offset: params.offset || 0,
      ...(params.agentId && { agentId: params.agentId }),
    });
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string): Promise<MediaSenseResponse<any>> {
    return this.request('GET', `${this.endpoints.querySessionById}/${sessionId}`);
  }

  // ==================== Helper Methods ====================

  private extractJSessionId(cookies: string[]): string | null {
    for (const cookie of cookies) {
      const match = cookie.match(/JSESSIONID=([^;]+)/);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  private getSessionHeaders(): Record<string, string> {
    if (!this.session) return {};

    const headers: Record<string, string> = {};

    // Add cookies
    if (this.session.cookies.length > 0) {
      const cookieHeader = this.session.cookies
        .map((c) => c.split(';')[0])
        .join('; ');
      headers['Cookie'] = cookieHeader;
    }

    // If using Basic Auth fallback
    if (this.session.sessionId.startsWith('basic-') && this.config) {
      const auth = Buffer.from(
        `${this.config.apiKey}:${this.config.apiSecret}`,
      ).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    return headers;
  }

  private isRetryableError(error: AxiosError): boolean {
    // Network errors
    if (!error.response) return true;

    // Server errors (5xx)
    if (error.response.status >= 500) return true;

    // Rate limiting
    if (error.response.status === 429) return true;

    return false;
  }

  private enhanceError(error: AxiosError, context: string): Error {
    const status = error.response?.status;
    const code = error.code;

    let message = `${context}: `;

    if (code === 'ECONNREFUSED') {
      message += 'Connection refused - MediaSense server not reachable';
    } else if (code === 'ENOTFOUND') {
      message += 'DNS lookup failed - check hostname';
    } else if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
      message += 'Connection timeout - check network and firewall';
    } else if (code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      message += 'TLS certificate error - verify certificate or enable self-signed option';
    } else if (status === 401) {
      message += 'Authentication failed - check credentials';
    } else if (status === 403) {
      message += 'Access forbidden - insufficient permissions';
    } else if (status === 404) {
      message += 'Endpoint not found - MediaSense API path may differ';
    } else {
      message += error.message;
    }

    return new Error(message);
  }

  private formatError(error: AxiosError): string {
    return this.enhanceError(error, 'Request failed').message;
  }

  private generateRequestId(): string {
    return `ms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private maskSensitiveUrl(url: string): string {
    return url.replace(/password=[^&]+/gi, 'password=***')
              .replace(/secret=[^&]+/gi, 'secret=***')
              .replace(/apiKey=[^&]+/gi, 'apiKey=***');
  }

  private maskSensitiveHeaders(headers: any): any {
    const masked = { ...headers };
    if (masked.Authorization) {
      masked.Authorization = 'Bearer ***' ;
    }
    if (masked.Cookie) {
      masked.Cookie = masked.Cookie.replace(/JSESSIONID=[^;]+/g, 'JSESSIONID=***');
    }
    return masked;
  }

  private maskSessionId(sessionId: string): string {
    if (sessionId.length <= 8) return '***';
    return sessionId.substring(0, 4) + '***' + sessionId.substring(sessionId.length - 4);
  }

  private truncateData(data: any, maxLength: number): string {
    if (!data) return '';
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...[truncated]';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
