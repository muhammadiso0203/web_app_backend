import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { createUserDto } from "./dto/createUserDto";
import { updateUserDto } from "./dto/updateUserDto";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  create(@Body() dto: createUserDto) {
    return this.usersService.create(dto);
  }

  @Get('me/:telegramId')
  async getMe(@Param('telegramId') telegramId: string) {
    await this.usersService.updateActivity(telegramId);
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) return null;

    // Rankni hisoblash (score bo'yicha)
    const rank = await this.usersService.getUserRank(user.score);

    return {
      ...user,
      rank,
    };
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('top')
  getTop() {
    return this.usersService.getTopUsers();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: updateUserDto) {
    return this.usersService.update(+id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.usersService.remove(+id);
  }
}
