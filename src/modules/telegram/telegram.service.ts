import { Injectable, Logger } from '@nestjs/common';
import { Start, Update, Ctx, On, Action } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscription/subscription.service';

const ADMINS = ['6699946651'];
const REQUIRED_CHANNEL = '-1003874169831';

interface BotSession {
  step?:
    | 'WAIT_USER_ID_FOR_PRO'
    | 'WAIT_USER_ID_FOR_REMOVE_PRO'
    | 'WAIT_REASON_FOR_REMOVE_PRO';
  userId?: number;
  removeReason?: string;
}

interface BotContext extends Context {
  session: BotSession;
  match: RegExpExecArray;
}

const WEB_APP_URL =
  process.env.WEB_APP_URL ?? 'https://brilliant-bonbon-ff8144.netlify.app/';

const ADMIN_INLINE_KEYBOARD = Markup.inlineKeyboard([
  [Markup.button.callback('📊 Statistika', 'BOT_STATS')],
  [Markup.button.callback('📢 Xabar yuborish', 'SEND_BROADCAST')],
  [Markup.button.callback('👑 PRO berish', 'ADMIN_GIVE_PRO')],
  [Markup.button.callback('❌ PRO olib tashlash', 'ADMIN_REMOVE_PRO')],
  [Markup.button.callback('👑 PRO obunachilar', 'PRO_USERS_LIST')],
]);

const USER_INLINE_KEYBOARD = Markup.inlineKeyboard([
  [Markup.button.webApp('🌐 Web App ni ochish', WEB_APP_URL)],
]);

const USER_REPLY_KEYBOARD = Markup.keyboard([['👑 PRO obuna olish']])
  .resize()
  .oneTime(false);

const SUBSCRIBE_KEYBOARD = Markup.inlineKeyboard([
  [
    Markup.button.url(
      '📢 Kanalga obuna bo‘lish',
      'https://t.me/+rEFFf1YzeqM2OTcy',
    ),
  ],
  [Markup.button.callback('✅ Tekshirish', 'CHECK_SUB')],
]);

