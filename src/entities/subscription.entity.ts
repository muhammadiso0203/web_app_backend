import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity()
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => UserEntity, (user) => user.subscriptions)
  user: UserEntity;

  @Column()
  plan: 'MONTHLY' | 'QUARTERLY' | 'LIFETIME';

  @Column()
  price: number;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ default: true })
  isActive: boolean;
}
