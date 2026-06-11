import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe, patchNestJsSwagger } from 'nestjs-zod';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const prefix = config.get<string>('apiPrefix') ?? 'api/v1';

  app.setGlobalPrefix(prefix);
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ZodValidationPipe());

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
