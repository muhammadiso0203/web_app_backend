import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscription.controller';
import { SubscriptionsService } from './subscription.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from 'src/entities/subscription.entity';
import { UserEntity } from 'src/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, UserEntity])],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionModule {}
