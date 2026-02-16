import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';

const DEFAULT_INACTIVITY_MS = 10 * 60 * 1000; // 10 min
const DEFAULT_ABSOLUTE_MS = 8 * 60 * 60 * 1000; // 8 hours

@Injectable()
export class SessionService {
  private readonly inactivityMs: number;
  private readonly absoluteMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.inactivityMs =
      this.configService.get<number>('SESSION_INACTIVITY_TIMEOUT_MS') ?? DEFAULT_INACTIVITY_MS;
    this.absoluteMs =
      this.configService.get<number>('SESSION_ABSOLUTE_TIMEOUT_MS') ?? DEFAULT_ABSOLUTE_MS;
  }

  /**
   * Create session on login
   */
  async createSession(
    userId: string,
    opts?: { ipAddress?: string; userAgent?: string },
  ): Promise<string> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.absoluteMs);

    const session = await this.prisma.session.create({
      data: {
        userId,
        lastActivityAt: now,
        expiresAt,
        ipAddress: opts?.ipAddress,
        userAgent: opts?.userAgent,
      },
    });

    return session.id;
  }

  /**
   * Validate session and update lastActivityAt (sliding window).
   * Returns true if valid, false if expired/invalid.
   */
  async validateAndTouch(sessionId: string): Promise<boolean> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return false;
    }

    const now = new Date();

    // Absolute timeout
    if (now > session.expiresAt) {
      await this.prisma.session.delete({ where: { id: sessionId } });
      return false;
    }

    // Inactivity timeout
    const inactiveMs = now.getTime() - session.lastActivityAt.getTime();
    if (inactiveMs > this.inactivityMs) {
      await this.prisma.session.delete({ where: { id: sessionId } });
      return false;
    }

    // Touch: update lastActivityAt
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastActivityAt: now },
    });

    return true;
  }

  /**
   * Invalidate session (logout)
   */
  async invalidate(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  /**
   * Invalidate all sessions for user
   */
  async invalidateAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.session.deleteMany({ where: { userId } });
    return result.count;
  }

  /**
   * Cleanup expired sessions (cron/maintenance)
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
