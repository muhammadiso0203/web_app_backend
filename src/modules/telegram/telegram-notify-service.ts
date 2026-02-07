// telegram-notify.service.ts
import axios from 'axios';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TelegramNotifyService {
  private readonly logger = new Logger(TelegramNotifyService.name);
  private readonly token = process.env.TELEGRAM_BOT_TOKEN;
  private readonly channelId = process.env.TELEGRAM_CHANNEL_ID;

  async sendResult(message: string) {
    if (!this.token || !this.channelId) {
      this.logger.error('Telegram token yoki channel ID yo‘q');
      return;
    }

    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;

    try {
      await axios.post(
        url,
        {
          chat_id: this.channelId,
          text: message,
          parse_mode: 'Markdown',
        },
        {
          timeout: 15000,
        },
      );
    } catch (err: any) {
      this.logger.error('Telegramga yuborilmadi', err.code || err.message);
    }
  }
}
