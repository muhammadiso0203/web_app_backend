import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Subscription } from './subscription.entity';

@Entity()
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  telegramId: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  phone: string;

  @OneToMany(() => Subscription, (sub) => sub.user)
  subscriptions: Subscription[];

  @Column({ default: false })
  isBlocked: boolean; // 🚫 botni bloklagan

  @Column({ type: 'timestamp', nullable: true })
  lastActiveAt: Date; // 🔥 active user

  @Column({ default: 0 })
  testAttempts: number;

  @Column({ default: 0 })
  score: number;

  @Column({ default: 0 })
  streak: number;

  @Column({ default: 0 })
  bestScore: number;

  @Column({ default: 0 })
  dailyTestsCount: number;

  @Column({ default: 5 })
  dailyGoal: number;

  @Column({ default: true })
  notificationsEnabled: boolean;

  @Column({ default: 'dark' })
  theme: string;

  @Column({ default: 'uz' })
  language: string;

  @Column({ default: false })
  hasEnteredWebApp: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: number;

  @Column({ nullable: true })
  referredBy: string;

  @Column({ default: 0 })
  referralCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
