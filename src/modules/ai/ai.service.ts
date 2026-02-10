import {
  Injectable,
  InternalServerErrorException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import OpenAI from 'openai';
import { TelegramNotifyService } from '../telegram/telegram-notify-service';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscription/subscription.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly telegramNotify: TelegramNotifyService,
    private readonly usersService: UsersService,
    private readonly subscriptionsService: SubscriptionsService,
  ) { }

  private readonly openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  /* =========================
     1️⃣ AI TEST GENERATION
  ========================= */

  async generateTest(telegramId: string) {
    // 🛡 User tekshiruvi
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      throw new ForbiddenException('Foydalanuvchi topilmadi');
    }

    // 🛡 PRO + limit
    const isPro = await this.subscriptionsService.hasActivePro(telegramId);

    if (!isPro && user.testAttempts >= 3) {
      throw new ForbiddenException(
        'Sizning bepul urinishlaringiz tugadi. Davom etish uchun PRO obunani sotib oling.',
      );
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

        return JSON.parse(
          content
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim(),
        );
      };

      // 🚀 Parallel (3 × 10 = 30)
      const results = await Promise.all([
        generateQuestions(10),
        generateQuestions(10),
        generateQuestions(10),
      ]);

      const allTests = results.flat();

      // 📈 Attempt++
      await this.usersService.incrementTestAttempts(telegramId);

      return allTests;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;

      this.logger.error('AI generateTest error', error);
      throw new InternalServerErrorException('AI test generation failed');
    }
  }

  /* =========================
     2️⃣ CHECK TEST RESULT
  ========================= */

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
      // 1️⃣ Programmatic check (faster & more accurate)
      let correct = 0;
      let wrong = 0;

      data.tests.forEach((test, index) => {
        const userAnswer = data.answers[index];
        if (userAnswer === -1) {
          wrong++;
        } else if (userAnswer === test.correct) {
          correct++;
        } else {
          wrong++;
        }
      });

      const total = data.tests.length;
      const score = Math.round((correct / total) * 100);

      // Estimate Level
      let level = 'A2';
      if (score >= 90) level = 'C1';
      else if (score >= 70) level = 'B2';
      else if (score >= 40) level = 'B1';

      // 2️⃣ AI Feedback (Short)
      const feedbackPrompt = `
You are an IELTS examiner.
The student took a test and got ${correct} out of ${total} correct (${score}%).
Level: ${level}

Give a very short feedback in English (1-2 sentences).
Return ONLY the feedback text.
`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: feedbackPrompt }],
        max_tokens: 100,
        temperature: 0.5,
      });

      const feedback =
        response.choices[0].message.content?.trim() || 'Keep practicing!';

      const result = {
        total,
        correct,
        wrong,
        level,
        feedback,
      };

      // Award points: 10 points per correct answer
      if (data.user?.telegramId && result.correct > 0) {
        await this.usersService.addScore(
          data.user.telegramId,
          result.correct * 10,
        );
        await this.usersService.updateBestScore(
          data.user.telegramId,
          result.correct,
        );
      }

      /* 🔔 Telegram notify */
      const message = `
📊 *IELTS Test Result*


👤 Ism: ${data.user?.firstName}
✅ To‘g‘ri: ${result.correct}
❌ Xato: ${result.wrong}
🎯 Daraja: ${result.level}
📈 Natija: ${score}%

💬 ${result.feedback}
`;

      try {
        await this.telegramNotify.sendResult(message);
      } catch {
        this.logger.warn('Telegram notify skipped');
      }

      return result;
    } catch (error) {
      this.logger.error('AI checkResult error', error);
      throw new InternalServerErrorException('AI result checking failed');
    }
  }

  async generateTranslateTest(telegramId: string) {
    // 🛡 User tekshiruvi
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      throw new ForbiddenException('Foydalanuvchi topilmadi');
    }

    // 🛡 PRO + limit
    const isPro = await this.subscriptionsService.hasActivePro(telegramId);

    if (!isPro && user.testAttempts >= 3) {
      throw new ForbiddenException(
        'Sizning bepul urinishlaringiz tugadi. Davom etish uchun PRO obunani sotib oling.',
      );
    }

    try {
      const generateWords = async (count: number) => {
        const prompt = `
You are an IELTS vocabulary test generator.
Generate EXACTLY ${count} UNIQUE English words.
For each word:
- Provide 1 correct Uzbek translation
- Provide 2 incorrect but plausible Uzbek options

Rules:
- Uzbek language must be latin
- Options must be short and clear
- "correct" must be the INDEX (0, 1 or 2) of the correct option in the "options" array
- Returned JSON must be an array of ${count} objects
- Do NOT include any explanations or additional text

Output:
Return valid JSON in this exact format:
[
  {
    "question": "English word",
    "options": ["uzbek1", "uzbek2", "uzbek3"],
    "correct": number
  }
]
`;

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 1500,
        });

        const content = response.choices[0].message.content || '[]';
        const cleaned = content
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();

        const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
        const jsonText = arrayMatch ? arrayMatch[0] : cleaned;

        return JSON.parse(jsonText);
      };

      // 🚀 Parallel (3 × 10 = 30)
      const results = await Promise.all([
        generateWords(10),
        generateWords(10),
        generateWords(10),
      ]);

      const tests = results.flat();

      // 📈 Attempt++
      await this.usersService.incrementTestAttempts(telegramId);

      return tests;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;

      this.logger.error('AI generateTranslateTest error', error);
      throw new InternalServerErrorException(
        'AI translation test generation failed',
      );
    }
  }

  /* =========================
     3️⃣ AI FEEDBACK (PRO ONLY)
  ========================= */

  async generateFeedback(params: {
    telegramId: string;
    questions: {
      question: string;
      correct: number;
      options: string[];
    }[];
    userAnswers: number[];
  }) {
    const { telegramId, questions, userAnswers } = params;

    // 🔒 PRO check
    const isPro = await this.subscriptionsService.hasActivePro(telegramId);

    if (!isPro) {
      return {
        feedback: '🔒 To‘liq AI feedback faqat PRO foydalanuvchilar uchun.',
      };
    }

    // ❌ Mistakes
    const mistakes = questions
      .map((q, i) => {
        if (userAnswers[i] !== q.correct) {
          return {
            question: q.question,
            correctAnswer: q.options[q.correct],
            userAnswer:
              userAnswers[i] === -1 ? 'No answer' : q.options[userAnswers[i]],
          };
        }
        return null;
      })
      .filter(Boolean) as {
        question: string;
        correctAnswer: string;
        userAnswer: string;
      }[];

    const mistakesText =
      mistakes.length > 0
        ? mistakes
          .slice(0, 5)
          .map(
            (m, idx) =>
              `${idx + 1}. Question: "${m.question}"
User answer: ${m.userAnswer}
Correct answer: ${m.correctAnswer}`,
          )
          .join('\n\n')
        : 'The user answered all questions correctly.';

    const prompt = `
You are an IELTS examiner.

Analyze the test results and give feedback:
- Identify weak grammar or vocabulary areas
- Mention common mistake patterns
- Give 3 short improvement tips
- Use simple English
- Max 120 words

Test mistakes:
${mistakesText}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 300,
      });

      return {
        feedback:
          response.choices[0].message.content ?? 'No feedback generated.',
      };
    } catch (error) {
      this.logger.error('AI feedback error', error);
      return {
        feedback:
          '⚠️ AI feedback vaqtincha mavjud emas. Keyinroq urinib ko‘ring.',
      };
    }
  }
}
