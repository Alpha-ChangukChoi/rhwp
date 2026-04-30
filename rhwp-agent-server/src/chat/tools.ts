import { z } from 'zod';

// ===== zod 스키마 (단일 진실 원천) =====

export const GetDocumentTextArgs = z.object({
  range: z
    .object({
      start: z.number().int().min(0),
      end: z.number().int().min(0),
    })
    .optional(),
});

export const InsertTextArgs = z.object({
  position: z.number().int().min(0),
  text: z.string().min(1),
});

export const DeleteRangeArgs = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(0),
});

export const ReplaceTextArgs = z.object({
  query: z.string().min(1),
  replacement: z.string(),
});

// ===== TS 타입 (zod 추론) =====

export type GetDocumentTextArgsT = z.infer<typeof GetDocumentTextArgs>;
export type InsertTextArgsT = z.infer<typeof InsertTextArgs>;
export type DeleteRangeArgsT = z.infer<typeof DeleteRangeArgs>;
export type ReplaceTextArgsT = z.infer<typeof ReplaceTextArgs>;

// ===== zod 스키마 → 도구 이름 매핑 (executor 용) =====

export const TOOL_SCHEMAS = {
  get_document_text: GetDocumentTextArgs,
  insert_text: InsertTextArgs,
  delete_range: DeleteRangeArgs,
  replace_text: ReplaceTextArgs,
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

// ===== OpenAI tool spec (zod → JSON Schema 자동 변환) =====

export const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_document_text',
      description: '현재 문서 또는 지정 범위의 텍스트를 읽는다',
      parameters: z.toJSONSchema(GetDocumentTextArgs),
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'insert_text',
      description: '지정 위치에 텍스트를 삽입한다',
      parameters: z.toJSONSchema(InsertTextArgs),
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_range',
      description: 'start ~ end 범위의 텍스트를 삭제한다',
      parameters: z.toJSONSchema(DeleteRangeArgs),
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'replace_text',
      description: 'query 와 일치하는 텍스트를 replacement 로 치환한다',
      parameters: z.toJSONSchema(ReplaceTextArgs),
    },
  },
];
