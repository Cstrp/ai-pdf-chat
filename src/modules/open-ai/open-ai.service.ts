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

  public async createCompletion(
    prompt: string,
    ask: string,
    ctx: PineconeRecord,
  ): Promise<string | null> {
    if (!prompt || typeof prompt !== 'string' || !ctx) {
      throw new Error('Input prompt must be a non-empty string');
    }

    try {
      const vector = ctx.values.toString();
      const model = 'chatgpt-4o-latest';

      const { choices } = await this.openAi.chat.completions.create({
        model,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: vector },
          { role: 'user', content: ask },
        ],
        temperature: 1,
      });

      const content = choices[0].message.content;

      if (!content || content.toLowerCase().includes('error')) {
        this.logger.warn(`OpenAI agent returned an error: ${content}`);
        return null;
      }

      return content;
    } catch (error) {
      this.logger.error(`Error while fetching completion: ${error}`);
    }
  }

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

  private authorize(): void {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      this.logger.error('OpenAI API key not configured');
      throw new Error('OpenAI API key is not set');
    }

    const openAiClient = new OpenAI({ apiKey });
    this.openAi = openAiClient;
  }
}
