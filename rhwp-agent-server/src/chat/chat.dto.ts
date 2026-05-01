import { IsString, MaxLength, MinLength } from 'class-validator';

// R-009: 메시지 max length — server 측 12000 (rhwp-studio chat-input 의 10000 보다 약간 관대)
export const SEND_MESSAGE_MAX_LENGTH = 12000;

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(SEND_MESSAGE_MAX_LENGTH)
  content!: string;
}
