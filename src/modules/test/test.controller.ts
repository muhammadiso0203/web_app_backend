// tests.controller.ts
import { Body, Controller, Post } from "@nestjs/common";
import { TestsService } from "./test.service";

@Controller("tests")
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Post("submit")
  submit(@Body() body: any) {
    return this.testsService.submitTest(body);
  }
}
