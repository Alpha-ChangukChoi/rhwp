import { StubToolExecutor } from './tool-executor';

describe('StubToolExecutor', () => {
  let executor: StubToolExecutor;

  beforeEach(() => {
    executor = new StubToolExecutor();
  });

  it('get_document_text 응답 (range 없이)', async () => {
    const result = await executor.execute('get_document_text', {});
    expect(result).toEqual({ text: expect.stringContaining('stub') });
  });

  it('get_document_text 응답 (range 있음)', async () => {
    const result = await executor.execute('get_document_text', {
      range: { start: 0, end: 10 },
    });
    expect(result).toEqual({ text: expect.stringContaining('stub') });
  });

  it('insert_text 응답', async () => {
    const result = await executor.execute('insert_text', {
      position: 5,
      text: 'hello',
    });
    expect(result).toEqual({ ok: true, inserted_at: 5 });
  });

  it('delete_range 응답', async () => {
    const result = await executor.execute('delete_range', {
      start: 3,
      end: 13,
    });
    expect(result).toEqual({ ok: true, deleted_chars: 10 });
  });

  it('replace_text 응답', async () => {
    const result = await executor.execute('replace_text', {
      query: 'a',
      replacement: 'b',
    });
    expect(result).toEqual({ ok: true, replaced_count: 0 });
  });

  it('unknown tool throw', async () => {
    await expect(executor.execute('not_a_tool', {})).rejects.toThrow(
      /unknown tool/,
    );
  });

  it('잘못된 인자 throw (zod 검증)', async () => {
    await expect(
      executor.execute('insert_text', { position: -1, text: 'x' }),
    ).rejects.toThrow();

    await expect(
      executor.execute('insert_text', { position: 0, text: '' }),
    ).rejects.toThrow();
  });
});
