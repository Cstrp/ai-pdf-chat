import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { FileReaderModule } from './modules/file-reader/file-reader.module';
import { OpenAiModule } from './modules/open-ai/open-ai.module';
import { PdfParseModule } from './modules/pdf-parse/pdf-parse.module';
import { TaskModule } from './modules/task/task.module';

@Module({
  imports: [
    FileReaderModule,
    PdfParseModule,
    OpenAiModule,
    ConfigModule.forRoot({ cache: true, isGlobal: true }),
    ScheduleModule.forRoot({}),
    TaskModule,
  ],
  controllers: [],
})
export class AppModule {}
