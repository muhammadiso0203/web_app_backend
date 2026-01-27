import { Module } from '@nestjs/common';
import { TestsController } from './test.controller';
import { TestsService } from './test.service';
import { TelegramModule } from '../telegram/telegram.module';
import { TelegramNotifyService } from '../telegram/telegram-notify-service';

@Module({
  imports: [TelegramModule],
  controllers: [TestsController],
  providers: [TestsService, TelegramNotifyService],
})
export class TestModule {}
