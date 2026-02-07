import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { TelegramModule } from '../telegram/telegram.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [TelegramModule, UsersModule, SubscriptionModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
