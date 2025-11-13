import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SupabaseService } from '../database/supabase.service';
import { OpenAIEmbeddings } from '@langchain/openai';
import IORedis from 'ioredis';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client?: OpenAI;
  private embeddingModel = 'text-embedding-3-small';
  private chatModel = 'gpt-4o-mini';

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    @Inject('REDIS') private readonly redis: IORedis,
  ) {
    const key = this.config.get<string>('OPENAI_API_KEY');
    if (key) {
      this.client = new OpenAI({ apiKey: key });
    } else {
      this.logger.warn('OPENAI_API_KEY not set; AI features are disabled.');
    }
  }

  private ensureClient(): OpenAI {
    if (!this.client) {
      const key = this.config.get<string>('OPENAI_API_KEY');
      if (!key) throw new Error('OPENAI_API_KEY missing');
      this.client = new OpenAI({ apiKey: key });
    }
    const client = this.client;
    if (!client) {
      throw new Error('OPENAI client not initialized');
    }
    return client;
  }

  async embed(text: string): Promise<number[]> {
    // Prefer LangChain embeddings for consistency with RAG
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      const emb = new OpenAIEmbeddings({
        apiKey,
        model: this.embeddingModel,
      });
      const vec = await emb.embedQuery(text);
      return vec as unknown as number[];
    }
    // Fallback to direct OpenAI client if needed
    const client = this.ensureClient();
    const res = await client.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });
    return res.data[0].embedding as unknown as number[];
  }

  async upsertEmbedding(params: {
    orgId: string;
    scope: string;
    refId?: string;
    title?: string;
    content: string;
    metadata?: Record<string, any>;
  }) {
    const embedding = await this.embed(params.content);
    const client = this.supabase.getClient();
    // Simple strategy: delete existing row for same org/scope/refId, then insert
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
  }): Promise<
    Array<{
      id: string;
      scope: string;
      ref_id: string | null;
      title: string | null;
      content: string;
      metadata: any;
      score: number;
    }>
  > {
    const queryEmbedding = await this.embed(params.query);
    const client = this.supabase.getClient();
    type SearchRow = {
      id: string;
      scope: string;
      ref_id: string | null;
      title: string | null;
      content: string;
      metadata: any;
      score: number;
    };
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
      return result.data as SearchRow[];
    }
    return [];
  }

  private async hybridSearch(params: {
    orgId: string;
    scopes: string[];
    question: string;
    k?: number;
  }) {
    const queryEmbedding = await this.embed(params.question);
    const client = this.supabase.getClient();
    type SearchRow = {
      id: string;
      scope: string;
      ref_id: string | null;
      title: string | null;
      content: string;
      metadata: any;
      score: number;
    };
    const result = await client.rpc('search_ai_embeddings_hybrid', {
      p_org: params.orgId,
      p_scopes: params.scopes,
      p_query: queryEmbedding,
      p_terms: params.question,
      p_k: params.k ?? 5,
    });
    if (result.error) {
      this.logger.error('search_ai_embeddings_hybrid failed', result.error);
      return [] as SearchRow[];
    }
    if (Array.isArray(result.data)) {
      return result.data as SearchRow[];
    }
    return [];
  }

  async answerWithRag(params: {
    orgId: string;
    question: string;
    scopes: string[];
  }): Promise<{
    answer: string;
    citations: Array<{ title: string; ref_id: string | null }>;
  }> {
    // Cache key
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

    // Prefer hybrid search
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
    name?: string;
    base_price?: number;
    currency?: string;
    unit?: string;
  }> {
    const client = this.ensureClient();
    const sys = `Extract product fields from user text. JSON keys: name, base_price (number), currency (ISO), unit (default 'lb'). Omit unknowns.`;
    const res = await client.chat.completions.create({
      model: this.chatModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: text },
      ],
    });
    return JSON.parse(res.choices[0].message.content || '{}') as {
      name?: string;
      base_price?: number;
      currency?: string;
      unit?: string;
    };
  }

  async extractHarvest(text: string): Promise<{
    crop?: string;
    quantity?: number;
    unit?: string;
    expected_harvest_window?: string;
    notes?: string;
  }> {
    const client = this.ensureClient();
    const sys = `Extract harvest info. JSON: {crop, quantity (number), unit, expected_harvest_window, notes}. Omit unknowns.`;
    const res = await client.chat.completions.create({
      model: this.chatModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: text },
      ],
    });
    return JSON.parse(res.choices[0].message.content || '{}') as {
      crop?: string;
      quantity?: number;
      unit?: string;
      expected_harvest_window?: string;
      notes?: string;
    };
  }

  async extractQuote(text: string): Promise<{
    request_id?: string;
    unit_price?: number;
    currency?: string;
    available_quantity?: number;
    delivery_date?: string;
    notes?: string;
  }> {
    const client = this.ensureClient();
    const sys = `Extract quote fields. JSON: {request_id, unit_price (number), currency, available_quantity (number), delivery_date, notes}. Omit unknowns.`;
    const res = await client.chat.completions.create({
      model: this.chatModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: text },
      ],
    });
    return JSON.parse(res.choices[0].message.content || '{}') as {
      request_id?: string;
      unit_price?: number;
      currency?: string;
      available_quantity?: number;
      delivery_date?: string;
      notes?: string;
    };
  }

  async extractOrderAction(text: string): Promise<{
    action?: 'accept' | 'reject' | 'update';
    order_id?: string;
    reason?: string;
    tracking_number?: string;
    status?: string;
    estimated_delivery_date?: string;
  }> {
    const client = this.ensureClient();
    const sys = `Extract order action: accept/reject/update. JSON: {action, order_id, reason, tracking_number, status, estimated_delivery_date}. Omit unknowns.`;
    const res = await client.chat.completions.create({
      model: this.chatModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: text },
      ],
    });
    return JSON.parse(res.choices[0].message.content || '{}') as {
      action?: 'accept' | 'reject' | 'update';
      order_id?: string;
      reason?: string;
      tracking_number?: string;
      status?: string;
      estimated_delivery_date?: string;
    };
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
}
