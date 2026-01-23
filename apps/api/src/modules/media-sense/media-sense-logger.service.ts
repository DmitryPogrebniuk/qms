import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * MediaSense Integration Logger
 * 
 * Dedicated logger for MediaSense integration with:
 * - File-based rotating logs
 * - Runtime log level switching
 * - API for UI log viewer
 * - Sensitive data masking
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, any>;
  requestId?: string;
}

export interface LogQueryResult {
  lines: LogEntry[];
  nextCursor: string | null;
  hasMore: boolean;
  lastUpdated: string;
  totalLines: number;
}

@Injectable()
export class MediaSenseLogger implements OnModuleInit {
  private currentLevel: LogLevel = LogLevel.INFO;
  private logDir: string;
  private currentLogFile: string;
  private maxFileSize: number = 50 * 1024 * 1024; // 50MB
  private maxFiles: number = 10;
  private inMemoryBuffer: LogEntry[] = [];
  private maxBufferSize: number = 1000; // Keep last 1000 entries in memory

  // Patterns for masking sensitive data
  private readonly sensitivePatterns = [
    { pattern: /password['":\s]*['":]?\s*['"]?([^'"\s,}]+)/gi, replacement: 'password: ***' },
    { pattern: /secret['":\s]*['":]?\s*['"]?([^'"\s,}]+)/gi, replacement: 'secret: ***' },
    { pattern: /apiKey['":\s]*['":]?\s*['"]?([^'"\s,}]+)/gi, replacement: 'apiKey: ***' },
    { pattern: /apiSecret['":\s]*['":]?\s*['"]?([^'"\s,}]+)/gi, replacement: 'apiSecret: ***' },
    { pattern: /JSESSIONID=([^;\s]+)/gi, replacement: 'JSESSIONID=***' },
    { pattern: /Authorization:\s*(Basic|Bearer)\s+([^\s]+)/gi, replacement: 'Authorization: $1 ***' },
    { pattern: /Cookie:\s*([^\n]+)/gi, replacement: 'Cookie: [masked]' },
  ];

  constructor(private readonly configService: ConfigService) {
    this.logDir = this.configService.get<string>('MEDIASENSE_LOG_DIR') || 
                  path.join(process.cwd(), 'logs', 'mediasense');
    this.currentLogFile = path.join(this.logDir, 'mediasense-integration.log');
    
    const configLevel = this.configService.get<string>('MEDIASENSE_LOG_LEVEL') || 'INFO';
    this.currentLevel = this.parseLogLevel(configLevel);
  }

  onModuleInit() {
    this.ensureLogDirectory();
    this.info('MediaSense logger initialized', { 
      level: LogLevel[this.currentLevel],
      logDir: this.logDir 
    });
  }

  /**
   * Set log level at runtime
   */
  setLevel(level: LogLevel | string): void {
    const newLevel = typeof level === 'string' ? this.parseLogLevel(level) : level;
    const oldLevel = this.currentLevel;
    this.currentLevel = newLevel;
    
    this.info(`Log level changed from ${LogLevel[oldLevel]} to ${LogLevel[newLevel]}`, {
      oldLevel: LogLevel[oldLevel],
      newLevel: LogLevel[newLevel],
    });
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.currentLevel;
  }

  getLevelName(): string {
    return LogLevel[this.currentLevel];
  }

  /**
   * Log methods
   */
  error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (level > this.currentLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message: this.maskSensitiveData(message),
      context: context ? this.maskContextData(context) : undefined,
      requestId: context?.requestId,
    };

    // Add to in-memory buffer
    this.inMemoryBuffer.push(entry);
    if (this.inMemoryBuffer.length > this.maxBufferSize) {
      this.inMemoryBuffer.shift();
    }

    // Write to file
    this.writeToFile(entry);

    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
      const consoleMethod = level === LogLevel.ERROR ? console.error :
                           level === LogLevel.WARN ? console.warn :
                           console.log;
      consoleMethod(`[MediaSense] [${entry.level}] ${entry.message}`, context || '');
    }
  }

  /**
   * Query logs with filtering and pagination
   */
  async queryLogs(params: {
    level?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
    cursor?: string;
    limit?: number;
    search?: string;
  }): Promise<LogQueryResult> {
    const { level = 'INFO', cursor, limit = 100, search } = params;
    const requestedLevel = this.parseLogLevel(level);

    // Filter in-memory buffer
    let filteredLogs = this.inMemoryBuffer.filter((entry) => {
      const entryLevel = this.parseLogLevel(entry.level);
      if (entryLevel > requestedLevel) return false;
      if (search && !entry.message.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    // Apply cursor (timestamp-based pagination)
    if (cursor) {
      const cursorTime = new Date(cursor).getTime();
      filteredLogs = filteredLogs.filter(
        (entry) => new Date(entry.timestamp).getTime() < cursorTime,
      );
    }

    // Sort by timestamp descending (newest first)
    filteredLogs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    // Apply limit
    const hasMore = filteredLogs.length > limit;
    const resultLogs = filteredLogs.slice(0, limit);

    const nextCursor = hasMore && resultLogs.length > 0
      ? resultLogs[resultLogs.length - 1].timestamp
      : null;

    return {
      lines: resultLogs,
      nextCursor,
      hasMore,
      lastUpdated: new Date().toISOString(),
      totalLines: this.inMemoryBuffer.length,
    };
  }

  /**
   * Read logs from file (for historical data)
   */
  async readLogsFromFile(params: {
    level?: string;
    lines?: number;
    offset?: number;
  }): Promise<LogEntry[]> {
    const { level = 'INFO', lines = 100, offset = 0 } = params;

    try {
      if (!fs.existsSync(this.currentLogFile)) {
        return [];
      }

      const fileContent = fs.readFileSync(this.currentLogFile, 'utf-8');
      const logLines = fileContent.trim().split('\n').filter(Boolean);

      const entries: LogEntry[] = [];
      const requestedLevel = this.parseLogLevel(level);

      for (const line of logLines) {
        try {
          const entry = JSON.parse(line) as LogEntry;
          const entryLevel = this.parseLogLevel(entry.level);
          if (entryLevel <= requestedLevel) {
            entries.push(entry);
          }
        } catch {
          // Skip malformed lines
        }
      }

      // Sort descending and apply pagination
      entries.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return entries.slice(offset, offset + lines);
    } catch (error) {
      console.error('Error reading log file:', error);
      return [];
    }
  }

  /**
   * Clear logs
   */
  async clearLogs(): Promise<void> {
    // Clear in-memory buffer
    this.inMemoryBuffer = [];

    // Rotate/clear log file
    try {
      if (fs.existsSync(this.currentLogFile)) {
        const archiveName = `mediasense-integration.${Date.now()}.log`;
        const archivePath = path.join(this.logDir, archiveName);
        fs.renameSync(this.currentLogFile, archivePath);
        
        // Clean up old archives
        this.cleanupOldLogs();
      }
    } catch (error) {
      console.error('Error clearing log file:', error);
    }

    this.info('Logs cleared', { clearedAt: new Date().toISOString() });
  }

  // ==================== Private Methods ====================

  private parseLogLevel(level: string): LogLevel {
    const normalized = level.toUpperCase();
    if (normalized === 'ERROR' || normalized === 'CRITICAL') return LogLevel.ERROR;
    if (normalized === 'WARN' || normalized === 'WARNING') return LogLevel.WARN;
    if (normalized === 'INFO') return LogLevel.INFO;
    if (normalized === 'DEBUG') return LogLevel.DEBUG;
    return LogLevel.INFO;
  }

  private maskSensitiveData(text: string): string {
    let masked = text;
    for (const { pattern, replacement } of this.sensitivePatterns) {
      masked = masked.replace(pattern, replacement);
    }
    return masked;
  }

  private maskContextData(context: Record<string, any>): Record<string, any> {
    const masked: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();
      
      // Completely mask sensitive keys
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('cookie') ||
        lowerKey.includes('token')
      ) {
        masked[key] = '***';
        continue;
      }

      // Recursively process nested objects
      if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskContextData(value);
      } else if (typeof value === 'string') {
        masked[key] = this.maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private writeToFile(entry: LogEntry): void {
    try {
      this.ensureLogDirectory();
      this.checkAndRotate();

      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.currentLogFile, line);
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }

  private checkAndRotate(): void {
    try {
      if (!fs.existsSync(this.currentLogFile)) return;

      const stats = fs.statSync(this.currentLogFile);
      if (stats.size >= this.maxFileSize) {
        const archiveName = `mediasense-integration.${Date.now()}.log`;
        const archivePath = path.join(this.logDir, archiveName);
        fs.renameSync(this.currentLogFile, archivePath);
        this.cleanupOldLogs();
      }
    } catch (error) {
      console.error('Error rotating log file:', error);
    }
  }

  private cleanupOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter((f) => f.startsWith('mediasense-integration.') && f !== 'mediasense-integration.log')
        .map((f) => ({
          name: f,
          path: path.join(this.logDir, f),
          time: fs.statSync(path.join(this.logDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      // Keep only maxFiles
      for (const file of files.slice(this.maxFiles)) {
        fs.unlinkSync(file.path);
      }
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
    }
  }
}