@Update()
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private waitingForBroadcast = new Set<string>();

  constructor(
    private readonly usersService: UsersService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

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

  @Start()
  async onStart(@Ctx() ctx: BotContext) {
    if (!ctx.from) return;

    // 1️⃣ Majburiy obuna
    if (!(await this.isSubscribed(ctx))) {
      await ctx.reply(
        '🚫 Botdan foydalanish uchun kanalga obuna bo‘ling',
        SUBSCRIBE_KEYBOARD,
      );
      return;
    }

    const telegramId = String(ctx.from.id);
    await this.usersService.updateActivity(telegramId);
    const user = await this.usersService.findByTelegramId(telegramId);

    // 2️⃣ AGAR USER BOR BO‘LSA
    if (user) {
      // Web App — inline
      await ctx.reply(
        '🌐 Web App orqali testlarni ishlashingiz mumkin 👇',
        USER_INLINE_KEYBOARD,
      );

      // PRO olish — reply (Faqat foydalanuvchilar uchun)
      if (!ADMINS.includes(telegramId)) {
        await ctx.reply('👇 Qo‘shimcha imkoniyatlar:', USER_REPLY_KEYBOARD);
      }

      return;
    }

    // 3️⃣ AGAR USER YO‘Q BO‘LSA → CONTACT
    await ctx.reply(
      '📱 Telefon raqamingizni yuboring 👇',
      Markup.keyboard([
        Markup.button.contactRequest('📱 Telefon raqamni yuborish'),
      ])
        .resize()
        .oneTime(),
    );
  }

  @Action('ADMIN_GIVE_PRO')
  async onAdminGivePro(@Ctx() ctx: BotContext) {
    if (!ADMINS.includes(String(ctx.from?.id))) return;
    if (!ctx.session) ctx.session = {};
    ctx.session.step = 'WAIT_USER_ID_FOR_PRO';
    await ctx.answerCbQuery();
    await ctx.reply('👤 Foydalanuvchi ID sini yuboring:');
    return;
  }

  @Action('ADMIN_REMOVE_PRO')
  async onAdminRemovePro(@Ctx() ctx: BotContext) {
    if (!ADMINS.includes(String(ctx.from?.id))) return;
    if (!ctx.session) ctx.session = {};
    ctx.session.step = 'WAIT_USER_ID_FOR_REMOVE_PRO';
    await ctx.answerCbQuery();
    await ctx.reply(
      '👤 PRO olib tashlanadigan foydalanuvchi ID sini yuboring:',
    );
    return;
  }

  @On('text')
  async onText(@Ctx() ctx: BotContext) {
    if (!ctx.from || !ctx.message) return;
    const telegramId = String(ctx.from.id);
    const text = (ctx.message as any).text;

    // ===== USER PRO BUY (reply keyboard) =====
    if (text === '👑 PRO obuna olish') {
      const alreadyPro =
        await this.subscriptionsService.hasActivePro(telegramId);

      if (alreadyPro) {
        await ctx.reply('👑 Siz allaqachon PRO obunasiga egasiz');
        return;
      }

      await ctx.reply(
        '👑 PRO tariflar:\n\n' +
          '1 oy – 10 000 so‘m\n' +
          '💳 To‘lov qilish uchun admin bilan bog‘laning.',
      );
      return;
    }

    if (!ADMINS.includes(telegramId)) return;

    // Admin Command
    if (text === '/admin' || text === '/panel') {
      await ctx.reply('🛠 Admin panel', ADMIN_INLINE_KEYBOARD);
      return;
    }

    // Broadcast logic
    if (this.waitingForBroadcast.has(telegramId)) {
      this.waitingForBroadcast.delete(telegramId);
      const users = await this.usersService.findAll();
      let success = 0,
        failed = 0;
      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(user.telegramId, text);
          success++;
        } catch {
          failed++;
        }
      }
      await ctx.reply(
        `✅ Xabar yuborildi\n\n📨 ${success} ta\n❌ ${failed} ta`,
        ADMIN_INLINE_KEYBOARD,
      );
      return;
    }

    // PRO Logic: Step 1 -> Get User ID
    if (ctx.session?.step === 'WAIT_USER_ID_FOR_PRO') {
      const targetTelegramId = text.trim();

      ctx.session.step = undefined;
      ctx.session.userId = undefined;

      try {
        const alreadyPro =
          await this.subscriptionsService.hasActivePro(targetTelegramId);

        if (alreadyPro) {
          await ctx.reply(`Bu foydalanuvchi allaqachon PRO obunaga ega 👑`);
          return;
        }

        await this.subscriptionsService.activate(targetTelegramId, 'MONTHLY');
        await ctx.reply(
          `✅ Foydalanuvchi ${targetTelegramId} ga 1 oylik PRO obunasi berildi! 👑`,
        );
      } catch (error) {
        this.logger.error('Error activating PRO:', error);
        await ctx.reply(`❌ PRO berishda xatolik: ${error.message}`);
      }
      return;
    }

    // PRO Removal: Step 1 -> Get User ID
    if (ctx.session?.step === 'WAIT_USER_ID_FOR_REMOVE_PRO') {
      const targetTelegramId = text.trim();

      const user = await this.usersService.findByTelegramId(targetTelegramId);
      if (!user) {
        await ctx.reply('❌ Bunday foydalanuvchi topilmadi');
        ctx.session.step = undefined;
        return;
      }

      ctx.session.userId = Number(user.id); // Internal ID (though telegramId would work too if we update session)
      (ctx.session as any).targetTelegramId = targetTelegramId;
      ctx.session.step = 'WAIT_REASON_FOR_REMOVE_PRO';
      await ctx.reply(
        `👤 Foydalanuvchi: ${targetTelegramId}\n❓ PRO olib tashlash sababini kiriting:`,
      );
      return;
    }

    // PRO Removal: Step 2 -> Get Reason and Deactivate
    if (ctx.session?.step === 'WAIT_REASON_FOR_REMOVE_PRO') {
      const targetTelegramId = (ctx.session as any).targetTelegramId;
      const reason = text;

      if (!targetTelegramId) {
        await ctx.reply('❌ Xatolik: User ID topilmadi');
        ctx.session.step = undefined;
        return;
      }

      try {
        const user = await this.usersService.findByTelegramId(targetTelegramId);
        await this.subscriptionsService.deactivateByTelegramId(
          targetTelegramId,
        );

        // Notify user
        try {
          if (user && user.telegramId) {
            await ctx.telegram.sendMessage(
              user.telegramId,
              `🚫 Sizdan PRO obunasi olib tashlandi.\n\n⚠️ Sababi: ${reason}`,
            );
          }
        } catch (err) {
          this.logger.error(
            `Could not notify user ${targetTelegramId}: ${err.message}`,
          );
        }

        await ctx.reply(
          `✅ Foydalanuvchi ${targetTelegramId} dan PRO olib tashlandi va xabar yuborildi.`,
        );
      } catch (error) {
        this.logger.error('Error deactivating PRO:', error);
        await ctx.reply(`❌ PRO olib tashlashda xatolik: ${error.message}`);
      }

      ctx.session.step = undefined;
      ctx.session.userId = undefined;
      (ctx.session as any).targetTelegramId = undefined;
      return;
    }
  }

  @On('contact')
  async onContact(@Ctx() ctx: BotContext) {
    if (!ctx.from || !ctx.message || !('contact' in ctx.message)) return;

    const contact = (ctx.message as any).contact;

    if (contact.user_id !== ctx.from.id) {
      await ctx.reply('❌ Iltimos, o‘zingizning telefon raqamingizni yuboring');
      return;
    }

    const telegramId = String(ctx.from.id);
    const exists = await this.usersService.findByTelegramId(telegramId);

    if (exists) {
      await ctx.reply(
        '🌐 Web App orqali testlarni ishlashingiz mumkin 👇',
        USER_INLINE_KEYBOARD,
      );
      return;
    }

    await this.usersService.create({
      telegramId,
      phone: contact.phone_number,
      username: ctx.from.username ?? '',
    });

    await ctx.reply('✅ Ro‘yxatdan o‘tdingiz! Xush kelibsiz 🎉');
    await ctx.reply(
      '🌐 Web App orqali testlarni ishlashingiz mumkin 👇',
      USER_INLINE_KEYBOARD,
    );

    if (!ADMINS.includes(telegramId)) {
      await ctx.reply('👇 Qo‘shimcha imkoniyatlar:', USER_REPLY_KEYBOARD);
    }
  }

  @Action('SEND_BROADCAST')
  async onSendBroadcast(@Ctx() ctx: BotContext) {
    if (!ADMINS.includes(String(ctx.from?.id))) return;
    this.waitingForBroadcast.add(String(ctx.from?.id));
    await ctx.answerCbQuery();
    await ctx.reply('✍️ Xabarni yozing');
  }

  @Action('BOT_STATS')
  async onBotStats(@Ctx() ctx: BotContext) {
    if (!ADMINS.includes(String(ctx.from?.id))) return;
    const [total, today, blocked, active, onlyStarted] = await Promise.all([
      this.usersService.totalUsers(),
      this.usersService.todayUsers(),
      this.usersService.blockedUsers(),
      this.usersService.activeUsers(),
      this.usersService.countOnlyStarted(),
    ]);

    await ctx.reply(
      `📊 Bot statistikasi\n\n` +
        `👥 Jami foydalanuvchilar: ${total}\n` +
        `🆕 Bugun yangi foydalanuvchilar: ${today}\n` +
        `🔥 Aktiv foydalanuvchilar: ${active}\n` +
        `🤖 Faqat botga start bosganlar: ${onlyStarted}\n` +
        `🚫 Botni bloklangan foydalanuvchilar: ${blocked}`,
    );
    await ctx.answerCbQuery();
  }

  @Action('PRO_USERS_LIST')
  async onProUsersList(@Ctx() ctx: BotContext) {
    if (!ADMINS.includes(String(ctx.from?.id))) return;

    const proUsers = await this.subscriptionsService.getActiveProUsers();

    if (proUsers.length === 0) {
      await ctx.reply('📭 Hozircha PRO obunachilar yo‘q');
      await ctx.answerCbQuery();
      return;
    }

    let message = '👑 PRO obunachilar ro‘yxati:\n\n';
    proUsers.forEach((sub, index) => {
      const user = sub.user;
      const username = user.username ? `@${user.username}` : 'No username';
      const phone = user.phone || 'No phone';
      const expiresAt = sub.expiresAt
        ? new Date(sub.expiresAt).toLocaleDateString()
        : 'LIFETIME';

      message += `${index + 1}. ${username} (ID: ${user.telegramId})\n📞 ${phone}\n📦 Plan: ${sub.plan}\n⏳ Muddat: ${expiresAt}\n\n`;
    });

    message += `\nTotal: ${proUsers.length} ta PRO obunachi`;

    if (message.length > 4000) {
      const chunks = message.match(/[\s\S]{1,4000}/g) || [];
      for (const chunk of chunks) {
        await ctx.reply(chunk);
      }
    } else {
      await ctx.reply(message);
    }

    await ctx.answerCbQuery();
  }

  @Action('CHECK_SUB')
  async onCheckSub(@Ctx() ctx: BotContext) {
    if (!(await this.isSubscribed(ctx))) {
      await ctx.answerCbQuery('❌ Obuna yo‘q', { show_alert: true });
      return;
    }
    await ctx.answerCbQuery('✅ Tasdiqlandi');
    await ctx.reply('🎉 Xush kelibsiz!', USER_INLINE_KEYBOARD);
  }
}
