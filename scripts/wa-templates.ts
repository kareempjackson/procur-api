import 'dotenv/config';
import axios from 'axios';
import * as fs from 'fs';

const WABA_ID = process.env.WHATSAPP_WABA_ID;
const ACCESS_TOKEN =
  process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN; // system user or WA token with management scope
if (!WABA_ID) throw new Error('Missing WHATSAPP_WABA_ID');
if (!ACCESS_TOKEN) throw new Error('Missing META_ACCESS_TOKEN/WHATSAPP_TOKEN');
const API = `https://graph.facebook.com/v24.0/${WABA_ID}`;

type Component = {
  type: string;
  text?: string;
  buttons?: any[];
  format?: string;
};
type Lang = { code: string; components: Component[] };
type Tpl = {
  name: string;
  category: 'AUTHENTICATION' | 'UTILITY' | 'MARKETING';
  languages: Lang[];
};
type Spec = { templates: Tpl[] };
type GraphTemplate = {
  name: string;
  language: string;
  category: string;
  components: Component[];
};

function toTemplate(x: unknown): GraphTemplate | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name : '';
  const language = typeof o.language === 'string' ? o.language : '';
  const category = typeof o.category === 'string' ? o.category : '';
  const components = Array.isArray(o.components)
    ? (o.components as Component[])
    : [];
  if (!name || !language) return null;
  return { name, language, category, components };
}

interface ListResponse {
  data?: unknown[];
}

async function listTemplates(): Promise<GraphTemplate[]> {
  const res = await axios.get<ListResponse>(`${API}/message_templates`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  const raw = res.data.data ?? [];
  const items: GraphTemplate[] = [];
  for (const x of raw) {
    const t = toTemplate(x);
    if (t) items.push(t);
  }
  return items;
}

async function createTemplate(input: {
  name: string;
  category: string;
  language: string;
  components: Component[];
}) {
  return axios.post(`${API}/message_templates`, input, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
}

async function deleteTemplate(name: string, language: string) {
  return axios.delete(`${API}/message_templates`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    data: { name, language },
  });
}

function cmp(a: any, b: any) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureTemplates(specPath: string) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const spec: Spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const existing: GraphTemplate[] = await listTemplates();

  for (const tpl of spec.templates) {
    for (const lang of tpl.languages) {
      const found = existing.find(
        (x) => x.name === tpl.name && x.language === lang.code,
      );
      if (!found) {
        await createTemplate({
          name: tpl.name,
          category: tpl.category,
          language: lang.code,
          components: lang.components,
        });
        continue;
      }
      const same =
        cmp(found.components, lang.components) &&
        found.category === tpl.category;
      if (!same) {
        // If category differs, Graph requires deletion to fully settle before recreate
        if (found.category !== tpl.category) {
          await deleteTemplate(tpl.name, lang.code);
          // Poll until gone or timeout
          let retries = 10;
          while (retries-- > 0) {
            const cur: GraphTemplate[] = await listTemplates();
            const still = cur.find(
              (x) => x.name === tpl.name && x.language === lang.code,
            );
            if (!still) break;
            await sleep(1000);
          }
          // If still present, create with a new versioned name to avoid category mismatch
          const cur2: GraphTemplate[] = await listTemplates();
          const still = cur2.find(
            (x) => x.name === tpl.name && x.language === lang.code,
          );
          const createName = still ? `${tpl.name}_v2` : tpl.name;
          await createTemplate({
            name: createName,
            category: tpl.category,
            language: lang.code,
            components: lang.components,
          });
        } else {
          // Category same, safe to replace by delete/recreate
          await deleteTemplate(tpl.name, lang.code);
          await createTemplate({
            name: tpl.name,
            category: tpl.category,
            language: lang.code,
            components: lang.components,
          });
        }
      }
    }
  }
  console.log('Templates synced.');
}

async function main() {
  const cmd = process.argv[2];
  const path = process.argv[3] || 'templates/whatsapp.json';
  if (cmd === 'apply') return ensureTemplates(path);
  if (cmd === 'list') return console.log(await listTemplates());
  if (cmd === 'delete') {
    const name = process.argv[3];
    const language = process.argv[4] || 'en_US';
    if (!name) {
      throw new Error(
        'Usage: ts-node scripts/wa-templates.ts delete <name> [language]',
      );
    }
    return deleteTemplate(name, language);
  }
  console.log(
    'Usage: ts-node scripts/wa-templates.ts apply|list|delete <path|name> [language]',
  );
}

function extractErrorData(e: unknown): unknown {
  if (typeof e === 'object' && e) {
    const anyE = e as Record<string, unknown>;
    const resp = anyE.response as Record<string, unknown> | undefined;
    const data = resp?.data;
    if (data !== undefined) return data;
  }
  return undefined;
}

main().catch((e: unknown) => {
  const data = extractErrorData(e);
  console.error(data ?? e);
  process.exit(1);
});
