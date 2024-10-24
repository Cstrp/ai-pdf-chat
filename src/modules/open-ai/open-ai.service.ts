import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PineconeRecord } from '@pinecone-database/pinecone';
import { error } from 'console';
import OpenAI from 'openai';

@Injectable()
export class OpenAiService implements OnModuleInit {
  private readonly logger: Logger = new Logger(OpenAiService.name);
  private openAi: OpenAI;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.authorize();
  }

  public async createCompletion(vector: PineconeRecord) {}

  public async createEmbedding(text: string): Promise<number[]> {
    if (!text || typeof text !== 'string') {
      throw new Error('Input text must be a non-empty string');
    }

    try {
      const cleanedText = this.cleanExtractedText(text);
      const responce = await this.openAi.embeddings.create({
        model: 'text-embedding-ada-002',
        input: cleanedText,
      });

      const content = responce.data[0].embedding;

      return content;
    } catch (errro) {
      this.logger.error(`Error while fetching embedding: ${error}`);
    }
  }

  private cleanExtractedText(text: string): string {
    if (!text) return '';

    return text.replace(/\s+/g, ' ').trim();
  }

  private authorize() {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      this.logger.error('OpenAI API key not configured');
      throw new Error('OpenAI API key is not set');
    }

    const openAiClient = new OpenAI({ apiKey });
    this.openAi = openAiClient;
  }
}
