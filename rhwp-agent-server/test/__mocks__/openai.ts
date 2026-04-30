// jest 자동 모킹 대상: 'openai' 패키지
// jest.mock('openai') 한 곳에서만 활성화

export class OpenAI {
  apiKey: string;
  baseURL?: string;

  constructor(opts: { apiKey: string; baseURL?: string; timeout?: number }) {
    this.apiKey = opts.apiKey;
    this.baseURL = opts.baseURL;
  }

  chat = {
    completions: {
      create: jest.fn(async (params: any) => ({
        id: 'chatcmpl-mock-1',
        model: params.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: `mock response to: ${
                params.messages?.[params.messages.length - 1]?.content ?? ''
              }`,
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      })),
    },
  };
}

export default OpenAI;
