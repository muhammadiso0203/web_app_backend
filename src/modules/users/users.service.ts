import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { UserEntity } from "src/entities/user.entity";
import { Repository } from "typeorm";
import { createUserDto } from "./dto/createUserDto";
import { updateUserDto } from "./dto/updateUserDto";

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
      return "Foydalanuvchi allaqachon mavjud";
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
      return "Foydalanuvchi topilmadi";
    }
    return user;
  }

  update(id: number, dto: updateUserDto) {
    const user = this.repo.findOne({ where: { id } });
    if (!user) {
      return "Foydalanuvchi topilmadi";
    }
    return this.repo.update(id, dto);
  }

  remove(id: number) {
    const user = this.repo.findOne({ where: { id } });
    if (!user) {
      return "Foydalanuvchi topilmadi";
    }
    return this.repo.delete(id);
  }
}
