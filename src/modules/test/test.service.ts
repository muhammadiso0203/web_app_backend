// tests.service.ts
import { Injectable } from '@nestjs/common';
import { TelegramNotifyService } from '../telegram/telegram-notify-service';

@Injectable()
export class TestsService {
  constructor(private readonly telegramService: TelegramNotifyService) {}

  async submitTest(data: any) {
    const { tests, answers, user } = data;

    let correct = 0;
    let skipped = 0;

    tests.forEach((test, index) => {
      const ans = answers[index];
      if (ans === -1) skipped++;
      else if (ans === test.correct) correct++;
    });

    const total = tests.length;
    const wrong = total - correct - skipped;
    const percent = Math.round((correct / total) * 100);

    const message = `
🧪 *Test natijasi*

📛 *Ism:* ${user?.firstName || '-'}

📊 *Natijalar:*
✅ To‘g‘ri: *${correct}*
❌ Xato: *${wrong}*
⏭ O‘tkazib yuborildi: *${skipped}*

📈 *Foiz:* *${percent}%*
`;

    await this.telegramService.sendResult(message);

    return {
      success: true,
      correct,
      wrong,
      skipped,
      percent,
    };
  }
}
