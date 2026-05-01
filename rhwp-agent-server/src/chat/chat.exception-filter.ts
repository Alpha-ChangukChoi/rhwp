import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  SessionExpiredError,
  SessionNotFoundError,
} from '../session/session.errors';
import { OpenAiError } from './chat.errors';

type DomainError = SessionNotFoundError | SessionExpiredError | OpenAiError;

/**
 * R-6-D: domain layer (Session*Error / OpenAiError) 를 HTTP layer 로 변환.
 * ChatService / SessionService 가 HTTP 무관 유지.
 */
@Catch(SessionNotFoundError, SessionExpiredError, OpenAiError)
export class ChatExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ChatExceptionFilter.name);

  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (code: number) => { json: (body: unknown) => unknown };
    }>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    if (exception instanceof SessionNotFoundError) {
      status = HttpStatus.NOT_FOUND;        // 404
    } else if (exception instanceof SessionExpiredError) {
      status = HttpStatus.GONE;             // 410
    } else if (exception instanceof OpenAiError) {
      status = HttpStatus.BAD_GATEWAY;      // 502
      this.logger.error(`OpenAI error: ${exception.message}`);
    }

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      error: exception.name,
    });
  }
}
