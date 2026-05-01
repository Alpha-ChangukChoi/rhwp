jest.mock('openai');

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from './../src/chat/openai.factory';
import { AppModule } from './../src/app.module';

describe('ChatController (HTTP e2e, mocked openai)', () => {
  let app: INestApplication;
  let openaiCreate: jest.Mock;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    // R-6-C: main.ts 와 동일한 CORS 설정 (e2e 에서 preflight 검증)
    app.enableCors({
      origin: [
        'http://localhost:7700',
        'http://localhost:4173',
        'http://localhost:7711',
        'http://localhost:7712',
      ],
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
      credentials: false,
    });
    // R-6-B: main.ts 와 동일한 ValidationPipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const openai = moduleRef.get<OpenAI>(OPENAI_CLIENT);
    openaiCreate = openai.chat.completions.create as unknown as jest.Mock;
  });

  afterEach(async () => {
    await app.close();
  });

  // ── 1. 정상 시나리오 (2건)
  it('POST /chat/session → 201 + sessionId', async () => {
    const res = await request(app.getHttpServer())
      .post('/chat/session')
      .expect(201);
    expect(res.body.sessionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('POST /chat/session/:id/messages → 201 + reply', async () => {
    openaiCreate.mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: 'hello!' } }],
    });
    const sessionRes = await request(app.getHttpServer())
      .post('/chat/session')
      .expect(201);
    const sid = sessionRes.body.sessionId;

    const t0 = Date.now();
    const messageRes = await request(app.getHttpServer())
      .post(`/chat/session/${sid}/messages`)
      .send({ content: 'hi' })
      .expect(201);
    const elapsed = Date.now() - t0;

    expect(messageRes.body.reply).toEqual({
      role: 'assistant',
      content: 'hello!',
    });
    // R-009: mock OpenAI < 700ms
    expect(elapsed).toBeLessThan(700);
  });

  // ── 2. R-6-D 에러 매핑 (2건)
  it('POST /chat/session/:bad-id/messages → 404 (SessionNotFoundError)', async () => {
    await request(app.getHttpServer())
      .post('/chat/session/non-existent/messages')
      .send({ content: 'x' })
      .expect(404);
  });

  it('OpenAI 에러 → 502', async () => {
    openaiCreate.mockRejectedValueOnce(new Error('upstream rate limit'));
    const sessionRes = await request(app.getHttpServer()).post(
      '/chat/session',
    );
    const sid = sessionRes.body.sessionId;
    await request(app.getHttpServer())
      .post(`/chat/session/${sid}/messages`)
      .send({ content: 'x' })
      .expect(502);
  });

  // ── 3. R-6-B DTO 검증 (3건)
  it('POST /chat/session/:id/messages — content 부재 → 400', async () => {
    const sessionRes = await request(app.getHttpServer()).post(
      '/chat/session',
    );
    const sid = sessionRes.body.sessionId;
    await request(app.getHttpServer())
      .post(`/chat/session/${sid}/messages`)
      .send({})
      .expect(400);
  });

  it('content max length 초과 → 400 (R-009)', async () => {
    const sessionRes = await request(app.getHttpServer()).post(
      '/chat/session',
    );
    const sid = sessionRes.body.sessionId;
    await request(app.getHttpServer())
      .post(`/chat/session/${sid}/messages`)
      .send({ content: 'x'.repeat(13000) })
      .expect(400);
  });

  it('whitelist — DTO 외 필드 → 400', async () => {
    const sessionRes = await request(app.getHttpServer()).post(
      '/chat/session',
    );
    const sid = sessionRes.body.sessionId;
    await request(app.getHttpServer())
      .post(`/chat/session/${sid}/messages`)
      .send({ content: 'hi', evil: 'extra' })
      .expect(400);
  });

  // ── 4. R-6-C CORS preflight (2건)
  it('OPTIONS /chat/session — preflight 응답 (R-6-C)', async () => {
    const res = await request(app.getHttpServer())
      .options('/chat/session')
      .set('Origin', 'http://localhost:7700')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:7700',
    );
    expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
  });

  it('CORS — 허용 외 Origin 거부 (R-6-C)', async () => {
    const res = await request(app.getHttpServer())
      .options('/chat/session')
      .set('Origin', 'http://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  // ── 5. 멀티턴 (1건, R-5-D / #5 호환)
  it('두 번째 메시지 — sessionId 재사용', async () => {
    openaiCreate
      .mockResolvedValueOnce({
        choices: [{ message: { role: 'assistant', content: 'r1' } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { role: 'assistant', content: 'r2' } }],
      });
    const sessionRes = await request(app.getHttpServer()).post(
      '/chat/session',
    );
    const sid = sessionRes.body.sessionId;

    const r1 = await request(app.getHttpServer())
      .post(`/chat/session/${sid}/messages`)
      .send({ content: 'first' });
    expect(r1.body.reply.content).toBe('r1');

    const r2 = await request(app.getHttpServer())
      .post(`/chat/session/${sid}/messages`)
      .send({ content: 'second' });
    expect(r2.body.reply.content).toBe('r2');

    // 두 번째 호출 시 messages 에 first + r1 + second 포함
    const secondCallMessages = openaiCreate.mock.calls[1][0].messages;
    expect(secondCallMessages.length).toBe(3);
  });
});
