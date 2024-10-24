import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Pinecone,
  PineconeRecord,
  QueryOptions,
  RecordMetadata,
} from '@pinecone-database/pinecone';
import { vector } from '../../constants/vector';
import { FileReaderService } from '../file-reader/file-reader.service';
import { OpenAiService } from '../open-ai/open-ai.service';
import { PdfParseService } from '../pdf-parse/pdf-parse.service';

@Injectable()
export class TaskService implements OnModuleInit {
  private readonly logger = new Logger(TaskService.name);
  private pinecone: Pinecone | null = null;
  private idxName: string = '';

  constructor(
    private readonly pdfParseSerivce: PdfParseService,
    private readonly fileReaderService: FileReaderService,
    private readonly openAiService: OpenAiService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    this.pinecone = await this.initPinecone();
  }

  // Can be change to custom cron expression
  @Cron(CronExpression.EVERY_12_HOURS)
  public async run() {
    await this.init();
  }

  private async getAllRecords() {
    try {
      const idx = this.pinecone.Index(this.idxName);
      let records: PineconeRecord<RecordMetadata>[] = [];
      const options: QueryOptions = {
        topK: 100,
        includeMetadata: true,
        includeValues: true,
        vector,
      };

      const res = await idx.query(options);

      if (res.matches) {
        records = records.concat(res.matches);
      }

      this.logger.log(`Found ${records.length} records`);

      return records;
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async init() {
    try {
      const files = await this.fileReaderService.getFiles();

      for (const file of files) {
        await this.delay(5000);

        const pdf = await this.pdfParseSerivce.parsePDF(file);
        const extractedText = pdf.text;

        this.logger.log(`Extracted text length: ${extractedText.length}`);

        const embeddings = await this.generateEmbeddings(extractedText);
        await this.delay(1000);

        if (!embeddings) {
          this.logger.warn(`No embeddings generated for file: ${file}`);
          continue;
        }

        const metadata: RecordMetadata = {
          filename: `${this.generateUniqueId()}.pdf`,
          textSnippet: extractedText.substring(0, 200),
        };

        const pineconeRec: PineconeRecord<RecordMetadata> = {
          id: this.generateUniqueId(),
          values: embeddings,
          metadata,
        };

        this.logger.log(`Adding record with ID: ${pineconeRec.id}`);
        await this.addEmbedding(pineconeRec);
      }

      this.logger.debug('Processing complete!');
    } catch (error) {
      this.logger.error(`Error during processing: ${error.message}`);
    }
  }

  private async generateEmbeddings(text: string): Promise<number[]> {
    try {
      const embeddingResponse = await this.openAiService.createEmbedding(text);

      if (!embeddingResponse || embeddingResponse.length === 0) {
        throw new Error('No embeddings received');
      }

      return embeddingResponse;
    } catch (error) {
      this.logger.error(`Error generating embeddings: ${error.message}`);
    }
  }

  private async addEmbedding(embeddings: PineconeRecord<RecordMetadata>) {
    if (!this.pinecone) {
      return;
    }

    try {
      const idx = this.pinecone.Index(this.idxName);
      const upsertData: Array<PineconeRecord<RecordMetadata>> = [
        {
          id: embeddings.id,
          values: embeddings.values,
          metadata: embeddings.metadata || {},
        },
      ];

      await idx.upsert(upsertData);
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async initPinecone() {
    try {
      this.idxName = this.config.get<string>('PINECONE_INDEX_NAME');
      const apiKey = this.config.get<string>('PINECONE_API_KEY');
      const panicone = new Pinecone({ apiKey });

      return panicone;
    } catch (error) {
      this.logger.error(error);
    }
  }

  private generateUniqueId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
