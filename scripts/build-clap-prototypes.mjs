#!/usr/bin/env node
/**
 * One-off builder for the Latin mood/genre prototypes in clap-prototypes.json.
 *
 * The checked-in profile was generated from English prompts. This script adds
 * labels that fit Latin/Spanish music using the CLAP **text** encoder and merges
 * them into the same file, so the runtime has a single vocabulary. Labels stay
 * in canonical English; Spanish display names live in clapProfile.ts.
 *
 * The music-semantics-lite pack ships the audio encoder only. The text encoder
 * (text_model_quantized.onnx, about 127 MB) is fetched once from the pinned
 * revision into a scratch cache, never into the app's pack directory:
 *
 *   node scripts/build-clap-prototypes.mjs
 *
 * Re-run only when the label set changes; the vectors are deterministic for a
 * given revision.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ROOT = process.cwd();
const MODEL_ID = 'Xenova/clap-htsat-unfused';
const REVISION = 'c28f2883575e590e04d3146ff0713c2448d691ba';
const TEXT_CACHE = process.env.CLAP_TEXT_CACHE ?? join(homedir(), '.cache', 'corteo-clap-text');
const APP_CACHE = join(homedir(), '.openchatcut', 'asr-models');
const OUT = join(ROOT, 'src', 'audio', 'intelligence', 'clap-prototypes.json');

const LABELS = {
  mood: [
    ['nostalgic', 'nostalgic, wistful and bittersweet music'],
    ['hopeful', 'hopeful, uplifting and warm music'],
    ['festive', 'festive, celebratory Latin party music'],
    ['sensual', 'sensual, intimate and romantic Latin music'],
    ['spiritual', 'spiritual, devotional and meditative music'],
  ],
  genre: [
    ['cumbia', 'cumbia music with guiro and accordion'],
    ['salsa', 'salsa music with brass and timbales'],
    ['bolero', 'bolero romantic ballad with guitars'],
    ['reggaeton', 'reggaeton with dembow rhythm'],
    ['huayno', 'Andean huayno music with charango and quena'],
    ['flamenco', 'flamenco with Spanish guitar and palmas'],
    ['latin rock', 'Latin rock with electric guitars'],
  ],
};

async function seedTextModel() {
  const target = join(TEXT_CACHE, MODEL_ID, 'onnx', 'text_model_quantized.onnx');
  if (existsSync(target)) return;
  // The app may already have the audio pack; the text half is never shipped
  // there, so borrow nothing and download once from the pinned revision.
  await mkdir(join(TEXT_CACHE, MODEL_ID, 'onnx'), { recursive: true });
  const source = join(APP_CACHE, MODEL_ID, 'onnx', 'text_model_quantized.onnx');
  if (existsSync(source)) {
    await copyFile(source, target);
    return;
  }
  const url = `https://huggingface.co/${MODEL_ID}/resolve/${REVISION}/onnx/text_model_quantized.onnx`;
  console.log(`downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`CLAP text encoder download failed: HTTP ${response.status}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
}

function normalize(values) {
  const length = Math.hypot(...values) || 1;
  return values.map((value) => Number((value / length).toFixed(8)));
}

await seedTextModel();

const transformers = await import('@huggingface/transformers');
const { env, AutoTokenizer, ClapTextModelWithProjection } = transformers;
env.localModelPath = TEXT_CACHE;
env.cacheDir = TEXT_CACHE;
env.allowLocalModels = true;
env.allowRemoteModels = true; // tokenizer files only; weights are already local

const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, { revision: REVISION });
const model = await ClapTextModelWithProjection.from_pretrained(MODEL_ID, {
  revision: REVISION,
  device: 'cpu',
  dtype: 'q8',
});

const labels = [];
for (const [kind, entries] of Object.entries(LABELS)) {
  for (const [label, prompt] of entries) {
    const inputs = await tokenizer([prompt], { padding: true });
    const output = await model(inputs);
    const data = output.text_embeds?.data;
    if (!data || data.length !== 512) throw new Error(`CLAP returned an invalid embedding for ${label}`);
    labels.push({ kind, label, vector: normalize(Array.from(data)) });
    console.log(`${kind}: ${label}`);
  }
}

const existing = JSON.parse(await readFile(OUT, 'utf8'));
const merged = new Map(existing.labels.map((entry) => [`${entry.kind}:${entry.label}`, entry]));
for (const entry of labels) merged.set(`${entry.kind}:${entry.label}`, entry);
// Same compact shape as the original file and no timestamp: a re-run with the
// same vectors has to leave the file byte-identical.
await writeFile(OUT, JSON.stringify({
  modelId: MODEL_ID,
  revision: REVISION,
  labels: [...merged.values()],
}) + '\n');
console.log(`wrote ${OUT} (${merged.size} labels)`);
