import { Repository } from 'typeorm';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import {
  validateTelegramWebAppData,
  parseTelegramWebAppData,
} from '../telegram/utils/validation';
import { TelegramAuthDto } from './dto/telegram-auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) { }

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
    const { user: tgUser } = data;

    if (!tgUser) {
      throw new UnauthorizedException('No user data found in initData');
    }

    const telegramId = String(tgUser.id);

    // Get or Create user in DB
    let user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      // Create user if not exists (Telegram Web App users might not have phone yet, but let's try to track)
      // Note: In your current flow, users register via contact in bot. 
      // If they haven't, findByTelegramId returns null.
      // For now, let's assume they exist or handle the missing case.
      this.logger.warn(`User ${telegramId} not found in database during web app auth`);
    }

    // Mark user as entered web app and update activity (streak)
    await this.usersService.markEnteredWebApp(telegramId);
    await this.usersService.updateActivity(telegramId);

    const payload = {
      sub: telegramId,
      username: tgUser.username,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: payload,
    };
  }
}
