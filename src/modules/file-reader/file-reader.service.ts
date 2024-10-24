import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { cwd } from 'process';

@Injectable()
export class FileReaderService {
  private readonly logger: Logger = new Logger(FileReaderService.name);
  private readonly docsPath = path.join(cwd(), 'docs');

  constructor() {}

  public async getFiles(): Promise<Buffer[]> {
    try {
      const files = fs.readdirSync(this.docsPath);
      const result: Buffer[] = [];

      for (const file of files) {
        const filePath = path.join(this.docsPath, file);

        if (fs.statSync(filePath).isFile()) {
          const buffer: Buffer = fs.readFileSync(filePath);
          result.push(buffer);
        }
      }

      this.logger.debug(`Successfully read ${result.length} files.`);

      return result;
    } catch (error) {
      this.logger.error(error);
    }
  }
}
