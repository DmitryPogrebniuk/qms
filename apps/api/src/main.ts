import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
// import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

const logger = new Logger('Main');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // Security middleware
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation - TEMPORARILY DISABLED due to module compatibility issues
  // const config = new DocumentBuilder()
  //   .setTitle('Cisco QMS API')
  //   .setDescription('Quality Management System for Cisco UCCX, MediaSense, and CCP')
  //   .setVersion('1.0.0')
  //   .addBearerAuth(
  //     {
  //       type: 'http',
  //       scheme: 'bearer',
  //       bearerFormat: 'JWT',
  //     },
  //     'Bearer',
  //   )
  //   .addTag('Auth', 'Authentication endpoints')
  //   .addTag('Recordings', 'Recording metadata and search')
  //   .addTag('Chats', 'Chat metadata and search')
  //   .addTag('Evaluations', 'Quality evaluations')
  //   .addTag('Coaching', 'Coaching plans')
  //   .addTag('Sampling', 'Sampling engine')
  //   .addTag('Users', 'User and RBAC management')
  //   .addTag('Admin', 'System administration')
  //   .build();

  // const document = SwaggerModule.createDocument(app, config);
  // SwaggerModule.setup('api/docs', app, document);

  const port = process.env.API_PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 API server running on http://localhost:${port}`);
  // logger.log(`📚 API docs available at http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  logger.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
