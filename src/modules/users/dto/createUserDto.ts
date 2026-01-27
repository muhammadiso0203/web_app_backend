import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class createUserDto {
  @ApiProperty({ example: '123456789' })
  @IsString()
  @IsNotEmpty()
  telegramId: string;

  @ApiProperty({ example: 'username', required: false })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  // 🚫 botni bloklaganmi
  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isBlocked?: boolean;

  // 🔥 oxirgi aktiv vaqt
  @ApiProperty({ required: false, type: String, format: 'date-time' })
  @IsOptional()
  lastActiveAt?: Date;
}
