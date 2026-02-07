import { Module, Logger, OnModuleInit } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TelegramModule } from './modules/telegram/telegram.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AiModule } from './modules/ai/ai.module';
import { TestModule } from './modules/test/test.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get('DB_PORT')),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASS'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    AiModule,
    UsersModule,
    TelegramModule,
    AuthModule,
    TestModule,
    SubscriptionModule,
    ScheduleModule.forRoot(),
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    if (this.dataSource.isInitialized) {
      Logger.log('✅ PostgreSQL bazaga muvaffaqiyatli ulandi', 'Database');
    } else {
      Logger.error('❌ PostgreSQL bazaga ulanib bo‘lmadi', 'Database');
    }
  }
}
