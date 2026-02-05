import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription } from 'src/entities/subscription.entity';
import { UserEntity } from 'src/entities/user.entity';
import { Repository, MoreThan, IsNull, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

type PlanType = 'MONTHLY';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,

    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) { }

  // ✅ PRO bormi yo‘qmi (asosiy tekshiruv)
  async isUserPro(userId: number): Promise<boolean> {
    return this.subscriptionRepo.exists({
      where: {
        user: { id: userId },
        isActive: true,
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  // 👤 User — o‘z obunasini ko‘rish
  async getMySubscription(userId: number) {
    const sub = await this.subscriptionRepo.findOne({
      where: {
        user: { id: userId },
        isActive: true,
      },
      order: { startedAt: 'DESC' },
    });

    if (!sub) {
      return { isPro: false };
    }

    return {
      isPro: true,
      plan: sub.plan,
      expiresAt: sub.expiresAt,
    };
  }

  // 👑 Admin — PRO yoqish
  async activate(telegramId: string, plan: PlanType = 'MONTHLY') {
    const user = await this.userRepo.findOneBy({ telegramId });
    if (!user) throw new NotFoundException('User not found');

    // Oldingi PRO ni o‘chiramiz
    await this.subscriptionRepo.update(
      { user: { id: user.id }, isActive: true },
      { isActive: false },
    );

    const now = new Date();
    const expiresAt = new Date(now.setMonth(now.getMonth() + 1));
    const price = 10000;

    const subscription = this.subscriptionRepo.create({
      user,
      plan,
      price,
      startedAt: new Date(),
      expiresAt,
      isActive: true,
    });

    return this.subscriptionRepo.save(subscription);
  }

  async hasActivePro(telegramId: string): Promise<boolean> {
    return this.subscriptionRepo.exists({
      where: [
        {
          user: { telegramId },
          isActive: true,
          expiresAt: MoreThan(new Date()),
        },
        { user: { telegramId }, isActive: true, expiresAt: IsNull() },
      ],
    });
  }


  // 👑 Admin — PRO o‘chirish (TelegramId orqali)
  async deactivateByTelegramId(telegramId: string) {
    const user = await this.userRepo.findOneBy({ telegramId });
    if (!user) throw new NotFoundException('User not found');

    const result = await this.subscriptionRepo.update(
      { user: { id: user.id }, isActive: true },
      { isActive: false },
    );

    if (result.affected === 0) {
      throw new NotFoundException('Active subscription not found');
    }

    return { message: 'PRO deactivated' };
  }

  async getActiveProUsers() {
    return this.subscriptionRepo.find({
      where: [
        {
          isActive: true,
          expiresAt: MoreThan(new Date()),
        },
        {
          isActive: true,
          expiresAt: IsNull(),
        },
      ],
      relations: ['user'],
    });
  }

  // 🕒 Cron job — Har kuni yarim tunda muddati o'tgan PROlarni o'chirish
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Checking for expired subscriptions...');

    const result = await this.subscriptionRepo.update(
      {
        isActive: true,
        expiresAt: LessThan(new Date()),
      },
      {
        isActive: false,
      },
    );

    this.logger.log(`Expired subscriptions deactivated: ${result.affected}`);
  }
}
