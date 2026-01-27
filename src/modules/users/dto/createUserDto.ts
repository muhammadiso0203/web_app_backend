import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class createUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  telegramId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  username?: string | null;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone: string;
}
