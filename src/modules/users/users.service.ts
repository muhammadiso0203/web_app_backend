import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/entities/user.entity';
import { MoreThan, Repository } from 'typeorm';
import { createUserDto } from './dto/createUserDto';
import { updateUserDto } from './dto/updateUserDto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) { }

  async create(dto: createUserDto) {
    const exist = await this.repo.findOne({
      where: { telegramId: dto.telegramId },
    });

    if (exist) {
      return 'Foydalanuvchi allaqachon mavjud';
    }

    const user = this.repo.create(dto);
    return this.repo.save(user);
  }

  findAll() {
    return this.repo.find();
  }

  async findByTelegramId(telegramId: string) {
    return this.repo.findOne({
      where: { telegramId },
    });
  }

  async findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: number, dto: updateUserDto) {
    const user = await this.findOne(id);
    if (!user) {
      return null;
    }
    return this.repo.update(id, dto);
  }

  async remove(id: number) {
    const user = await this.findOne(id);
    if (!user) {
      return null;
    }
    return this.repo.delete(id);
  }

  async count(): Promise<number> {
    return this.repo.count(); // yoki repository.count()
  }

  async totalUsers(): Promise<number> {
    return this.repo.count();
  }

  // 🆕 BUGUNGI A'ZOLAR
  async todayUsers(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.repo.count({
      where: {
        createdAt: MoreThan(today),
      },
    });
  }

  // 🚫 BOTNI BLOKLAGANLAR
  async blockedUsers(): Promise<number> {
    return this.repo.count({
      where: { isBlocked: true },
    });
  }

  // 🔥 ACTIVE FOYDALANUVCHILAR (24 soat)
  async activeUsers(): Promise<number> {
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);

    return this.repo.count({
      where: {
        lastActiveAt: MoreThan(last24h),
      },
    });
  }

  // 🔥 ACTIVITY YANGILASH (STREAK LOGIC)
  async updateActivity(telegramId: string) {
    const user = await this.findByTelegramId(telegramId);
    if (!user) return;

    const now = new Date();
    const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : null;

    if (!lastActive) {
      await this.repo.update({ telegramId }, { lastActiveAt: now, streak: 1 });
      return;
    }

    // Sanalarni solishtirish (vaqtsiz)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastDate = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());
    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Kecha kirgan bo'lsa streakni oshiramiz va daily countni reset qilamiz
      await this.repo.update({ telegramId }, {
        lastActiveAt: now,
        streak: user.streak + 1,
        dailyTestsCount: 0
      });
    } else if (diffDays > 1) {
      // Bir kundan ko'p tashlab ketgan bo'lsa 1 ga tushiramiz va reset
      await this.repo.update({ telegramId }, {
        lastActiveAt: now,
        streak: 1,
        dailyTestsCount: 0
      });
    } else {
      // Bugun allaqachon kirgan bo'lsa (streak kamida 1 bo'lishini ta'minlaymiz)
      const updateData: any = { lastActiveAt: now };
      if (!user.streak || user.streak === 0) {
        updateData.streak = 1;
      }
      await this.repo.update({ telegramId }, updateData);
    }
  }

  async updateBestScore(telegramId: string, score: number) {
    const user = await this.findByTelegramId(telegramId);
    if (user && score > (user.bestScore || 0)) {
      await this.repo.update({ telegramId }, { bestScore: score });
    }
  }

  // 🚫 BLOK QILINDI DEB BELGILASH
  async markBlocked(telegramId: string) {
    await this.repo.update({ telegramId }, { isBlocked: true });
  }

  // 🌐 WEB APP GA KIRDI DEB BELGILASH
  async markEnteredWebApp(telegramId: string) {
    await this.repo.update({ telegramId }, { hasEnteredWebApp: true });
  }

  // 🤖 FAQAT BOTGA START BOSGANLAR (WEB APP GA KIRMAGANLAR)
  async countOnlyStarted(): Promise<number> {
    return this.repo.count({
      where: { hasEnteredWebApp: false },
    });
  }

  async incrementTestAttempts(telegramId: string) {
    const user = await this.findByTelegramId(telegramId);
    if (user) {
      await this.repo.update({ telegramId }, {
        testAttempts: user.testAttempts + 1,
        dailyTestsCount: (user.dailyTestsCount || 0) + 1
      });
    }
  }

  async addScore(telegramId: string, points: number) {
    const user = await this.findByTelegramId(telegramId);
    if (user) {
      await this.repo.update({ telegramId }, { score: (user.score || 0) + points });
    }
  }

  async getTopUsers(limit: number = 20) {
    return this.repo.find({
      order: { score: 'DESC' },
      take: limit,
      select: ['id', 'telegramId', 'username', 'score', 'testAttempts'],
    });
  }
}
