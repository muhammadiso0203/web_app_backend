import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column({ default: false })
  isBlocked: boolean; // 🚫 botni bloklagan

  @Column({ type: 'timestamp', nullable: true })
  lastActiveAt: Date; // 🔥 active user

  @CreateDateColumn()
  createdAt: Date;
}
