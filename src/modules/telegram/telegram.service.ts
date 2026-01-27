import { Injectable, Logger } from '@nestjs/common';
import { Start, Update, Ctx, On, Action } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { UsersService } from '../users/users.service';

const ADMINS = ['6699946651']; // 🔴 O'ZING TELEGRAM ID

const WEB_APP_URL =
  process.env.WEB_APP_URL ??
  'https://web-app-sand-six-48.vercel.app/';

const MAIN_INLINE_KEYBOARD = {
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: '🌐 Web App ni ochish',
          web_app: { url: WEB_APP_URL },
        },
      ],
      [{ text: '📊 Statistika', callback_data: 'BOT_STATS' }],
    ],
  },
};

const USER_INLINE_KEYBOARD = {
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: '🌐 Web App ni ochish',
          web_app: { url: WEB_APP_URL },
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

  // ================= START =================
  @Start()
  async onStart(@Ctx() ctx: Context) {
    if (!ctx.from) return;

    const telegramId = String(ctx.from.id);

    // 🔥 ACTIVE
    await this.usersService.updateActivity(telegramId);

    const user = await this.usersService.findByTelegramId(telegramId);

    if (user) {
      await ctx.reply('🎉 IELTS go botiga xush kelibsiz', {
        reply_markup: { remove_keyboard: true },
      });

      await ctx.reply(
        'Quyidagilardan birini tanlang 👇',
        ADMINS.includes(telegramId)
          ? MAIN_INLINE_KEYBOARD
          : USER_INLINE_KEYBOARD,
      );

      return;
    }

    // ================= USER YO‘Q =================
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

  // ================= CONTACT =================
  @On('contact')
  async onContact(@Ctx() ctx: Context) {
    if (!ctx.from) return;

    const message = ctx.message as any;
    const contact = message?.contact;
    if (!contact) return;

    if (contact.user_id !== ctx.from.id) {
      await ctx.reply("❌ Faqat o'z telefon raqamingizni yuboring");
      return;
    }

    const telegramId = String(ctx.from.id);

    // 🔥 ACTIVE
    await this.usersService.updateActivity(telegramId);

    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user) {
      try {
        await this.usersService.create({
          telegramId,
          username: ctx.from.username,
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
      ADMINS.includes(telegramId)
        ? MAIN_INLINE_KEYBOARD
        : USER_INLINE_KEYBOARD,
    );
  }

  // ================= BOT BLOKLANGANDA =================
  @On('my_chat_member')
  async onBlocked(@Ctx() ctx: any) {
    const status = ctx.myChatMember?.new_chat_member?.status;

    if (status === 'kicked' && ctx.from) {
      await this.usersService.markBlocked(String(ctx.from.id));
    }
  }

  // ================= STATISTIKA =================
  @Action('BOT_STATS')
  async botStats(@Ctx() ctx: Context) {
    const telegramId = String(ctx.from?.id);
    if (!ADMINS.includes(telegramId)) return;

    const [total, today, blocked, active] = await Promise.all([
      this.usersService.totalUsers(),
      this.usersService.todayUsers(),
      this.usersService.blockedUsers(),
      this.usersService.activeUsers(),
    ]);

    const text = `
📊 *Bot Statistikasi*

👥 Jami a’zolar: *${total}*
🆕 Bugungi a’zolar: *${today}*
🔥 Active foydalanuvchilar: *${active}*
🚫 Botni bloklaganlar: *${blocked}*
    `;

    await ctx.reply(text, { parse_mode: 'Markdown' });
  }
}
