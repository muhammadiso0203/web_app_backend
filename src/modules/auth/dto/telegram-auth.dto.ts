import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TelegramAuthDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  initData: string;
}
