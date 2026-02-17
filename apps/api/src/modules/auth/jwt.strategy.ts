import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const base = {
      sub: payload.sub,
      preferred_username: payload.preferred_username,
      email: payload.email,
      name: payload.name,
      roles: payload.roles || [],
      role: payload.roles?.[0],
    };

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { agentId: true, teamCodes: true, role: true },
    });

    if (user) {
      return {
        ...base,
        agentId: user.agentId ?? undefined,
        teamCodes: user.teamCodes ?? [],
        role: user.role || base.role,
      };
    }

    return base;
  }
}
