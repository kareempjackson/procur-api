import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const candidateEnvPaths = [
  process.env.ENV_FILE,
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '../../.env'),
].filter(Boolean) as string[];
for (const p of candidateEnvPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const PATH = process.argv[2] || 'templates/faq.json';
const EMB_MODEL = 'text-embedding-3-small';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error('Resolved env paths tried:', candidateEnvPaths);
  console.error('SUPABASE_URL present:', !!SUPABASE_URL);
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY present:',
    !!SUPABASE_SERVICE_ROLE_KEY,
  );
  console.error('OPENAI_API_KEY present:', !!OPENAI_API_KEY);
  throw new Error(
    'Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY',
  );
}

async function main() {
  const file = fs.readFileSync(PATH, 'utf8');
  const spec = JSON.parse(file) as {
    items: Array<{ title: string; content: string; scope?: string }>;
  };
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  for (const it of spec.items) {
    const scope = it.scope || 'faq';
    const content = it.content;
    const title = it.title;
    const emb = await openai.embeddings.create({
      model: EMB_MODEL,
      input: content,
    });
    const embedding = emb.data[0].embedding as unknown as number[];
    const { error } = await supabase.from('ai_embeddings').insert({
      org_id: null,
      scope,
      ref_id: null,
      title,
      content,
      metadata: { source: 'seed' },
      embedding,
    });
    if (error) {
      console.error('Insert failed', title, error);
    } else {
      console.log('Inserted', title);
    }
  }
}

main().catch((e) => {
  console.error(e?.response?.data || e);
  process.exit(1);
});
