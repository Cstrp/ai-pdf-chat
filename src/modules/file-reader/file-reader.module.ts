import { Module } from '@nestjs/common';
import { FileReaderService } from './file-reader.service';

@Module({
  controllers: [],
  providers: [FileReaderService],
})
export class FileReaderModule {}
