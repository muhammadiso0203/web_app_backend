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
  ) {}

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

  findOne(id: number) {
    const user = this.repo.findOne({ where: { id } });
    if (!user) {
      return 'Foydalanuvchi topilmadi';
    }
    return user;
  }

  update(id: number, dto: updateUserDto) {
    const user = this.repo.findOne({ where: { id } });
    if (!user) {
      return 'Foydalanuvchi topilmadi';
    }
    return this.repo.update(id, dto);
  }

  remove(id: number) {
    const user = this.repo.findOne({ where: { id } });
    if (!user) {
      return 'Foydalanuvchi topilmadi';
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

  // 🔥 ACTIVITY YANGILASH
  async updateActivity(telegramId: string) {
    await this.repo.update({ telegramId }, { lastActiveAt: new Date() });
  }

  // 🚫 BLOK QILINDI DEB BELGILASH
  async markBlocked(telegramId: string) {
    await this.repo.update({ telegramId }, { isBlocked: true });
  }
}
