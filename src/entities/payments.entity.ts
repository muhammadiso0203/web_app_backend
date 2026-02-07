import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => UserEntity)
  user: UserEntity;

  @Column()
  amount: number;

  @Column()
  provider: 'CLICK' | 'PAYME' | 'STRIPE';

  @Column()
  status: 'PENDING' | 'SUCCESS' | 'FAILED';

  @Column()
  createdAt: Date;
}
