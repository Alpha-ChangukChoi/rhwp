import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ChatMessage } from '../chat/chat.types';
import { Session, SessionId } from './session.types';
import { SessionExpiredError, SessionNotFoundError } from './session.errors';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly store = new Map<SessionId, Session>();
  private readonly ttlMs: number;
  private readonly maxHistory: number;

  constructor(config: ConfigService) {
    this.ttlMs = config.getOrThrow<number>('SESSION_TTL_MS');
    this.maxHistory = config.getOrThrow<number>('SESSION_MAX_HISTORY');
  }

  // R-4-B: 서버 자동 발급 (UUID v4)
  // R-4-B 보강: initialMessages 옵셔널
  create(initialMessages: ChatMessage[] = []): SessionId {
    const id = randomUUID();
    const now = Date.now();
    this.store.set(id, {
      id,
      messages: [...initialMessages],
      createdAt: now,
      lastAccessedAt: now,
    });
    this.logger.log(`session created id=${id}`);
    return id;
  }

  // R-4-C: sliding TTL — get/append 시 lastAccessedAt 갱신
  // R-4-E: expired/없음 → 에러 throw
  // R-4-H: lazy on-access expire 검사
  get(id: SessionId): Session {
    const session = this.store.get(id);
    if (!session) throw new SessionNotFoundError(id);
    if (this.isExpired(session)) {
      this.store.delete(id);
      throw new SessionExpiredError(id);
    }
    session.lastAccessedAt = Date.now();
    return session;
  }

  // R-4-F: max history 초과 시 FIFO drop (system 메시지 보존)
  append(id: SessionId, message: ChatMessage): void {
    const session = this.get(id);
    session.messages.push(message);
    this.enforceMaxHistory(session);
  }

  expire(id: SessionId): void {
    if (!this.store.has(id)) throw new SessionNotFoundError(id);
    this.store.delete(id);
    this.logger.log(`session expired id=${id}`);
  }

  size(): number {
    return this.store.size;
  }

  has(id: SessionId): boolean {
    return this.store.has(id);
  }

  private isExpired(session: Session): boolean {
    return Date.now() - session.lastAccessedAt > this.ttlMs;
  }

  private enforceMaxHistory(session: Session): void {
    if (session.messages.length <= this.maxHistory) return;

    const systemMessages = session.messages.filter((m) => m.role === 'system');
    const nonSystem = session.messages.filter((m) => m.role !== 'system');
    const totalBudget = this.maxHistory - systemMessages.length;
    const trimmed = totalBudget > 0 ? nonSystem.slice(-totalBudget) : [];
    const dropped = session.messages.length - (systemMessages.length + trimmed.length);
    session.messages = [...systemMessages, ...trimmed];
    this.logger.log(
      `session ${session.id} history trimmed: dropped=${dropped}`,
    );
  }
}
