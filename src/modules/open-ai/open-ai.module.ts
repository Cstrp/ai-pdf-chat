import { Module } from '@nestjs/common';
import { OpenAiService } from './open-ai.service';

@Module({
  controllers: [],
  providers: [OpenAiService],
})
export class OpenAiModule {}
