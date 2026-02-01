import { Injectable, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import OpenAI from 'openai';
import { TelegramNotifyService } from '../telegram/telegram-notify-service';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscription/subscription.service';

@Injectable()
export class AiService {
  constructor(
    private readonly telegramNotify: TelegramNotifyService,
    private readonly usersService: UsersService,
    private readonly subscriptionsService: SubscriptionsService,
  ) { }

  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // 1️⃣ AI orqali 30 ta test yaratish
  async generateTest(telegramId: string) {
    // 🛡 PRO tekshiruvi va limit
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      throw new ForbiddenException('Foydalanuvchi topilmadi');
    }

    const isPro = await this.subscriptionsService.hasActivePro(telegramId);

    if (!isPro && user.testAttempts >= 3) {
      throw new ForbiddenException('Sizning bepul urinishlaringiz tugadi. Davom etish uchun PRO obunani sotib oling.');
    }

    try {
      const generateQuestions = async (count: number) => {
        const prompt = `
You are an IELTS exam question generator.
Generate ${count} UNIQUE IELTS-style multiple-choice questions.

Rules:
- Question types: grammar, vocabulary, or short reading
- Use different topics
- Keep questions clear and concise
- No explanations

Output:
Return valid JSON in this exact format:
[
  {
    "question": "string",
    "options": ["A", "B", "C", "D"],
    "correct": 0
  }
]
`;
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 2000,
        });

        const content = response.choices[0].message.content || '[]';
        const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
      };

      // 🏎️ 3 ta parallel so'rov yuboramiz (3 * 10 = 30 ta test)
      // Bittada 30 ta kutishdan ko'ra, parallel 10 tadan 3 ta so'rov ancha tez ishlaydi
      const results = await Promise.all([
        generateQuestions(10),
        generateQuestions(10),
        generateQuestions(10),
      ]);

      // Natijalarni bitta arrayga yig'amiz
      const allTests = results.flat();

      // Urinishlar sonini oshiramiz
      await this.usersService.incrementTestAttempts(telegramId);

      return allTests;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      console.error('AI generateTest error:', error);
      throw new InternalServerErrorException('AI test generation failed');
    }
  }

  // 2️⃣ AI orqali test natijasini hisoblash
  async checkResult(data: {
    tests: any[];
    answers: number[];
    user?: {
      telegramId?: string;
      username?: string;
      firstName?: string;
    };
  }) {
    try {
      const prompt = `
You are an IELTS examiner.

Given these questions and correct answers:
${JSON.stringify(data.tests)}

User answers:
${JSON.stringify(data.answers)}

Rules:
- -1 means skipped
- Count total, correct and wrong answers
- Estimate IELTS level
- Give short feedback (1-2 sentences)

Return ONLY valid JSON:
{
  "total": 30,
  "correct": number,
  "wrong": number,
  "level": "A2 | B1 | B2",
  "feedback": "string"
}
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
      });

      const content = response.choices[0].message.content;

      if (!content) {
        throw new Error('Empty AI response');
      }

      const result = JSON.parse(
        content
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim(),
      );

      /* =========================
       🔔 TELEGRAMGA YUBORISH
    ========================= */

      const percent = Math.round((result.correct / result.total) * 100);

      const message = `
📊 *IELTS Test Result*

✅ To‘g‘ri: ${result.correct}
❌ Xato: ${result.wrong}
🎯 Daraja: ${result.level}
📈 Natija: ${percent}%

💬 ${result.feedback}
    `;

      try {
        await this.telegramNotify.sendResult(message);
      } catch (e) {
        console.error('Telegram send failed, skipped');
      }

      // 🔹 frontendga qaytariladi
      return result;
    } catch (error) {
      console.error('AI checkResult error:', error);
      throw new InternalServerErrorException('AI result checking failed');
    }
  }
}
