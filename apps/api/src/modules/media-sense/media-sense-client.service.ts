import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import https from 'https';
import { MediaSenseLogger } from './media-sense-logger.service';
import { MediaSenseCookieService } from './media-sense-cookie.service';

/**
 * MediaSense API Client
 * Implements authentication and API calls to Cisco MediaSense
 * 
 * MediaSense API typically uses:
 * - Port 8440 for HTTPS API
 * - /ora/ prefix for API paths
 * - JSESSIONID cookie for session authentication (MediaSense 11.5 - from reverse engineering)
 * - JSESSIONIDSSO cookie as fallback (for some versions)
 * 
 * Real API format discovered via reverse engineering:
 * - Endpoint: /ora/queryService/query/getSessions (not /sessions)
 * - Request format: { requestParameters: [{ fieldName, fieldConditions, ... }] }
 * - Uses timestamps in milliseconds (not ISO strings)
 * - Response: { responseCode: 2000, responseMessage: "Success...", responseBody: { sessions: [...] } }
 * 
 * Reference: Cisco MediaSense Developer Guide Release 11.0+
 * Tested with: MediaSense 11.5.1.12001-8
 * Reverse engineered from: Web interface HAR analysis
 */

export interface MediaSenseClientConfig {
  baseUrl: string;
  apiKey: string; // Maps to username
  apiSecret: string; // Maps to password
  timeout?: number;
  allowSelfSigned?: boolean;
  manualJSessionId?: string; // Optional: manually set JSESSIONID for testing (temporary workaround)
}

export interface MediaSenseSession {
  sessionId: string;
  cookies: string[];
  expiresAt: Date;
}

/**
 * MediaSense API response format
 * MediaSense returns responses in format: { responseCode, responseMessage, responseBody }
 */
export interface MediaSenseApiResponse<T = any> {
  responseCode?: number;
  responseMessage?: string;
  responseBody?: T;
  // Some endpoints may return data directly
  [key: string]: any;
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

  // Configurable endpoints for MediaSense 11.5.1.12001-8
  // Based on Cisco MediaSense Developer Guide Release 11.0+
  private readonly endpoints = {
    // Authentication endpoints (per Dev Guide)
    signIn: '/ora/authenticationService/authentication/signIn',
    signOut: '/ora/authenticationService/authentication/signOut',
    login: '/ora/authenticationService/authentication/login', // Added for compatibility with loginAlternative
    // Service info / health check
    serviceInfo: '/ora/serviceInfo',
    serviceInfoAlt: '/ora/queryService/query/serviceInfo',
    // Query service (MediaSense 11.5 uses this endpoint)
    querySessions: '/ora/queryService/query/getSessions',
    querySessionsAlt: '/ora/queryService/query/sessions', // Fallback
    querySessionById: '/ora/queryService/query/sessionBySessionId',
    // Event service
    subscribeEvents: '/ora/eventService/event/subscribeToEvents',
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly msLogger: MediaSenseLogger,
    @Optional() private readonly cookieService?: MediaSenseCookieService,
  ) {
    // Log cookie service availability
    if (this.cookieService) {
      this.logger.debug('MediaSenseCookieService injected successfully');
    } else {
      this.logger.warn('MediaSenseCookieService not available - web interface automation will not work');
    }
  }

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

    this.msLogger.info(`[${requestId}] Attempting MediaSense login (signIn endpoint)`, {
      requestId,
      baseUrl: this.maskSensitiveUrl(this.config.baseUrl),
      hasCookieService: !!this.cookieService,
      hasManualJSessionId: !!this.config.manualJSessionId,
    });

    // TEMPORARY WORKAROUND: If manual JSESSIONID is provided, use it directly
    if (this.config.manualJSessionId) {
      this.msLogger.warn(`[${requestId}] Using manually provided JSESSIONID (temporary workaround)`, {
        requestId,
        sessionIdMasked: this.maskSessionId(this.config.manualJSessionId),
      });

      this.session = {
        sessionId: this.config.manualJSessionId,
        cookies: [`JSESSIONID=${this.config.manualJSessionId}`],
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min default
      };

      return this.session;
    }

