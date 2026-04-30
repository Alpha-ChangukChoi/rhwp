import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { envSchema } from './../src/config/env.schema';

// AppModule 을 import 하면 ConfigModule.forRoot 가 한 번만 평가되어 캐싱되므로
// 본 스펙은 ConfigModule 을 인라인으로 매번 새로 구성하여 검증한다.
const buildModule = () =>
  Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: false,
        ignoreEnvFile: true,
        validationSchema: envSchema,
        validationOptions: { abortEarly: false },
      }),
    ],
  }).compile();

describe('ConfigModule env validation', () => {
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  it('OPENAI_API_KEY 누락 시 모듈 컴파일 실패', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(buildModule()).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it('OPENAI_API_KEY 있으면 정상 컴파일 + 기본값 적용', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const moduleRef = await buildModule();
    const config = moduleRef.get(ConfigService);
    expect(config.get('OPENAI_MODEL')).toBe('gpt-5.4');
    expect(config.get('OPENAI_TIMEOUT_MS')).toBe(30000);
    expect(config.get('PORT')).toBe(3000);
    await moduleRef.close();
  });
});
