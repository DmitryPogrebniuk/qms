import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { MediaSenseLogger } from './media-sense-logger.service';

/**
 * MediaSense Cookie Service
 * 
 * Automatically obtains JSESSIONID cookie from MediaSense web interface
 * using headless browser automation (Playwright).
 * 
 * This is a workaround for the issue where MediaSense API doesn't set
 * JSESSIONID cookies via direct API calls.
 */

export interface CookieResult {
  jsessionId: string;
  cookies: string[];
  expiresAt: Date;
  obtainedAt: Date;
}

@Injectable()
export class MediaSenseCookieService implements OnModuleDestroy {
  private readonly logger = new Logger('MediaSenseCookieService');
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private cachedCookie: CookieResult | null = null;
  private readonly CACHE_DURATION_MS = 25 * 60 * 1000; // 25 minutes (cookie expires in 30 min)

  constructor(
    private readonly configService: ConfigService,
    private readonly msLogger: MediaSenseLogger,
  ) {}

  async onModuleDestroy() {
    await this.cleanup();
  }

  /**
   * Get JSESSIONID cookie from MediaSense web interface
   * Uses cached cookie if still valid, otherwise fetches new one
   */
  async getJSessionId(
    baseUrl: string,
    username: string,
    password: string,
  ): Promise<CookieResult> {
    // Check cache first
    if (this.cachedCookie && this.isCacheValid(this.cachedCookie)) {
      this.msLogger.debug('Using cached JSESSIONID', {
        sessionIdMasked: this.maskSessionId(this.cachedCookie.jsessionId),
        expiresAt: this.cachedCookie.expiresAt.toISOString(),
      });
      return this.cachedCookie;
    }

    // Fetch new cookie
    return this.fetchJSessionIdFromWeb(baseUrl, username, password);
  }

  /**
   * Fetch JSESSIONID from MediaSense web interface using Playwright
   */
  private async fetchJSessionIdFromWeb(
    baseUrl: string,
    username: string,
    password: string,
  ): Promise<CookieResult> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.msLogger.info(`[${requestId}] Fetching JSESSIONID from web interface using Playwright`, {
      requestId,
      baseUrl: this.maskSensitiveUrl(baseUrl),
      username: username,
    });

    let page: Page | null = null;

    try {
      this.msLogger.debug(`[${requestId}] Checking browser instance...`);
      
      // Launch browser if not already launched
      if (!this.browser) {
        this.msLogger.info(`[${requestId}] Launching Chromium browser...`);
        // Use system Chromium in Docker, or download in development
        const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || 
                              (process.env.NODE_ENV === 'production' ? '/usr/bin/chromium' : undefined);

        try {
          this.browser = await chromium.launch({
            headless: true,
            executablePath,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--disable-web-security',
              '--ignore-certificate-errors',
              '--disable-software-rasterizer',
            ],
          });
          this.msLogger.info(`[${requestId}] Browser launched successfully`, {
            executablePath: executablePath || 'default',
          });
        } catch (browserError) {
          this.msLogger.error(`[${requestId}] Failed to launch browser`, {
            error: (browserError as Error).message,
            executablePath,
            stack: (browserError as Error).stack,
          });
          throw new Error(`Failed to launch browser: ${(browserError as Error).message}`);
        }

        // Create context with ignore HTTPS errors for self-signed certificates
        try {
          this.context = await this.browser.newContext({
            ignoreHTTPSErrors: true,
            viewport: { width: 1280, height: 720 },
          });
          this.msLogger.debug(`[${requestId}] Browser context created`);
        } catch (contextError) {
          this.msLogger.error(`[${requestId}] Failed to create browser context`, {
            error: (contextError as Error).message,
          });
          throw contextError;
        }
      } else {
        this.msLogger.debug(`[${requestId}] Using existing browser instance`);
      }

      // Create new page
      page = await this.context!.newPage();

      // Navigate to MediaSense login page
      const loginUrl = `${baseUrl}/`;
      this.msLogger.debug(`[${requestId}] Navigating to ${this.maskSensitiveUrl(loginUrl)}`);

