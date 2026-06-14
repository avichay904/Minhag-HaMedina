import 'reflect-metadata';
import { existsSync, mkdirSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe, patchNestJsSwagger } from 'nestjs-zod';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const prefix = config.get<string>('apiPrefix') ?? 'api/v1';
  const isProd = process.env.NODE_ENV === 'production';

  // ─── Security headers ────────────────────────────────────────────────────
  // Use sensible helmet defaults. Relax CSP directives only for the Swagger
  // UI so that its inline scripts and CDN assets can load in development.
  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? undefined // strict in production
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
              styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
              imgSrc: ["'self'", 'data:', 'cdn.jsdelivr.net'],
            },
          },
    }),
  );

  // Disable X-Powered-By (also covered by helmet, but belt-and-suspenders)
  app.disable('x-powered-by');

  // ─── Body size limit (1 MB for JSON; upload route bypasses this via multer) ──
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ─── CORS ────────────────────────────────────────────────────────────────
  const corsOrigins = config.get<string[]>('cors.origins') ?? [];

  if (!isProd || corsOrigins.length === 0) {
    // Dev: reflect origin so local web/mobile clients keep working.
    app.enableCors({ origin: true, credentials: true });
  } else {
    // Production: strict allowlist only.
    app.enableCors({
      origin: corsOrigins,
      credentials: true,
    });
  }

  // ─── Global prefix + pipes ───────────────────────────────────────────────
  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(new ZodValidationPipe());

  // ─── Static file serving for uploads ────────────────────────────────────
  const uploadsDirRaw = config.get<string>('uploads.dir') ?? './uploads';
  const uploadsDir = isAbsolute(uploadsDirRaw)
    ? uploadsDirRaw
    : join(process.cwd(), uploadsDirRaw);
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

  // ─── Swagger ─────────────────────────────────────────────────────────────
  patchNestJsSwagger();
  const docConfig = new DocumentBuilder()
    .setTitle('Minhag HaMedina API')
    .setDescription('Public-opinion survey platform — Phase A')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Source', in: 'header' }, 'X-Source')
    .build();
  const document = SwaggerModule.createDocument(app, docConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`API ready at http://localhost:${port}/${prefix} · docs at /api/docs`);
}

void bootstrap();
