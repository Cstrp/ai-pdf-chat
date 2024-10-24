import { Module } from '@nestjs/common';
import { PdfParseService } from './pdf-parse.service';

@Module({
  controllers: [],
  providers: [PdfParseService],
})
export class PdfParseModule {}
