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

function sanitizeBodyText(text: string, tplName: string, lang: string): string {
  const rawLines = text.split('\n');
  const lines = rawLines.map((raw) => {
    const t = raw.trim();
    const starts = t.startsWith('{{');
    const ends = t.endsWith('}}');
    let adjusted = t;
    if (starts) {
      adjusted = `Note: ${adjusted}`;
      console.warn(
        `Adjusted leading param for ${tplName}/${lang}: "${t}" -> "${adjusted}"`,
      );
    }
    if (ends) {
      adjusted = `${adjusted}.`;
      console.warn(
        `Adjusted trailing param for ${tplName}/${lang}: "${t}" -> "${adjusted}"`,
      );
    }
    return adjusted;
  });
  // Ensure the first non-empty line doesn't start with '{{'
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstIdx >= 0 && lines[firstIdx].trim().startsWith('{{')) {
    lines[firstIdx] = `Note: ${lines[firstIdx].trim()}`;
    console.warn(
      `Adjusted first line leading param for ${tplName}/${lang}: line ${firstIdx}`,
    );
  }
  // Ensure the last non-empty line doesn't end with '}}'
  let lastIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().length > 0) {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx >= 0 && lines[lastIdx].trim().endsWith('}}')) {
    lines[lastIdx] = `${lines[lastIdx].trim()}.`;
    console.warn(
      `Adjusted last line trailing param for ${tplName}/${lang}: line ${lastIdx}`,
    );
  }
  const finalText = lines.join('\n');
  console.log(`[TPL] ${tplName}/${lang} BODY:`, finalText);
  return finalText;
}

function sanitizeComponents(
  components: Component[],
  tplName: string,
  lang: string,
): Component[] {
  return components.map((c) => {
    if (c.type === 'BODY' && typeof c.text === 'string') {
      return { ...c, text: sanitizeBodyText(c.text, tplName, lang) };
    }
    return c;
  });
}

