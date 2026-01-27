import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-test')
  async generateTest() {
    return this.aiService.generateTest();
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
}
