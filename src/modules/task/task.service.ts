import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Pinecone,
  PineconeRecord,
  QueryOptions,
  RecordMetadata,
} from '@pinecone-database/pinecone';
import { PromptList } from 'src/constants/promptList';
import { vector } from '../../constants/vector';
import { FileReaderService } from '../file-reader/file-reader.service';
import { OpenAiService } from '../open-ai/open-ai.service';
import { PdfParseService } from '../pdf-parse/pdf-parse.service';

@Injectable()
export class TaskService implements OnModuleInit {
  private readonly logger = new Logger(TaskService.name);
  private pinecone: Pinecone | null = null;
  private idxName: string = '';
  private records: PineconeRecord<RecordMetadata>[] = [];

  constructor(
    private readonly pdfParseSerivce: PdfParseService,
    private readonly fileReaderService: FileReaderService,
    private readonly openAiService: OpenAiService,
    private readonly config: ConfigService,
  ) {}

  public async onModuleInit(): Promise<void> {
    this.pinecone = await this.initPinecone();
    this.records = await this.getAllRecords();
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  public async run(): Promise<void> {
    await this.init();
  }

  private async createChat() {
    try {
      const prompt = PromptList.Example;
      const ctx = this.records;
      const ask = 'What data from the provided context can you provide me?';

      const answer = await this.openAiService.createCompletion(
        prompt,
        ask,
        ctx[0],
      );

      this.logger.log(`Answer: ${answer}`);
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async getAllRecords(): Promise<PineconeRecord<RecordMetadata>[]> {
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

      return records;
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async init(): Promise<void> {
    try {
      const files = await this.fileReaderService.getFiles();

      for (const file of files) {
        const pdf = await this.pdfParseSerivce.parsePDF(file);
        const extractedText = pdf.text;

        this.logger.log(`Extracted text length: ${extractedText.length}`);

        const embeddings = await this.retryGenerateEmbeddings(
          extractedText,
          5,
          5000,
        );

        if (!embeddings) {
          this.logger.warn(
            `Failed to generate embeddings after multiple attempts for extracted text: \n${extractedText}`,
          );
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

  private async retryGenerateEmbeddings(
    text: string,
    attempts: number,
    delayMs: number,
  ): Promise<number[] | null> {
    let embeddings: number[] | null = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        this.logger.log(`Attempt ${attempt} to generate embeddings...`);
        embeddings = await this.generateEmbeddings(text);
        if (embeddings) {
          this.logger.log(
            `Embeddings generated successfully on attempt ${attempt}`,
          );
          return embeddings;
        }
      } catch (error) {
        this.logger.error(
          `Error generating embeddings on attempt ${attempt}: ${error.message}`,
        );
      }
      this.logger.warn(`Retrying after ${delayMs} ms...`);
      await this.delay(delayMs);
    }

    this.logger.error(
      `Failed to generate embeddings after ${attempts} attempts.`,
    );
    return null;
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

  private async initPinecone(): Promise<Pinecone> {
    try {
      this.idxName = this.config.get<string>('PINECONE_INDEX_NAME');
      const apiKey = this.config.get<string>('PINECONE_API_KEY');
      const pinecone = new Pinecone({ apiKey });

      return pinecone;
    } catch (error) {
      this.logger.error(error);
    }
  }

  private generateUniqueId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
