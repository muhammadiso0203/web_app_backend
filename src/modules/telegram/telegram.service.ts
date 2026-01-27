import { Injectable, Logger } from '@nestjs/common';
import { Start, Update, Ctx, On } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { UsersService } from '../users/users.service';

const WEB_APP_INLINE_KEYBOARD = {
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: '🌐 Web App ni ochish',
          web_app: {
            url:
              process.env.WEB_APP_URL ?? 'https://web-app-sand-six-48.vercel.app/',
          },
        },
      ],
    ],
  },
};

@Update()
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly usersService: UsersService) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    if (!ctx.from) return;

    const telegramId = String(ctx.from.id);
    const user = await this.usersService.findByTelegramId(telegramId);

    if (user) {
      await ctx.reply('🎉 IELTS go botiga xush kelibsiz',  {
        reply_markup: {
          remove_keyboard: true,
        },
      });

      await ctx.reply(
        'Web App’ni ochish uchun bosing 👇',
        WEB_APP_INLINE_KEYBOARD,
      );

      return; // 🔴 ENG MUHIM JOY
    }

    // ❗ Faqat user YO‘Q bo‘lsa ishlaydi
    await ctx.reply('Davom etish uchun telefon raqamingizni yuboring 👇', {
      reply_markup: {
        keyboard: [
          [{ text: '📱 Telefon raqamni yuborish', request_contact: true }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  @On('contact')
  async onContact(@Ctx() ctx: Context) {
    const message = ctx.message as any;
    const contact = message?.contact;

    if (!contact || !ctx.from) return;

    if (contact.user_id !== ctx.from.id) {
      await ctx.reply("❌ Faqat o'z telefon raqamingizni yuboring");
      return;
    }

    const telegramId = String(ctx.from.id);
    let user = await this.usersService.findByTelegramId(telegramId);

    if (!user) {
      try {
        await this.usersService.create({
          telegramId,
          username: ctx.from.username ?? null,
          phone: contact.phone_number,
        });
      } catch (err) {
        this.logger.error('User create error', err);
        await ctx.reply('❌ Xatolik yuz berdi');
        return;
      }
    }

    await ctx.reply(
      '🎉 IELTS go botiga xush kelibsiz',
      WEB_APP_INLINE_KEYBOARD,
    );
  }
}
