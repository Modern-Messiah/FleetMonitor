import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppLogger } from './common/logger/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const port = Number(process.env.PORT || 3000);
  const corsOriginsFromEnv = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedCorsOrigins = new Set([
    'http://localhost:8080',
    'http://0.0.0.0:8080',
    ...corsOriginsFromEnv,
  ]);

  const logger = app.get(AppLogger);
  app.useLogger(logger);
  app.enableCors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || allowedCorsOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = Date.now();
    response.on('finish', () => {
      logger.logHttp(
        request.method,
        request.originalUrl || request.url,
        response.statusCode,
        Date.now() - startedAt,
      );
    });
    next();
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fleet Monitor API')
    .setDescription('API for real-time fleet monitoring')
    .setVersion('1.0.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(port);
  logger.log(`Backend started on port ${port}`, 'Bootstrap');
}

bootstrap();
