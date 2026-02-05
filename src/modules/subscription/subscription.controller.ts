import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  Body,
} from '@nestjs/common';
import { SubscriptionsService } from './subscription.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
  ) { }

  // 👤 USER — o‘z PRO holatini ko‘rish
  @Get('me')
  async mySubscription(@Req() req) {
    const user = req.user;

    const isPro = await this.subscriptionsService.isUserPro(user.id);

    return {
      isPro,
    };
  }

  // 👑 ADMIN — userga PRO yoqish
  @Post('activate/:telegramId')
  async activatePro(
    @Param('telegramId') telegramId: string,
    @Body() body: { plan: 'MONTHLY' },
  ) {
    return this.subscriptionsService.activate(telegramId, body.plan);
  }

  // 👑 ADMIN — PRO o‘chirish
  @Post('deactivate/:telegramId')
  async deactivatePro(@Param('telegramId') telegramId: string) {
    return this.subscriptionsService.deactivateByTelegramId(telegramId);
  }
}
