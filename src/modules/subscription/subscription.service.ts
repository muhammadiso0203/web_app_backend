import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription } from 'src/entities/subscription.entity';
import { UserEntity } from 'src/entities/user.entity';
import { Repository, MoreThan, IsNull } from 'typeorm';

type PlanType = 'MONTHLY' | 'QUARTERLY' | 'LIFETIME';

@Injectable()
export class SubscriptionsService {
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
  async activate(userId: number, plan: PlanType) {
    const user = await this.userRepo.findOneBy({ telegramId: String(userId) });
    if (!user) throw new NotFoundException('User not found');

    // Oldingi PRO ni o‘chiramiz
    await this.subscriptionRepo.update(
      { user: { id: user.id }, isActive: true },
      { isActive: false },
    );

    const now = new Date();

    const expiresAt =
      plan === 'MONTHLY'
        ? new Date(now.setMonth(now.getMonth() + 1))
        : plan === 'QUARTERLY'
          ? new Date(now.setMonth(now.getMonth() + 3))
          : null; // LIFETIME

    const price =
      plan === 'MONTHLY' ? 29000 : plan === 'QUARTERLY' ? 79000 : 299000;

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


  // 👑 Admin — PRO o‘chirish
  async deactivate(userId: number) {
    const result = await this.subscriptionRepo.update(
      { user: { id: userId }, isActive: true },
      { isActive: false },
    );

    if (result.affected === 0) {
      throw new NotFoundException('Active subscription not found');
    }

    return { message: 'PRO deactivated' };
  }
}
