import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import { TelegramNotifyService } from '../telegram/telegram-notify-service';

@Injectable()
export class AiService {
  constructor(private readonly telegramNotify: TelegramNotifyService) {}

  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // 1️⃣ AI orqali 30 ta test yaratish
  async generateTest() {
    try {
      const random = Math.floor(Math.random() * 10000);
      const prompt = `
You are an IELTS exam generator.

Generate 30 UNIQUE IELTS-style multiple-choice questions.

Rules:
- Mix grammar, vocabulary, reading comprehension
- Avoid repeating topics
- Questions MUST be different every time
- Random seed: ${random}

Return ONLY valid JSON.
No markdown.
No explanations.

JSON format:
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
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
      });

      const content = response.choices[0].message.content;

      if (!content) {
        throw new Error('Empty AI response');
      }

      const cleaned = content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      // AI qaytargan JSON stringni objectga aylantiramiz
      return JSON.parse(cleaned);
    } catch (error) {
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

      const userName = data.user?.username
        ? `@${data.user.username}`
        : data.user?.firstName
          ? data.user.firstName
          : 'Nomaʼlum foydalanuvchi';

      const message = `
📊 *IELTS Test Result*

👤 Foydalanuvchi: ${userName}
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
