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
  ) {}

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
  @Post('activate/:userId')
  async activatePro(
    @Param('userId') userId: number,
    @Body() body: { plan: 'MONTHLY' | 'QUARTERLY' | 'LIFETIME' },
  ) {
    return this.subscriptionsService.activate(userId, body.plan);
  }

  // 👑 ADMIN — PRO o‘chirish
  @Post('deactivate/:userId')
  async deactivatePro(@Param('userId') userId: number) {
    return this.subscriptionsService.deactivate(userId);
  }
}