async function createTemplate(input: {
  name: string;
  category: string;
  language: string;
  components: Component[];
}) {
  const payload = {
    ...input,
    components: sanitizeComponents(
      input.components,
      input.name,
      input.language,
    ),
  };
  console.log('Creating template', {
    name: payload.name,
    language: payload.language,
    category: payload.category,
  });
  return axios.post(`${API}/message_templates`, payload, {
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
        // Create with retry/backoff for category transition errors (e.g., 2388025)
        try {
          await createTemplate({
            name: tpl.name,
            category: tpl.category,
            language: lang.code,
            components: lang.components,
          });
        } catch (e: any) {
          const subcode =
            e?.response?.data?.error?.error_subcode ||
            e?.response?.data?.error_subcode;
          const msg: string =
            e?.response?.data?.error?.error_user_msg ||
            e?.response?.data?.error?.message ||
            '';
          if (subcode === 2388025 || /category is invalid/i.test(msg)) {
            // Wait briefly and retry once; if it still fails, fall back to MARKETING category
            await sleep(60000);
            try {
              await createTemplate({
                name: tpl.name,
                category: tpl.category,
                language: lang.code,
                components: lang.components,
              });
            } catch {
              await createTemplate({
                name: tpl.name,
                category: 'MARKETING',
                language: lang.code,
                components: lang.components,
              });
            }
          } else if (
            subcode === 2388023 ||
            /language is being deleted/i.test(msg)
          ) {
            // Language variant still being deleted; retry then create a versioned name
            await sleep(60000);
            try {
              await createTemplate({
                name: tpl.name,
                category: tpl.category,
                language: lang.code,
                components: lang.components,
              });
            } catch {
              const versioned = `${tpl.name}_${lang.code}_v2`;
              try {
                await createTemplate({
                  name: versioned,
                  category: tpl.category,
                  language: lang.code,
                  components: lang.components,
                });
              } catch (e2: any) {
                const subcode2 =
                  e2?.response?.data?.error?.error_subcode ||
                  e2?.response?.data?.error_subcode;
                const msg2: string =
                  e2?.response?.data?.error?.error_user_msg ||
                  e2?.response?.data?.error?.message ||
                  '';
                if (subcode2 === 2388025 || /category is invalid/i.test(msg2)) {
                  await createTemplate({
                    name: versioned,
                    category: 'MARKETING',
                    language: lang.code,
                    components: lang.components,
                  });
                } else {
                  throw e2;
                }
              }
            }
          } else {
            throw e;
          }
        }
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
          // Attempt recreate with fallback to MARKETING on category transition error
          try {
            await createTemplate({
              name: createName,
              category: tpl.category,
              language: lang.code,
              components: lang.components,
            });
          } catch (e: any) {
            const subcode =
              e?.response?.data?.error?.error_subcode ||
              e?.response?.data?.error_subcode;
            const msg: string =
              e?.response?.data?.error?.error_user_msg ||
              e?.response?.data?.error?.message ||
              '';
            if (subcode === 2388025 || /category is invalid/i.test(msg)) {
              await sleep(60000);
              try {
                await createTemplate({
                  name: createName,
                  category: tpl.category,
                  language: lang.code,
                  components: lang.components,
                });
              } catch {
                await createTemplate({
                  name: createName,
                  category: 'MARKETING',
                  language: lang.code,
                  components: lang.components,
                });
              }
            } else if (
              subcode === 2388023 ||
              /language is being deleted/i.test(msg)
            ) {
              await sleep(60000);
              try {
                await createTemplate({
                  name: createName,
                  category: tpl.category,
                  language: lang.code,
                  components: lang.components,
                });
              } catch {
                const createName2 = `${createName}_${lang.code}_v2`;
                try {
                  await createTemplate({
                    name: createName2,
                    category: tpl.category,
                    language: lang.code,
                    components: lang.components,
                  });
                } catch (e2: any) {
                  const subcode2 =
                    e2?.response?.data?.error?.error_subcode ||
                    e2?.response?.data?.error_subcode;
                  const msg2: string =
                    e2?.response?.data?.error?.error_user_msg ||
                    e2?.response?.data?.error?.message ||
                    '';
                  if (
                    subcode2 === 2388025 ||
                    /category is invalid/i.test(msg2)
                  ) {
                    await createTemplate({
                      name: createName2,
                      category: 'MARKETING',
                      language: lang.code,
                      components: lang.components,
                    });
                  } else {
                    throw e2;
                  }
                }
              }
            } else {
              throw e;
            }
          }
        } else {
          // Category same, safe to replace by delete/recreate
          await deleteTemplate(tpl.name, lang.code);
          try {
            await createTemplate({
              name: tpl.name,
              category: tpl.category,
              language: lang.code,
              components: lang.components,
            });
          } catch (e: any) {
            const subcode =
              e?.response?.data?.error?.error_subcode ||
              e?.response?.data?.error_subcode;
            const msg: string =
              e?.response?.data?.error?.error_user_msg ||
              e?.response?.data?.error?.message ||
              '';
            if (subcode === 2388025 || /category is invalid/i.test(msg)) {
              await sleep(60000);
              try {
                await createTemplate({
                  name: tpl.name,
                  category: tpl.category,
                  language: lang.code,
                  components: lang.components,
                });
              } catch {
                await createTemplate({
                  name: tpl.name,
                  category: 'MARKETING',
                  language: lang.code,
                  components: lang.components,
                });
              }
            } else if (
              subcode === 2388023 ||
              /language is being deleted/i.test(msg)
            ) {
              await sleep(60000);
              try {
                await createTemplate({
                  name: tpl.name,
                  category: tpl.category,
                  language: lang.code,
                  components: lang.components,
                });
              } catch {
                const versioned = `${tpl.name}_${lang.code}_v2`;
                try {
                  await createTemplate({
                    name: versioned,
                    category: tpl.category,
                    language: lang.code,
                    components: lang.components,
                  });
                } catch (e2: any) {
                  const subcode2 =
                    e2?.response?.data?.error?.error_subcode ||
                    e2?.response?.data?.error_subcode;
                  const msg2: string =
                    e2?.response?.data?.error?.error_user_msg ||
                    e2?.response?.data?.error?.message ||
                    '';
                  if (
                    subcode2 === 2388025 ||
                    /category is invalid/i.test(msg2)
                  ) {
                    await createTemplate({
                      name: versioned,
                      category: 'MARKETING',
                      language: lang.code,
                      components: lang.components,
                    });
                  } else {
                    throw e2;
                  }
                }
              }
            } else {
              throw e;
            }
          }
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
