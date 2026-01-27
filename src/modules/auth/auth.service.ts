import { Repository } from 'typeorm';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  validateTelegramWebAppData,
  parseTelegramWebAppData,
} from '../telegram/utils/validation';
import { TelegramAuthDto } from './dto/telegram-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateTelegramAuth(telegramAuthDto: TelegramAuthDto) {
    const { initData } = telegramAuthDto;
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not defined');
    }

    const isValid = validateTelegramWebAppData(initData, botToken);
    if (!isValid) {
      throw new UnauthorizedException('Invalid Telegram data');
    }

    const data = parseTelegramWebAppData(initData);
    const { user } = data;

    if (!user) {
      throw new UnauthorizedException('No user data found in initData');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: payload,
    };
  }
}
