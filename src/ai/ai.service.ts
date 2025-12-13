import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import IORedis from 'ioredis';
import OpenAI from 'openai';
import { z } from 'zod';

import { SupabaseService } from '../database/supabase.service';

type Metadata = Record<string, unknown>;

interface UpsertEmbeddingParams {
  orgId: string;
  scope: string;
  refId?: string;
  title?: string;
  content: string;
  metadata?: Metadata;
}

interface SearchResult {
  id: string;
  scope: string;
  ref_id: string | null;
  title: string | null;
  content: string;
  metadata: Metadata | null;
  score: number;
}

interface RagAnswer {
  answer: string;
  citations: Array<{ title: string; ref_id: string | null }>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client?: OpenAI;
  private readonly embeddingModel = 'text-embedding-3-small';
  private readonly chatModel = 'gpt-4o-mini';

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    @Inject('REDIS') private readonly redis: IORedis,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set; AI features are disabled.');
      return;
    }

    this.client = new OpenAI({ apiKey });
  }

  private ensureClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.config.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY missing');
      }
      this.client = new OpenAI({ apiKey });
    }

    return this.client;
  }

  async embed(text: string): Promise<number[]> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      const emb = new OpenAIEmbeddings({
        apiKey,
        model: this.embeddingModel,
      });
      const vec = await emb.embedQuery(text);
      return vec;
    }

    const client = this.ensureClient();
    const res = await client.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });
    return res.data[0].embedding as unknown as number[];
  }

  async upsertEmbedding(params: UpsertEmbeddingParams): Promise<void> {
    const embedding = await this.embed(params.content);
    const client = this.supabase.getClient();

    if (params.refId) {
      await client
        .from('ai_embeddings')
        .delete()
        .eq('org_id', params.orgId)
        .eq('scope', params.scope)
        .eq('ref_id', params.refId);
    }
    const { error } = await client.from('ai_embeddings').insert({
      org_id: params.orgId,
      scope: params.scope,
      ref_id: params.refId ?? null,
      title: params.title ?? null,
      content: params.content,
      metadata: params.metadata ?? null,
      embedding,
    });
    if (error) {
      this.logger.error('Failed to upsert embedding', error);
    }
  }

  async search(params: {
    orgId: string;
    scopes: string[];
    query: string;
    k?: number;
  }): Promise<SearchResult[]> {
    const queryEmbedding = await this.embed(params.query);
    const client = this.supabase.getClient();
    const result = await client.rpc('search_ai_embeddings', {
      p_org: params.orgId,
      p_scopes: params.scopes,
      p_query: queryEmbedding,
      p_k: params.k ?? 5,
    });
    if (result.error) {
      this.logger.error('search_ai_embeddings failed', result.error);
      return [];
    }
    if (Array.isArray(result.data)) {
      return result.data as SearchResult[];
    }
    return [];
  }

  private async hybridSearch(params: {
    orgId: string;
    scopes: string[];
    question: string;
    k?: number;
  }): Promise<SearchResult[]> {
    const queryEmbedding = await this.embed(params.question);
    const client = this.supabase.getClient();
    const result = await client.rpc('search_ai_embeddings_hybrid', {
      p_org: params.orgId,
      p_scopes: params.scopes,
      p_query: queryEmbedding,
      p_terms: params.question,
      p_k: params.k ?? 5,
    });
    if (result.error) {
      this.logger.error('search_ai_embeddings_hybrid failed', result.error);
      return [];
    }
    if (Array.isArray(result.data)) {
      return result.data as SearchResult[];
    }
    return [];
  }

  async answerWithRag(params: {
    orgId: string;
    question: string;
    scopes: string[];
  }): Promise<RagAnswer> {
    const cacheKey = `rag:${params.orgId}:${params.scopes.join(',')}:${params.question
      .toLowerCase()
      .trim()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as {
          answer: string;
          citations: Array<{ title: string; ref_id: string | null }>;
        };
        return parsed;
      } catch {
        // ignore parse error
      }
    }

    let contexts = await this.hybridSearch({
      orgId: params.orgId,
      scopes: params.scopes,
      question: params.question,
      k: 3,
    });
    if (!contexts.length) {
      contexts = await this.search({
        orgId: params.orgId,
        scopes: params.scopes,
        query: params.question,
        k: 3,
      });
    }
    if (!contexts.length) {
      return {
        answer:
          'I could not find relevant info. Try a different question or type "menu".',
        citations: [],
      };
    }
    const contextText = contexts
      .map(
        (c, i) =>
          `#${i + 1} ${c.title ?? c.scope}:\n${(c.content || '').slice(0, 600)}`,
      )
      .join('\n\n');
    const client = this.ensureClient();
    const sys =
      'You assist farmers on WhatsApp. Answer concisely (<=2 sentences) using the provided context. If unclear, ask a short clarifying question.';
    const res = await client.chat.completions.create({
      model: this.chatModel,
      temperature: 0.2,
      messages: [
        { role: 'system', content: sys },
        {
          role: 'user',
          content: `Context:\n${contextText}\n\nQuestion: ${params.question}`,
        },
      ],
    });
    const answer =
      res.choices[0].message.content || 'Sorry, I could not answer that.';
    const citations = contexts.map((c) => ({
      title: c.title ?? c.scope,
      ref_id: c.ref_id,
    }));
    const result = { answer, citations };
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 60 * 60 * 2);
    return result;
  }

  async extractProduct(text: string): Promise<{
    name: string | null;
    base_price: number | null;
    currency: string | null;
    unit: string | null;
  }> {
    const schema = z.object({
      name: z.string().nullable(),
      base_price: z.number().nullable(),
      currency: z.string().nullable(),
      unit: z.string().nullable(),
    });
    return this.invokeStructuredModel(
      schema,
      `Extract product fields. If unit missing, omit it. Text: ${text}`,
    );
  }

  async extractHarvest(text: string): Promise<{
    crop: string | null;
    quantity: number | null;
    unit: string | null;
    expected_harvest_window: string | null;
    notes: string | null;
  }> {
    const schema = z.object({
      crop: z.string().nullable(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      expected_harvest_window: z.string().nullable(),
      notes: z.string().nullable(),
    });
    return this.invokeStructuredModel(
      schema,
      `Extract upcoming harvest info. Text: ${text}`,
    );
  }

  async extractQuote(text: string): Promise<{
    request_id: string | null;
    unit_price: number | null;
    currency: string | null;
    available_quantity: number | null;
    delivery_date: string | null;
    notes: string | null;
  }> {
    const schema = z.object({
      request_id: z.string().nullable(),
      unit_price: z.number().nullable(),
      currency: z.string().nullable(),
      available_quantity: z.number().nullable(),
      delivery_date: z.string().nullable(),
      notes: z.string().nullable(),
    });
    return this.invokeStructuredModel(
      schema,
      `Extract quote fields. Text: ${text}`,
    );
  }

  async extractOrderAction(text: string): Promise<{
    action: 'accept' | 'reject' | 'update' | null;
    order_id: string | null;
    reason: string | null;
    tracking_number: string | null;
    status: string | null;
    estimated_delivery_date: string | null;
  }> {
    const schema = z.object({
      action: z.enum(['accept', 'reject', 'update']).nullable(),
      order_id: z.string().nullable(),
      reason: z.string().nullable(),
      tracking_number: z.string().nullable(),
      status: z.string().nullable(),
      estimated_delivery_date: z.string().nullable(),
    });
    return this.invokeStructuredModel(
      schema,
      `Extract order action fields: accept/reject/update. Text: ${text}`,
    );
  }

  async moderate(text: string): Promise<boolean> {
    try {
      const client = this.ensureClient();
      const res = await client.moderations.create({
        model: 'omni-moderation-latest',
        input: text,
      });
      const first: unknown = Array.isArray(res.results)
        ? res.results[0]
        : undefined;
      if (first && typeof first === 'object' && 'flagged' in first) {
        const f = (first as Record<string, unknown>).flagged;
        return Boolean(f);
      }
      return false;
    } catch (e: unknown) {
      this.logger.warn('Moderation failed; allowing text', e as Error);
      return false;
    }
  }

  private async invokeStructuredModel<TSchema extends z.ZodType<unknown>>(
    schema: TSchema,
    prompt: string,
  ): Promise<z.infer<TSchema>> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY missing');
    }
    const llm = new ChatOpenAI({
      modelName: this.chatModel,
      temperature: 0.2,
      apiKey,
    });
    const model = llm.withStructuredOutput(schema) as {
      invoke: (input: string) => Promise<z.infer<TSchema>>;
    };
    const result = await model.invoke(prompt);
    return schema.parse(result);
  }
}
