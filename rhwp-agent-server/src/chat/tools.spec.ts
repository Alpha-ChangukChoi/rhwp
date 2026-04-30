import {
  TOOLS,
  TOOL_SCHEMAS,
  InsertTextArgs,
  GetDocumentTextArgs,
  DeleteRangeArgs,
  ReplaceTextArgs,
} from './tools';

describe('tools (zod schemas + OpenAI spec)', () => {
  it('TOOLS array 에 4개 도구 정의', () => {
    expect(TOOLS).toHaveLength(4);
    const names = TOOLS.map((t) => t.function.name);
    expect(names).toEqual([
      'get_document_text',
      'insert_text',
      'delete_range',
      'replace_text',
    ]);
  });

  it('각 tool 의 type 이 function, parameters 가 JSON Schema object', () => {
    for (const tool of TOOLS) {
      expect(tool.type).toBe('function');
      expect(tool.function.parameters).toBeDefined();
      expect((tool.function.parameters as any).type).toBe('object');
    }
  });

  it('TOOL_SCHEMAS 가 4개 zod 스키마 매핑', () => {
    expect(Object.keys(TOOL_SCHEMAS)).toEqual([
      'get_document_text',
      'insert_text',
      'delete_range',
      'replace_text',
    ]);
  });

  it('zod 스키마: 정상 인자 parse', () => {
    expect(GetDocumentTextArgs.parse({})).toEqual({});
    expect(InsertTextArgs.parse({ position: 0, text: 'hi' })).toEqual({
      position: 0,
      text: 'hi',
    });
    expect(DeleteRangeArgs.parse({ start: 0, end: 5 })).toEqual({
      start: 0,
      end: 5,
    });
    expect(ReplaceTextArgs.parse({ query: 'a', replacement: '' })).toEqual({
      query: 'a',
      replacement: '',
    });
  });

  it('zod 스키마: 잘못된 인자 reject', () => {
    expect(() => InsertTextArgs.parse({ position: -1, text: 'x' })).toThrow();
    expect(() => InsertTextArgs.parse({ position: 0, text: '' })).toThrow();
    expect(() =>
      InsertTextArgs.parse({ position: 'not number', text: 'x' }),
    ).toThrow();
    expect(() => ReplaceTextArgs.parse({ query: '', replacement: '' })).toThrow();
  });
});
