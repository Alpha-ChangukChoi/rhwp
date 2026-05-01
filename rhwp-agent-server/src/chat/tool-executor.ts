import { Injectable, Logger } from '@nestjs/common';
import {
  TOOL_SCHEMAS,
  ToolName,
  InsertTextArgsT,
  DeleteRangeArgsT,
} from './tools';

export abstract class ToolExecutor {
  abstract execute(name: string, rawArgs: unknown): Promise<unknown>;
}

@Injectable()
export class StubToolExecutor extends ToolExecutor {
  private readonly logger = new Logger(StubToolExecutor.name);

  async execute(name: string, rawArgs: unknown): Promise<unknown> {
    if (!(name in TOOL_SCHEMAS)) {
      throw new Error(`unknown tool: ${name}`);
    }
    const schema = TOOL_SCHEMAS[name as ToolName];
    const args = schema.parse(rawArgs);
    this.logger.log(`stub tool=${name} args=${JSON.stringify(args)}`);

    switch (name) {
      case 'get_document_text':
        return { text: 'stub document text. lorem ipsum.' };
      case 'insert_text': {
        const a = args as InsertTextArgsT;
        return { ok: true, inserted_at: a.position };
      }
      case 'delete_range': {
        const a = args as DeleteRangeArgsT;
        return { ok: true, deleted_chars: a.end - a.start };
      }
      case 'replace_text':
        return { ok: true, replaced_count: 0 };
      default:
        throw new Error(`unhandled tool: ${name}`);
    }
  }
}
