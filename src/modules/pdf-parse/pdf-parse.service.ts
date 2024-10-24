import { Injectable, Logger } from '@nestjs/common';
import * as pdf from 'pdf-parse'; // Исправленный импорт

@Injectable()
export class PdfParseService {
  private readonly logger: Logger = new Logger(PdfParseService.name);

  constructor() {}

  public async parsePDF(buffer: Buffer): Promise<pdf.Result | null> {
    try {
      const data = await pdf(buffer);

      return data;
    } catch (error) {
      this.logger.error(`PDF parsing failed: ${error.message}`);
      return null;
    }
  }
}