      await page.goto(loginUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Wait for login form to appear (longer timeout for slow MediaSense / network)
      // MediaSense typically uses j_username and j_password fields
      await page.waitForSelector('input[name="j_username"], input[name="username"], input[type="text"]', {
        timeout: 20000,
      });

      // Fill in credentials
      // Try different possible field names
      const usernameField = await page.$('input[name="j_username"]') ||
                           await page.$('input[name="username"]') ||
                           await page.$('input[type="text"]');
      const passwordField = await page.$('input[name="j_password"]') ||
                           await page.$('input[name="password"]') ||
                           await page.$('input[type="password"]');

      if (!usernameField || !passwordField) {
        throw new Error('Login form fields not found');
      }

      await usernameField.fill(username);
      await passwordField.fill(password);

      // Submit form
      const submitButton = await page.$('input[type="submit"]') ||
                          await page.$('button[type="submit"]') ||
                          await page.$('button:has-text("Login")') ||
                          await page.$('button:has-text("Sign in")');

      if (submitButton) {
        await submitButton.click();
      } else {
        // Try pressing Enter
        await passwordField.press('Enter');
      }

      // Wait for navigation after login
      await page.waitForNavigation({
        waitUntil: 'networkidle',
        timeout: 30000,
      }).catch(() => {
        // Navigation might not happen, continue anyway
        this.msLogger.debug(`[${requestId}] No navigation after login, continuing`);
      });

      // Wait a bit for cookies to be set
      await page.waitForTimeout(2000);

      // Get cookies
      const cookies = await this.context!.cookies();
      const jsessionCookie = cookies.find(
        (c) => c.name === 'JSESSIONID' || c.name === 'JSESSIONIDSSO',
      );

      if (!jsessionCookie) {
        // Check if login failed by looking for error messages
        const pageContent = await page.content();
        const hasError = pageContent.includes('error') ||
                        pageContent.includes('invalid') ||
                        pageContent.includes('failed');

        if (hasError) {
          throw new Error('Login failed - check credentials');
        }

        // Log all cookies for debugging
        this.msLogger.warn(`[${requestId}] JSESSIONID cookie not found`, {
          cookiesFound: cookies.map((c) => c.name),
          url: page.url(),
        });

        throw new Error('JSESSIONID cookie not found after login');
      }

      const jsessionId = jsessionCookie.value;
      const expiresAt = jsessionCookie.expires
        ? new Date(jsessionCookie.expires * 1000)
        : new Date(Date.now() + 30 * 60 * 1000); // Default 30 min

      const result: CookieResult = {
        jsessionId,
        cookies: cookies.map((c) => `${c.name}=${c.value}`),
        expiresAt,
        obtainedAt: new Date(),
      };

      // Cache the result
      this.cachedCookie = result;

      const duration = Date.now() - startTime;
      this.msLogger.info(`[${requestId}] Successfully obtained JSESSIONID from web interface`, {
        requestId,
        duration,
        sessionIdMasked: this.maskSessionId(jsessionId),
        expiresAt: expiresAt.toISOString(),
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = (error as Error).message;

      this.msLogger.error(`[${requestId}] Failed to obtain JSESSIONID from web interface`, {
        requestId,
        duration,
        error: errorMessage,
      });

      // Cleanup on error
      if (page) {
        await page.close().catch(() => {});
      }

      throw new Error(`Failed to obtain JSESSIONID from web interface: ${errorMessage}`);
    }
  }

  /**
   * Check if cached cookie is still valid
   */
  private isCacheValid(cookie: CookieResult): boolean {
    const now = Date.now();
    const cacheAge = now - cookie.obtainedAt.getTime();
    const timeUntilExpiry = cookie.expiresAt.getTime() - now;

    // Cache is valid if:
    // 1. Less than CACHE_DURATION_MS old
    // 2. Still has at least 5 minutes until expiry
    return cacheAge < this.CACHE_DURATION_MS && timeUntilExpiry > 5 * 60 * 1000;
  }

  /**
   * Clear cached cookie (force refresh on next request)
   */
  clearCache(): void {
    this.cachedCookie = null;
    this.msLogger.debug('Cleared JSESSIONID cache');
  }

  /**
   * Cleanup browser resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.cachedCookie = null;
      this.logger.debug('Browser resources cleaned up');
    } catch (error) {
      this.logger.warn('Error during cleanup', { error: (error as Error).message });
    }
  }

  /**
   * Generate request ID for logging
   */
  private generateRequestId(): string {
    return `ms-cookie-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Mask sensitive URL in logs
   */
  private maskSensitiveUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}:${urlObj.port}${urlObj.pathname}`;
    } catch {
      return url.replace(/\/\/.*@/, '//***@');
    }
  }

  /**
   * Mask session ID in logs (show only first 8 and last 4 characters)
   */
  private maskSessionId(sessionId: string): string {
    if (!sessionId || sessionId.length < 12) {
      return '***';
    }
    return `${sessionId.substring(0, 8)}...${sessionId.substring(sessionId.length - 4)}`;
  }
}
