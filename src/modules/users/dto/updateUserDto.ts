import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { createUserDto } from "./createUserDto";

export class updateUserDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    telegramId?:string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    username?: string | null;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    phone?: string;
}