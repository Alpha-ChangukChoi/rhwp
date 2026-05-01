import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ChatExceptionFilter } from './chat.exception-filter';
import {
  SessionExpiredError,
  SessionNotFoundError,
} from '../session/session.errors';
import { OpenAiError } from './chat.errors';

describe('ChatExceptionFilter', () => {
  let filter: ChatExceptionFilter;
  let response: { status: jest.Mock; json: jest.Mock };
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new ChatExceptionFilter();
    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ArgumentsHost;
  });

  it('SessionNotFoundError → 404', () => {
    filter.catch(new SessionNotFoundError('sid-x'), host);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 404,
      error: 'SessionNotFoundError',
    }));
  });

  it('SessionExpiredError → 410', () => {
    filter.catch(new SessionExpiredError('sid-x'), host);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.GONE);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 410,
      error: 'SessionExpiredError',
    }));
  });

  it('OpenAiError → 502', () => {
    filter.catch(new OpenAiError('upstream fail'), host);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 502,
      error: 'OpenAiError',
    }));
  });
});
