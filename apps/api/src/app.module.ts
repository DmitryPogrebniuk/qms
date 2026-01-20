import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RecordingsModule } from './modules/recordings/recordings.module';
import { ChatsModule } from './modules/chats/chats.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { CoachingModule } from './modules/coaching/coaching.module';
import { SamplingModule } from './modules/sampling/sampling.module';
import { UccxModule } from './modules/uccx/uccx.module';
import { MediaSenseModule } from './modules/media-sense/media-sense.module';
import { OpenSearchModule } from './modules/opensearch/opensearch.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RbacGuard } from './common/guards/rbac.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { configValidationSchema } from './config/config.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      validationSchema: configValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RecordingsModule,
    ChatsModule,
    EvaluationsModule,
    CoachingModule,
    SamplingModule,
    UccxModule,
    MediaSenseModule,
    OpenSearchModule,
    IntegrationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
