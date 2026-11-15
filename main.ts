import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const botDir = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const base58 = (s: unknown, min: number, max: number) =>
  typeof s === 'string' && s.length >= min && s.length <= max && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);

const raw = readFileSync(join(botDir, 'LAUNCH.json'));
const launch = JSON.parse(raw.toString('utf8'));
if (raw.length > 16384 || !base58(launch.mint, 32, 44) || !base58(launch.create_signature, 64, 88)) {
  console.error('LAUNCH.json must name a base58 mint (32-44) and create_signature (64-88)');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'LAUNCH.json'), raw);