    // Основний спосіб: POST на signIn endpoint з requestParameters
    try {
      const response = await this.axiosInstance.post(
        this.endpoints.signIn,
        {
          requestParameters: {
            username: this.config.apiKey,
            password: this.config.apiSecret,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          validateStatus: () => true, // Не кидати помилку по статусу
        },
      );

      // Перевірити наявність JSESSIONID у cookie
      const setCookieHeaders = response.headers['set-cookie'] || [];
      const cookies = Array.isArray(setCookieHeaders)
        ? setCookieHeaders
        : [setCookieHeaders].filter(Boolean);
      const jsessionId = this.extractJSessionId(cookies);

      const responseBody = response.data as MediaSenseApiResponse;
      const hasError = responseBody?.responseCode && responseBody.responseCode !== 2000 && responseBody.responseCode !== 0;

      if ((response.status === 200 || response.status === 201) && jsessionId && !hasError) {
        this.session = {
          sessionId: jsessionId,
          cookies,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        };

        this.msLogger.info(`[${requestId}] Login successful (signIn)`, {
          requestId,
          duration: Date.now() - startTime,
          sessionIdMasked: this.maskSessionId(jsessionId),
        });

        return this.session;
      } else {
        this.msLogger.warn(`[${requestId}] Login failed or no JSESSIONID cookie`, {
          requestId,
          status: response.status,
          cookies: cookies.length,
          responseBody: this.truncateData(responseBody, 200),
        });
        // fallback на playwright/web-автоматизацію якщо є
        if (this.cookieService) {
          try {
            this.msLogger.info(`[${requestId}] No session cookie from API login, trying web interface automation (Playwright)`);
            return await this.loginViaWebInterface(requestId);
          } catch (webError) {
            this.msLogger.error(`[${requestId}] Web interface automation failed after missing cookie`, {
              error: (webError as Error).message,
            });
          }
        }
        throw new Error('Login failed: No JSESSIONID cookie');
      }
    } catch (error) {
      this.msLogger.error(`[${requestId}] signIn endpoint failed`, {
        error: (error as Error).message,
      });
      // fallback на playwright/web-автоматизацію якщо є
      if (this.cookieService) {
        try {
          this.msLogger.info(`[${requestId}] signIn failed, trying web interface automation (Playwright)`);
          return await this.loginViaWebInterface(requestId);
        } catch (webError) {
          this.msLogger.error(`[${requestId}] Web interface automation failed after signIn`, {
            error: (webError as Error).message,
          });
        }
      }
      throw new Error('Login failed: signIn endpoint and web automation failed');
    }
  }
  /**
   * Logout (signOut) - POST на /ora/authenticationService/authentication/signOut з JSESSIONID у заголовку
   */
  async logout(): Promise<void> {
    if (!this.axiosInstance || !this.session) {
      throw new Error('Client not configured or not logged in');
    }
    const requestId = this.generateRequestId();
    try {
      await this.axiosInstance.post(
        this.endpoints.signOut,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'JSESSIONID': this.session.sessionId,
            'Cookie': `JSESSIONID=${this.session.sessionId}`,
          },
        },
      );
      this.msLogger.info(`[${requestId}] Logout successful`);
      this.session = null;
    } catch (error) {
      this.msLogger.error(`[${requestId}] Logout failed`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Login via web interface automation (Playwright)
   * Fallback when API authentication doesn't work
   */
  private async loginViaWebInterface(requestId: string): Promise<MediaSenseSession> {
    if (!this.config) {
      throw new Error('Client not configured');
    }
    
    if (!this.cookieService) {
      this.msLogger.error(`[${requestId}] CookieService not available for web interface automation`);
      throw new Error('CookieService not available');
    }

    const startTime = Date.now();

    this.msLogger.info(`[${requestId}] Starting web interface automation login`, {
      baseUrl: this.maskSensitiveUrl(this.config.baseUrl),
    });

    try {
      // Get JSESSIONID from web interface
      const cookieResult = await this.cookieService.getJSessionId(
        this.config.baseUrl,
        this.config.apiKey,
        this.config.apiSecret,
      );

      this.session = {
        sessionId: cookieResult.jsessionId,
        cookies: cookieResult.cookies,
        expiresAt: cookieResult.expiresAt,
      };

      const duration = Date.now() - startTime;
      this.msLogger.info(`[${requestId}] Login successful via web interface automation`, {
        requestId,
        duration,
        sessionIdMasked: this.maskSessionId(cookieResult.jsessionId),
        expiresAt: cookieResult.expiresAt.toISOString(),
      });

      return this.session;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      const errorStack = (error as Error).stack;

      this.msLogger.error(`[${requestId}] Web interface login failed`, {
        requestId,
        duration,
        error: errorMessage,
        stack: errorStack,
      });

      throw new Error(`Web interface login failed: ${errorMessage}`);
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

    // Try Basic Auth on login endpoint to get JSESSIONID
    const auth = Buffer.from(
      `${this.config.apiKey}:${this.config.apiSecret}`,
    ).toString('base64');

    // Strategy 1: Try Basic Auth on login endpoint with empty body
    // For MediaSense 11.5, some versions may require empty body
    try {
      const loginResponse = await this.axiosInstance.post(
        this.endpoints.login,
        {}, // Empty body, credentials in Basic Auth header
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          validateStatus: () => true,
        },
      );

      if (loginResponse.status === 200 || loginResponse.status === 201) {
        // Axios in Node.js returns Set-Cookie headers as array or string
        const setCookieHeaders = loginResponse.headers['set-cookie'] || [];
        const cookies = Array.isArray(setCookieHeaders) 
          ? setCookieHeaders 
          : [setCookieHeaders].filter(Boolean);
        const jsessionId = this.extractJSessionId(cookies);

        if (jsessionId) {
          this.session = {
            sessionId: jsessionId,
            cookies,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          };

          this.msLogger.info(`[${requestId}] Alternative login successful (Basic Auth on login endpoint)`, {
            requestId,
            duration: Date.now() - startTime,
            sessionIdMasked: this.maskSessionId(jsessionId),
          });

          return this.session;
        }
      }
    } catch (error) {
      this.msLogger.debug(`[${requestId}] Basic Auth on login endpoint failed, trying serviceInfo`, {
        error: (error as Error).message,
      });
    }

    // Strategy 2: Try Basic Auth on serviceInfo (may not return JSESSIONIDSSO)
    // For MediaSense 11.5, this endpoint may establish session
    try {
      const response = await this.axiosInstance.get(this.endpoints.serviceInfo, {
        headers: {
          Authorization: `Basic ${auth}`,
          'Accept': 'application/json',
        },
        validateStatus: () => true,
      });

      if (response.status === 200 || response.status === 201) {
        // Axios in Node.js returns Set-Cookie headers as array or string
        const setCookieHeaders = response.headers['set-cookie'] || [];
        const cookies = Array.isArray(setCookieHeaders) 
          ? setCookieHeaders 
          : [setCookieHeaders].filter(Boolean);
        const jsessionId = this.extractJSessionId(cookies);

        // If we got JSESSIONID, use it
        if (jsessionId) {
          this.session = {
            sessionId: jsessionId,
            cookies,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          };

          this.msLogger.info(`[${requestId}] Alternative login successful (JSESSIONID from serviceInfo)`, {
            requestId,
            duration: Date.now() - startTime,
            sessionIdMasked: this.maskSessionId(jsessionId),
          });

          return this.session;
        } else {
          // No JSESSIONIDSSO - use Basic Auth for all requests
          // Note: For MediaSense 11.5, query endpoints may require JSESSIONIDSSO cookie
          // If query endpoints return 4021, this indicates JSESSIONIDSSO is required
          this.msLogger.info(`[${requestId}] Basic Auth works, using it for all requests (no JSESSIONIDSSO)`, {
            requestId,
            duration: Date.now() - startTime,
            note: 'Will use Basic Auth header for all API requests. Query endpoints may require JSESSIONIDSSO cookie.',
            warning: 'If query endpoints return 4021, JSESSIONIDSSO cookie is required but not available from MediaSense server',
          });

          // IMPORTANT: before falling back to Basic Auth-only session, try web UI automation to obtain JSESSIONID
          if (this.cookieService) {
            try {
              this.msLogger.info(`[${requestId}] No session cookie from serviceInfo, trying web interface automation (Playwright)`);
              return await this.loginViaWebInterface(requestId);
            } catch (webError) {
              this.msLogger.error(`[${requestId}] Web interface automation failed after serviceInfo`, {
                error: (webError as Error).message,
              });
            }
          }

          // Create session with Basic Auth - we'll use Authorization header for all requests
          this.session = {
            sessionId: `basic-${Date.now()}`,
            cookies: [], // No cookies, will use Basic Auth header
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          };

          return this.session;
        }
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

    // For MediaSense 11.5, ensure proper headers for query endpoints
    const defaultHeaders: Record<string, string> = {
      ...this.getSessionHeaders(),
    };
    
    // Add Content-Type for POST/PUT requests if not already set
    if ((method === 'POST' || method === 'PUT') && body && !defaultHeaders['Content-Type']) {
      defaultHeaders['Content-Type'] = 'application/json';
    }
    
    // Ensure Accept header for query endpoints
    if (path.includes('queryService')) {
      defaultHeaders['Accept'] = 'application/json';
    }
    
    // Log authentication method for query endpoints (for debugging)
    if (path.includes('queryService')) {
      const authMethod = defaultHeaders['Cookie'] ? 'Cookie' : (defaultHeaders['Authorization'] ? 'Basic Auth' : 'None');
      this.msLogger.debug(`[${requestId}] Query request authentication method: ${authMethod}`, {
        requestId,
        hasCookie: !!defaultHeaders['Cookie'],
        hasBasicAuth: !!defaultHeaders['Authorization'],
      });
    }

    const config: AxiosRequestConfig = {
      method,
      url: path,
      data: body,
      headers: {
        ...defaultHeaders,
        ...options?.headers,
      },
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.axiosInstance.request<T>(config);

        // Check for error in response body even if HTTP status is 200
        const responseData = response.data as MediaSenseApiResponse<T>;
        
        // MediaSense API format: { responseCode, responseMessage, responseBody }
        // responseCode: 2000 = success, 4021 = invalid session, other = error
        const responseCode = responseData?.responseCode;
        const responseMessage = responseData?.responseMessage;
        const responseBody = responseData?.responseBody;
        
        // Check for session error (4021)
        if (responseCode === 4021) {
          const errorMessage = responseMessage || 'Invalid session';
          const isBasicAuthSession = this.session?.sessionId?.startsWith('basic-');
          
          this.msLogger.warn(`[${requestId}] Invalid session detected (responseCode: 4021)`, {
            requestId,
            httpStatus: response.status,
            message: errorMessage,
            isBasicAuthSession,
            hasCookies: this.session?.cookies?.length > 0,
            path: path,
          });

          // For MediaSense 11.5: if using Basic Auth and getting 4021 on query endpoints,
          // this might mean the endpoint doesn't support Basic Auth
          // Try to re-login to get JSESSIONIDSSO, but if that fails, return error
          if (isBasicAuthSession && path.includes('queryService')) {
            this.msLogger.warn(`[${requestId}] Query endpoint returned 4021 with Basic Auth - JSESSIONIDSSO required`, {
              requestId,
              note: 'MediaSense 11.5 query endpoints require JSESSIONIDSSO cookie, Basic Auth may not work',
            });
          }

          // Try to re-login (might get JSESSIONIDSSO this time)
          this.session = null; // Clear invalid session
          await this.login(); // Re-login
          
          // Retry the request once after re-login
          try {
            const retryResponse = await this.axiosInstance.request<T>({
              ...config,
              headers: {
                ...config.headers,
                ...this.getSessionHeaders(),
              },
            });
            
            const retryData = retryResponse.data as MediaSenseApiResponse<T>;
            const retryCode = retryData?.responseCode;
            
            // If retry successful, extract data from responseBody
            if (retryCode === 2000 || !retryCode) {
              this.msLogger.info(`[${requestId}] Retry after re-login successful`, {
                requestId,
                retryCode,
              });
              // Extract data: prefer responseBody if available, otherwise use the whole response
              const extractedData = retryData?.responseBody !== undefined 
                ? (retryData.responseBody as T)
                : (retryData as unknown as T);
              return {
                success: true,
                data: extractedData,
                statusCode: retryResponse.status,
                requestId,
                duration: Date.now() - startTime,
              };
            } else {
              this.msLogger.warn(`[${requestId}] Retry after re-login still failed`, {
                requestId,
                retryCode,
                retryMessage: retryData?.responseMessage,
              });
            }
          } catch (retryError) {
            this.msLogger.error(`[${requestId}] Retry after re-login failed`, {
              error: (retryError as Error).message,
            });
          }

          return {
            success: false,
            error: errorMessage,
            statusCode: response.status,
            requestId,
            duration: Date.now() - startTime,
          };
        }
        
        // Check for other errors (responseCode exists and is not 2000)
        if (responseCode && responseCode !== 2000) {
          const errorMessage = responseMessage || 'API returned error';
          this.msLogger.warn(`[${requestId}] API returned error in response body`, {
            requestId,
            httpStatus: response.status,
            responseCode,
            message: errorMessage,
          });

          return {
            success: false,
            error: errorMessage,
            statusCode: response.status,
            requestId,
            duration: Date.now() - startTime,
          };
        }

        // Success: extract data from responseBody if present, otherwise use responseData directly
        // TypeScript: responseBody is T | undefined, responseData is MediaSenseApiResponse<T>
        // We need to extract T from either source
        const data: T = responseBody !== undefined 
          ? responseBody 
          : (responseData as unknown as T);
        
        return {
          success: true,
          data: data,
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
        recommendations: ['Check URL format: https://192.168.200.133:8440'],
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
    // For MediaSense 11.5, try endpoints in order of reliability
    try {
      const apiStart = Date.now();
      let apiResponse: MediaSenseResponse<any> | null = null;
      let lastError: string | null = null;

      // Try 1: GET /ora/serviceInfo (most reliable for MediaSense 11.5)
      try {
        apiResponse = await this.request('GET', this.endpoints.serviceInfo);
        if (apiResponse.success) {
          details.push({
            step: 'API Access',
            status: 'ok',
            message: 'API responding correctly via /ora/serviceInfo',
            duration: Date.now() - apiStart,
          });
        } else {
          lastError = apiResponse.error || 'Unknown error';
        }
      } catch (error) {
        lastError = (error as Error).message;
        this.msLogger.debug('serviceInfo endpoint failed, trying alternatives', {
          error: lastError,
        });
      }

      // Try 2: Alternative serviceInfo endpoint skipped for MediaSense 11.5 - /ora/queryService/query/serviceInfo returns 404 and causes ERROR logs.

      // Try 3: Query endpoint (only if we have JSESSIONID or want to test)
      // MediaSense 11.5 uses JSESSIONID (not JSESSIONIDSSO) from reverse engineering
      if (!apiResponse?.success && this.session?.cookies?.some(c => c.includes('JSESSIONID'))) {
        try {
          // Use REAL MediaSense 11.5 format from reverse engineering
          const testStartTime = Date.now() - 60000; // 1 minute ago
          const testEndTime = Date.now();
          
          apiResponse = await this.request('POST', this.endpoints.querySessions, {
            requestParameters: [
              {
                fieldName: 'sessionState',
                fieldConditions: [
                  {
                    fieldOperator: 'equals',
                    fieldValues: ['CLOSED_NORMAL'],
                    fieldConnector: 'OR',
                  },
                  {
                    fieldOperator: 'equals',
                    fieldValues: ['CLOSED_ERROR'],
                  },
                ],
                paramConnector: 'AND',
              },
              {
                fieldName: 'sessionStartDate',
                fieldConditions: [
                  {
                    fieldOperator: 'between',
                    fieldValues: [testStartTime, testEndTime],
                  },
                ],
              },
            ],
          });
          
          if (apiResponse.success) {
            details.push({
              step: 'API Access',
              status: 'ok',
              message: 'Query endpoint responding correctly',
              duration: Date.now() - apiStart,
            });
          } else {
            lastError = apiResponse.error || lastError || 'Unknown error';
          }
        } catch (error) {
          // Ignore errors for query endpoint - it requires JSESSIONIDSSO which we might not have
          const axiosError = error as AxiosError;
          if (axiosError.response?.status === 404) {
            this.msLogger.debug('Query endpoint not found (404) - may not be available in this MediaSense version');
          } else if (axiosError.response?.status !== 4021) {
            lastError = (error as Error).message;
          }
        }
      }

      // If no endpoint worked, report error but don't fail completely if auth worked
      if (!apiResponse?.success) {
        const errorMessage = lastError || 'API request failed';
        details.push({
          step: 'API Access',
          status: 'error',
          message: errorMessage,
        });

        // For MediaSense 11.5, query endpoints require JSESSIONID cookie
        if (errorMessage.includes('4021') || errorMessage.includes('Invalid session')) {
          recommendations.push(
            'Query endpoints require JSESSIONID cookie. MediaSense 11.5 may not provide cookies via API authentication.',
          );
          recommendations.push(
            'Try logging in through web interface and copying JSESSIONID cookie, or check MediaSense server configuration for cookie-based authentication.',
          );
        } else if (errorMessage.includes('404')) {
          recommendations.push(
            'Endpoint not found (404). This endpoint may not be available in MediaSense 11.5.1.12001-8.',
          );
          recommendations.push(
            'Try using /ora/serviceInfo endpoint instead, or check MediaSense Developer Guide for correct endpoints.',
          );
        } else {
          recommendations.push(
            'API endpoints may differ based on MediaSense version - check Developer Guide',
          );
        }
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      details.push({
        step: 'API Access',
        status: 'error',
        message: errorMessage,
      });
      
      // Add specific recommendations for common errors
      if (errorMessage.includes('404')) {
        recommendations.push('Endpoint not found - check MediaSense version and available endpoints');
      }
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
   * 
   * MediaSense 11.5.1.12001-8 uses:
   * - Endpoint: /ora/queryService/query/getSessions (from reverse engineering)
   * - Requires JSESSIONID cookie (not JSESSIONIDSSO)
   * - Uses requestParameters format with fieldName/fieldConditions
   * - Uses sessionStartDate with timestamps (milliseconds), not ISO strings
   * 
   * Real API format from reverse engineering:
   * {
   *   "requestParameters": [
   *     {
   *       "fieldName": "sessionState",
   *       "fieldConditions": [...],
   *       "paramConnector": "AND"
   *     },
   *     {
   *       "fieldName": "sessionStartDate",
   *       "fieldConditions": [
   *         {
   *           "fieldOperator": "between",
   *           "fieldValues": [startTimestamp, endTimestamp]
   *         }
   *       ]
   *     }
   *   ]
   * }
   */
  async querySessions(params: {
    startTime: string;
    endTime: string;
    limit?: number;
    offset?: number;
    agentId?: string;
    direction?: string;
    ani?: string;
    dnis?: string;
  }): Promise<MediaSenseResponse<any[]>> {
    const requestId = this.generateRequestId();

    this.msLogger.debug(`[${requestId}] Query sessions`, {
      startTime: params.startTime,
      endTime: params.endTime,
      limit: params.limit,
      offset: params.offset,
    });

    // Convert ISO timestamps to milliseconds (MediaSense uses milliseconds)
    const startTimestamp = new Date(params.startTime).getTime();
    const endTimestamp = new Date(params.endTime).getTime();

    // Build query body using REAL MediaSense 11.5 format from reverse engineering
    const queryBody: any = {
      requestParameters: [
        {
          fieldName: 'sessionState',
          fieldConditions: [
            {
              fieldOperator: 'equals',
              fieldValues: ['CLOSED_NORMAL'],
              fieldConnector: 'OR',
            },
            {
              fieldOperator: 'equals',
              fieldValues: ['CLOSED_ERROR'],
            },
          ],
          paramConnector: 'AND',
        },
        {
          fieldName: 'sessionStartDate',
          fieldConditions: [
            {
              fieldOperator: 'between',
              fieldValues: [startTimestamp, endTimestamp],
            },
          ],
        },
      ],
    };

    // Add optional filters
    if (params.agentId) {
      queryBody.requestParameters.push({
        fieldName: 'agentId',
        fieldConditions: [
          {
            fieldOperator: 'equals',
            fieldValues: [params.agentId],
          },
        ],
      });
    }

    if (params.direction) {
      queryBody.requestParameters.push({
        fieldName: 'direction',
        fieldConditions: [
          {
            fieldOperator: 'equals',
            fieldValues: [params.direction],
          },
        ],
      });
    }

    // Log query details
    this.msLogger.debug(`[${requestId}] MediaSense 11.5 query request (real format)`, {
      endpoint: this.endpoints.querySessions,
      dateRange: `${params.startTime} to ${params.endTime}`,
      timestamps: `${startTimestamp} to ${endTimestamp}`,
      hasSession: !!this.session,
      sessionType: this.session?.cookies.some(c => c.includes('JSESSIONID')) ? 'JSESSIONID' : 'none',
    });

    try {
      // Try real MediaSense 11.5 endpoint first
      const response = await this.request('POST', this.endpoints.querySessions, queryBody);
      
      if (response.success) {
        return response;
      }

      // If failed, try alternative format (for compatibility)
      this.msLogger.debug(`[${requestId}] Real format failed, trying alternative format`, {
        error: response.error,
      });
      return this.querySessionsAlternative(params, requestId);
    } catch (error) {
      const axiosError = error as AxiosError;
      
      // If 404, endpoint might not exist, try alternative
      if (axiosError.response?.status === 404) {
        this.msLogger.warn(`[${requestId}] Endpoint ${this.endpoints.querySessions} not found (404), trying alternative`, {
          error: (error as Error).message,
        });
        return this.querySessionsAlternative(params, requestId);
      }

      this.msLogger.warn(`[${requestId}] Primary query failed, trying alternative`, {
        error: (error as Error).message,
      });
      return this.querySessionsAlternative(params, requestId);
    }
  }

  /**
   * Alternative query format for older MediaSense versions
   */
  private async querySessionsAlternative(
    params: {
      startTime: string;
      endTime: string;
      limit?: number;
      offset?: number;
      agentId?: string;
    },
    requestId: string,
  ): Promise<MediaSenseResponse<any[]>> {
    // Alternative query format with URL parameters
    const queryParams = new URLSearchParams({
      startTime: params.startTime,
      endTime: params.endTime,
      maxResults: String(params.limit || 100),
      offset: String(params.offset || 0),
    });

    if (params.agentId) {
      queryParams.set('agentId', params.agentId);
    }

    const alternativeEndpoints = [
      `/ora/queryService/query/sessions?${queryParams}`,
      `/ora/recording/api/sessions?${queryParams}`,
      `/ora/api/v1/sessions?${queryParams}`,
    ];

    for (const endpoint of alternativeEndpoints) {
      try {
        const response = await this.request('GET', endpoint);
        if (response.success) {
          this.msLogger.info(`[${requestId}] Alternative endpoint worked: ${endpoint.split('?')[0]}`);
          return response;
        }
      } catch (error) {
        continue;
      }
    }

    return {
      success: false,
      error: 'All query endpoints failed',
      requestId,
      duration: 0,
    };
  }

  /**
   * Get media/audio stream URL for a session
   */
  async getMediaUrl(sessionId: string, trackIndex: number = 0): Promise<MediaSenseResponse<string>> {
    const requestId = this.generateRequestId();

    // Try different media URL patterns
    const mediaEndpoints = [
      `/ora/mediaService/media/session/${sessionId}/track/${trackIndex}`,
      `/ora/media/${sessionId}`,
      `/ora/recording/api/media/${sessionId}`,
    ];

    for (const endpoint of mediaEndpoints) {
      try {
        // Just get the URL/info, don't download
          // validateStatus is not a valid option for this.request, so we remove it
          const response = await this.request('GET', endpoint, undefined);

        if (response.success && response.data?.url) {
          return {
            success: true,
            data: response.data.url,
            requestId,
            duration: response.duration,
          };
        }

        // Check for redirect (actual media URL)
        if (response.statusCode === 302 || response.statusCode === 307) {
          // The redirect location is the media URL
          const mediaUrl = response.data?.location || response.data?.redirect;
          if (mediaUrl) {
            return {
              success: true,
              data: mediaUrl,
              requestId,
              duration: response.duration,
            };
          }
        }
      } catch (error) {
        continue;
      }
    }

    // Construct default URL pattern
    const baseUrl = this.config?.baseUrl || '';
    const defaultUrl = `${baseUrl}/ora/mediaService/media/session/${sessionId}/track/${trackIndex}`;

    return {
      success: true,
      data: defaultUrl,
      requestId,
      duration: 0,
    };
  }

  /**
   * Stream media directly (for proxying)
   */
  async streamMedia(
    sessionId: string,
    trackIndex: number = 0,
    range?: string,
  ): Promise<{
    stream: any;
    headers: Record<string, string>;
    statusCode: number;
  }> {
    if (!this.axiosInstance || !this.config) {
      throw new Error('Client not configured');
    }

    await this.ensureAuthenticated();

    const mediaUrl = await this.getMediaUrl(sessionId, trackIndex);
    if (!mediaUrl.success || !mediaUrl.data) {
      throw new Error('Could not get media URL');
    }

    const headers: Record<string, string> = {
      ...this.getSessionHeaders(),
    };

    if (range) {
      headers['Range'] = range;
    }

    const response = await this.axiosInstance.get(mediaUrl.data, {
      headers,
      responseType: 'stream',
      validateStatus: (status) => status < 400,
    });

    return {
      stream: response.data,
      headers: {
        'Content-Type': response.headers['content-type'] || 'audio/wav',
        'Content-Length': response.headers['content-length'],
        'Accept-Ranges': response.headers['accept-ranges'] || 'bytes',
        'Content-Range': response.headers['content-range'],
      },
      statusCode: response.status,
    };
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string): Promise<MediaSenseResponse<any>> {
    return this.request('GET', `${this.endpoints.querySessionById}/${sessionId}`);
  }

  /**
   * Ensure we have a valid session
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.session || new Date() > this.session.expiresAt) {
      await this.login();
    }
  }

  // ==================== Helper Methods ====================

  private extractJSessionId(cookies: string[]): string | null {
    if (!cookies || cookies.length === 0) {
      return null;
    }

    for (const cookie of cookies) {
      if (!cookie || typeof cookie !== 'string') {
        continue;
      }

      // MediaSense may use JSESSIONIDSSO (Single Sign-On cookie)
      // Try JSESSIONIDSSO first (Cisco-specific)
      const ssoMatch = cookie.match(/JSESSIONIDSSO\s*=\s*([^;\s,]+)/i);
      if (ssoMatch && ssoMatch[1]) {
        return ssoMatch[1].trim();
      }
      
      // Fallback to standard JSESSIONID
      const match = cookie.match(/JSESSIONID\s*=\s*([^;\s,]+)/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  private getSessionHeaders(): Record<string, string> {
    if (!this.session || !this.config) return {};

    const headers: Record<string, string> = {};

    // Per Cisco MediaSense Developer Guide (9.x), JSESSIONID is passed as a HEADER parameter
    // (not only as a Cookie). Newer web UI flows may use Cookie: JSESSIONID=..., so we send both
    // when we have a real (non-basic) session id.
    if (this.session.sessionId && !this.session.sessionId.startsWith('basic-')) {
      headers['JSESSIONID'] = this.session.sessionId;
    }

    // MediaSense 11.5 uses JSESSIONID (from reverse engineering)
    // Try JSESSIONID first (real format), then JSESSIONIDSSO as fallback
    const jsessionCookie = this.session.cookies.find(c => 
      c.includes('JSESSIONID')
    );
    if (jsessionCookie) {
      // Extract JSESSIONID value (MediaSense 11.5 uses JSESSIONID, not JSESSIONIDSSO)
      const jsessionId = this.extractJSessionId([jsessionCookie]);
      if (jsessionId) {
        // Use JSESSIONID (MediaSense 11.5 format from reverse engineering)
        const cookieName = jsessionCookie.includes('JSESSIONIDSSO') ? 'JSESSIONIDSSO' : 'JSESSIONID';
        headers['Cookie'] = `${cookieName}=${jsessionId}`;
        // Ensure header form is present too (some versions accept only header)
        if (!this.session.sessionId.startsWith('basic-')) {
          headers['JSESSIONID'] = jsessionId;
        }
        // Also include Basic Auth as fallback (some endpoints may need both)
        const auth = Buffer.from(
          `${this.config.apiKey}:${this.config.apiSecret}`,
        ).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
        return headers;
      }
    } else if (this.session.cookies.length > 0) {
      // Fallback to all cookies
      const cookieHeader = this.session.cookies
        .map((c) => c.split(';')[0])
        .join('; ');
      headers['Cookie'] = cookieHeader;
    }

    // If no JSESSIONID, always include Basic Auth for all requests
    // Some MediaSense versions/endpoints may accept Basic Auth even for query endpoints
    const auth = Buffer.from(
      `${this.config.apiKey}:${this.config.apiSecret}`,
    ).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;

    // Also try to include Basic Auth even if we have JSESSIONID (some endpoints may need both)
    // This is a fallback strategy for endpoints that don't work with JSESSIONID alone
    if (jsessionCookie && this.session.sessionId.startsWith('basic-')) {
      // We have both - use both
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
