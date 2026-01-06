import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { json } from 'express';
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate:
    process.env.SENTRY_TRACES_SAMPLE_RATE !== undefined
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 0,
  profilesSampleRate:
    process.env.SENTRY_PROFILES_SAMPLE_RATE !== undefined
      ? Number(process.env.SENTRY_PROFILES_SAMPLE_RATE)
      : 0,
  release: process.env.npm_package_version
    ? `procur-api@${process.env.npm_package_version}`
    : undefined,
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Default JSON parser for all other routes, while capturing raw body for signature verification (e.g., WhatsApp)
  app.use(
    json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  const configService = app.get(ConfigService);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: [
      configService.get<string>('app.frontendUrl'),
      'http://localhost:3001',
      'http://localhost:3000',
      'https://procur-ui-eight.vercel.app',
      'http://localhost:3002',
      'https://procur-admin-ui.vercel.app',
      'https://www.procurapp.co',
      'https://procurapp.co',
      'https://admin.procurapp.co',
    ],
    credentials: true,
  });

  // API prefix
  const apiPrefix = configService.get<string>('app.apiPrefix');
  const apiVersion = configService.get<string>('app.apiVersion');
  app.setGlobalPrefix(`${apiPrefix}/${apiVersion}`);

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Procur API')
    .setDescription('The Procur platform API for procurement management')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Users', 'User management')
    .addTag('Organizations', 'Organization management')
    .addTag('Permissions', 'Permission and role management')
    .addTag('Sellers', 'Seller management and operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = configService.get<number>('port') || 3000;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
