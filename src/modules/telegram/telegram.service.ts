import { Injectable, Logger } from '@nestjs/common';
import { Start, Update, Ctx, On, Action } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { UsersService } from '../users/users.service';

const ADMINS = ['6699946651']; // 🔴 O'ZING TELEGRAM ID
const REQUIRED_CHANNEL = '-1003874169831'; // 👈 PRIVATE kanal ID

const WEB_APP_URL =
  process.env.WEB_APP_URL ?? 'https://web-app-sand-six-48.vercel.app/';

// ================= INLINE KEYBOARDS =================

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

const ADMIN_INLINE_KEYBOARD = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '📊 Statistika', callback_data: 'BOT_STATS' }],
      [{ text: '📢 Xabar yuborish', callback_data: 'SEND_BROADCAST' }],
    ],
  },
};

const SUBSCRIBE_KEYBOARD = {
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: '📢 Kanalga obuna bo‘lish',
          url: 'https://t.me/+rEFFf1YzeqM2OTcy',
        },
      ],
      [
        {
          text: '✅ Tekshirish',
          callback_data: 'CHECK_SUB',
        },
      ],
    ],
  },
};

// ================= SERVICE =================

@Update()
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private waitingForBroadcast = new Set<string>();

  constructor(private readonly usersService: UsersService) {}

  // ================= SUBSCRIBE CHECK =================
  private async isSubscribed(ctx: Context): Promise<boolean> {
    if (!ctx.from) return false;

    try {
      const member = await ctx.telegram.getChatMember(
        REQUIRED_CHANNEL,
        ctx.from.id,
      );

      return ['member', 'administrator', 'creator'].includes(member.status);
    } catch {
      return false;
    }
  }

  // ================= START =================
  @Start()
  async onStart(@Ctx() ctx: Context) {
    if (!ctx.from) return;

    // ❗ MAJBURIY OBUNA
    const subscribed = await this.isSubscribed(ctx);
    if (!subscribed) {
      await ctx.reply(
        '🚫 Botdan foydalanish uchun kanalga obuna bo‘ling',
        SUBSCRIBE_KEYBOARD,
      );
      return;
    }

    const telegramId = String(ctx.from.id);
    await this.usersService.updateActivity(telegramId);

    const user = await this.usersService.findByTelegramId(telegramId);

    if (user) {
      await ctx.reply(
        '🎉 *IELTS go botiga xush kelibsiz!*\n\nBotdan foydalanish uchun web-app tugmasini bosing 👇',
        {
          parse_mode: 'Markdown',
          ...USER_INLINE_KEYBOARD, // ❗ har doim USER
        },
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

  // ================= ADMIN COMMANDS =================
  @On('text')
  async handleText(@Ctx() ctx: Context) {
    if (!ctx.from || !ctx.message) return;

    const telegramId = String(ctx.from.id);
    const text = (ctx.message as any).text;

    // 🔴 BROADCAST MODE
    if (
      ADMINS.includes(telegramId) &&
      this.waitingForBroadcast.has(telegramId)
    ) {
      this.waitingForBroadcast.delete(telegramId);

      const users = await this.usersService.findAll();

      let success = 0;
      let failed = 0;

      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(user.telegramId, text);
          success++;
        } catch {
          failed++;
        }
      }

      await ctx.reply(
        `✅ Xabar yuborildi\n\n📨 Yuborildi: ${success}\n❌ Yetib bormadi: ${failed}`,
        ADMIN_INLINE_KEYBOARD,
      );
      return;
    }

    // 🔹 ADMIN COMMAND
    if (
      ADMINS.includes(telegramId) &&
      (text === '/admin' || text === '/panel')
    ) {
      await ctx.reply('🛠 *Admin panel*', {
        parse_mode: 'Markdown',
        ...ADMIN_INLINE_KEYBOARD,
      });
    }
  }

  @Action('SEND_BROADCAST')
  async askBroadcast(@Ctx() ctx: Context) {
    const telegramId = String(ctx.from?.id);
    if (!ADMINS.includes(telegramId)) return;

    this.waitingForBroadcast.add(telegramId);

    await ctx.answerCbQuery();
    await ctx.reply('✍️ Yubormoqchi bo‘lgan xabaringizni yozing');
  }

  // ================= CHECK SUB BUTTON =================
  @Action('CHECK_SUB')
  async checkSubscribe(@Ctx() ctx: Context) {
    const subscribed = await this.isSubscribed(ctx);

    if (!subscribed) {
      await ctx.answerCbQuery('❌ Hali obuna emassiz', { show_alert: true });
      return;
    }

    await ctx.answerCbQuery('✅ Obuna tasdiqlandi');

    try {
      await ctx.deleteMessage();
    } catch {}

    await ctx.reply(
      '🎉 IELTS go botiga xush kelibsiz\nBotdan foydalanish uchun web app tugmasini bosing',
      USER_INLINE_KEYBOARD,
    );
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
      '🎉 IELTS go botiga xush kelibsiz\nBotdan foydalanish uchun web app tugmasini bosing',
      USER_INLINE_KEYBOARD,
    );
  }

  // ================= BOT BLOCK =================
  @On('my_chat_member')
  async onBlocked(@Ctx() ctx: any) {
    const status = ctx.myChatMember?.new_chat_member?.status;

    if (status === 'kicked' && ctx.from) {
      await this.usersService.markBlocked(String(ctx.from.id));
    }
  }

  // ================= STATISTICS =================
  @Action('BOT_STATS')
  async botStats(@Ctx() ctx: Context) {
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
