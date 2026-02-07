import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-test')
  async generateTest(@Body() body: { telegramId: string }) {
    return this.aiService.generateTest(body.telegramId);
  }

  @Post('generate-translate-test')
  async generateTranslateTest(@Body() body: { telegramId: string }) {
    return this.aiService.generateTranslateTest(body.telegramId);
  }

  @Post('check-result')
  async checkResult(
    @Body()
    body: {
      tests: any[];
      answers: number[];
    },
  ) {
    return this.aiService.checkResult(body);
  }

  @Post('detailed-feedback')
  async generateFeedback(
    @Body()
    body: {
      telegramId: string;
      questions: any[];
      userAnswers: number[];
    },
  ) {
    return this.aiService.generateFeedback(body);
  }
}
