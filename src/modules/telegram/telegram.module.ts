import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { session } from 'telegraf';
import { TelegramService } from './telegram.service';
import { UsersModule } from '../users/users.module';
import { TelegramNotifyService } from './telegram-notify-service';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    UsersModule,
    SubscriptionModule,
    TelegrafModule.forRootAsync({
      useFactory: async () => {
        const token = process.env.TELEGRAM_BOT_TOKEN as string;
        const maxRetries = 3;
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
          try {
            // Bot tokenini tekshir
            await new Promise((resolve) => setTimeout(resolve, 1000));

            return {
              token: token,
              middlewares: [session()],
            };
          } catch (error) {
            lastError = error;
            console.log(`Urinish ${i + 1}/${maxRetries}:`, error.message);

            if (i < maxRetries - 1) {
              await new Promise((r) => setTimeout(r, (i + 1) * 2000));
            }
          }
        }

        throw new Error(
          `Telegram bilan ulanish muvaffaq bo'lmadi: ${lastError}`,
        );
      },
    }),
  ],
  providers: [TelegramService, TelegramNotifyService],
  exports: [TelegramService, TelegramNotifyService],
})
export class TelegramModule {}
