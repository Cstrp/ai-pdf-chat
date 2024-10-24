import { Module } from '@nestjs/common';
import { FileReaderService } from 'src/modules/file-reader/file-reader.service';
import { OpenAiService } from 'src/modules/open-ai/open-ai.service';
import { PdfParseService } from 'src/modules/pdf-parse/pdf-parse.service';
import { TaskService } from './task.service';

@Module({
  controllers: [],
  providers: [TaskService, PdfParseService, FileReaderService, OpenAiService],
})
export class TaskModule {}
