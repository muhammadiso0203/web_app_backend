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
  ) {}

  // ✅ PRO bormi yo‘qmi (asosiy tekshiruv)
  async isUserPro(telegramId: string): Promise<boolean> {
    const now = new Date();

    const count = await this.subscriptionRepo
      .createQueryBuilder('sub')
      .innerJoin('sub.user', 'user')
      .where('user.telegramId = :telegramId', { telegramId })
      .andWhere('sub.isActive = :isActive', { isActive: true })
      .andWhere('(sub.expiresAt > :now OR sub.expiresAt IS NULL)', { now })
      .getCount();

    return count > 0;
  }

  // 👤 User — o‘z obunasini ko‘rish
  async getMySubscription(telegramId: string) {
    const sub = await this.subscriptionRepo
      .createQueryBuilder('sub')
      .innerJoin('sub.user', 'user')
      .where('user.telegramId = :telegramId', { telegramId })
      .andWhere('sub.isActive = :isActive', { isActive: true })
      .orderBy('sub.startedAt', 'DESC')
      .getOne();

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
    const activeSubs = await this.subscriptionRepo
      .createQueryBuilder('sub')
      .innerJoin('sub.user', 'user')
      .where('user.telegramId = :telegramId', { telegramId })
      .andWhere('sub.isActive = :isActive', { isActive: true })
      .getMany();

    if (activeSubs.length > 0) {
      await this.subscriptionRepo.update(
        activeSubs.map((s) => s.id),
        { isActive: false },
      );
    }

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
    return this.isUserPro(telegramId);
  }

  // 👑 Admin — PRO o‘chirish (TelegramId orqali)
  async deactivateByTelegramId(telegramId: string) {
    const user = await this.userRepo.findOneBy({ telegramId });
    if (!user) throw new NotFoundException('User not found');

    const result = await this.subscriptionRepo.update(
      { user: { id: user.id }, isActive: true },
      { isActive: false },
    );

    // Agar yuqoridagi update ishlamasa (TypeORM issue with relations in update), alternative:
    if (result.affected === 0) {
      const activeSub = await this.subscriptionRepo.findOne({
        where: { user: { telegramId }, isActive: true },
      });
      if (activeSub) {
        await this.subscriptionRepo.update(activeSub.id, { isActive: false });
        return { message: 'PRO deactivated' };
      }
    }

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
