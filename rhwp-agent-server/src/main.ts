import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // R-6-C: CORS — 환경변수의 명시 origin list
  const allowedOrigins = config
    .getOrThrow<string>('CORS_ALLOWED_ORIGINS')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
  });

  // R-6-B: ValidationPipe 글로벌 — 모든 DTO 자동 검증
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`rhwp-agent-server listening on :${port}`);
}
bootstrap();
