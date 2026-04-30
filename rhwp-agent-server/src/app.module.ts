import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { envSchema } from './config/env.schema';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validationSchema: envSchema,
      validationOptions: { abortEarly: false },
    }),
    ChatModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
