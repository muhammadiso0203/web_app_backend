import { Injectable, Logger } from '@nestjs/common';
import { Start, Update, Ctx, On, Action } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscription/subscription.service';

const ADMINS = ['6699946651'];
const REQUIRED_CHANNEL = '-1003874169831';

interface BotSession {
  step?: 'WAIT_USER_ID_FOR_PRO' | 'WAIT_PLAN_FOR_PRO';
  userId?: number;
}

interface BotContext extends Context {
  session: BotSession;
  match: RegExpExecArray;
}

const WEB_APP_URL = process.env.WEB_APP_URL ?? 'https://web-app-sand-six-48.vercel.app/';

const ADMIN_INLINE_KEYBOARD = Markup.inlineKeyboard([
  [Markup.button.callback('📊 Statistika', 'BOT_STATS')],
  [Markup.button.callback('📢 Xabar yuborish', 'SEND_BROADCAST')],
  [Markup.button.callback('👑 PRO berish', 'ADMIN_GIVE_PRO')],
]);

const USER_INLINE_KEYBOARD = Markup.inlineKeyboard([
  [Markup.button.webApp('🌐 Web App ni ochish', WEB_APP_URL)],
]);

const USER_REPLY_KEYBOARD = Markup.keyboard([
  ['👑 PRO obuna olish'],
])
  .resize()
  .oneTime(false);

const SUBSCRIBE_KEYBOARD = Markup.inlineKeyboard([
  [Markup.button.url('📢 Kanalga obuna bo‘lish', 'https://t.me/+rEFFf1YzeqM2OTcy')],
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
  ) { }

  private async isSubscribed(ctx: Context): Promise<boolean> {
    if (!ctx.from) return false;
    try {
      const member = await ctx.telegram.getChatMember(REQUIRED_CHANNEL, ctx.from.id);
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
        await ctx.reply(
          '👇 Qo‘shimcha imkoniyatlar:',
          USER_REPLY_KEYBOARD,
        );
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

  @On('text')
  async onText(@Ctx() ctx: BotContext) {
    if (!ctx.from || !ctx.message) return;
    const telegramId = String(ctx.from.id);
    const text = (ctx.message as any).text;

    // ===== USER PRO BUY (reply keyboard) =====
    if (text === '👑 PRO obuna olish') {
      const alreadyPro = await this.subscriptionsService.hasActivePro(telegramId);

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
      let success = 0, failed = 0;
      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(user.telegramId, text);
          success++;
        } catch {
          failed++;
        }
      }
      await ctx.reply(`✅ Xabar yuborildi\n\n📨 ${success} ta\n❌ ${failed} ta`, ADMIN_INLINE_KEYBOARD);
      return;
    }

    // PRO Logic: Step 1 -> Get User ID
    if (ctx.session?.step === 'WAIT_USER_ID_FOR_PRO') {
      const targetId = Number(text);
      if (isNaN(targetId)) {
        await ctx.reply('❌ User ID noto‘g‘ri, faqat raqam yuboring:');
        return;
      }

      if (!ctx.session) ctx.session = {};
      ctx.session.userId = targetId;
      ctx.session.step = 'WAIT_PLAN_FOR_PRO';

      await ctx.reply(`👤 Foydalanuvchi: ${targetId}\n📦 Tarifni tanlang:`, Markup.inlineKeyboard([
        [Markup.button.callback('1 oy', 'PRO_MONTHLY')],
      ]));
      return;
    }
  }

  @On('contact')
  async onContact(@Ctx() ctx: BotContext) {
    if (!ctx.from || !ctx.message || !('contact' in ctx.message)) return;

    const contact = (ctx.message as any).contact;

    // ❗ Faqat o‘z kontaktini yuborgan bo‘lishi kerak
    if (contact.user_id !== ctx.from.id) {
      await ctx.reply('❌ Iltimos, o‘zingizning telefon raqamingizni yuboring');
      return;
    }

    const telegramId = String(ctx.from.id);

    // User bormi tekshiramiz
    const exists = await this.usersService.findByTelegramId(telegramId);

    if (exists) {
      await ctx.reply(
        '🌐 Web App orqali testlarni ishlashingiz mumkin 👇',
        USER_INLINE_KEYBOARD,
      );
      return;
    }

    // Yangi user yaratamiz
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

    // PRO tugmasi (admin bo‘lmasa)
    if (!ADMINS.includes(telegramId)) {
      await ctx.reply(
        '👇 Qo‘shimcha imkoniyatlar:',
        USER_REPLY_KEYBOARD,
      );
    }
  }


  @Action(/PRO_(MONTHLY)/)
  async onConfirmPro(@Ctx() ctx: BotContext) {
    if (!ADMINS.includes(String(ctx.from?.id))) return;

    const userId = ctx.session?.userId;
    const plan = ctx.match[1] as any;

    if (!userId || ctx.session.step !== 'WAIT_PLAN_FOR_PRO') {
      await ctx.answerCbQuery('❌ Xatolik yuz berdi');
      return;
    }

    try {
      const telegramId = String(userId);
      const alreadyPro = await this.subscriptionsService.hasActivePro(telegramId);

      if (alreadyPro) {
        await ctx.reply(`Bu foydalanuvchi allaqachon PRO obunaga ega 👑`);
        return;
      }

      await this.subscriptionsService.activate(userId, plan);

      ctx.session.step = undefined;
      ctx.session.userId = undefined;

      await ctx.answerCbQuery();
      await ctx.reply(`✅ Foydalanuvchi ${userId} ga 1 oylik PRO obunasi berildi! 👑`);
    } catch (error) {
      this.logger.error('Error activating PRO:', error);
      await ctx.reply(`❌ PRO berishda xatolik: ${error.message}`);
    }
    return;
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
    const [total, today, blocked, active] = await Promise.all([
      this.usersService.totalUsers(),
      this.usersService.todayUsers(),
      this.usersService.blockedUsers(),
      this.usersService.activeUsers(),
    ]);

    await ctx.reply(`📊 Bot statistikasi\n\n👥 Jami foydalanuvchilar: ${total}\n🆕 Bugun yangi foydalanuvchilar: ${today}\n🔥 Aktiv foydalanuvchilar: ${active}\n🚫 Botni bloklangan foydalanuvchilar: ${blocked}`);
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
