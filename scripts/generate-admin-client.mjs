import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const root = resolve(import.meta.dirname, '..');
const lock = JSON.parse(await readFile(resolve(root, 'contracts/admin-api.lock.json'), 'utf8'));
const source = process.env.ADMIN_API_CONTRACT_SOURCE;
if (!source)
  throw new Error(
    'ADMIN_API_CONTRACT_SOURCE must be an HTTPS artifact URL or local release artifact path',
  );
const remote = /^https:\/\//.test(source);
const bytes = remote
  ? Buffer.from(await (await fetch(source, { signal: AbortSignal.timeout(15_000) })).arrayBuffer())
  : await readFile(resolve(root, source));
const digest = createHash('sha256').update(bytes).digest('hex');
if (digest !== lock.sha256)
  throw new Error(`Contract checksum mismatch for ${lock.name}@${lock.version}: ${digest}`);
const nodes = await openapiTS(remote ? new URL(source) : pathToFileURL(resolve(root, source)));
const output = `// Generated from ${lock.name}@${lock.version}; do not edit.\n${astToString(nodes)}`;
const target = resolve(root, 'src/services/admin-api/generated.ts');
if (process.argv.includes('--check')) {
  if ((await readFile(target, 'utf8')) !== output)
    throw new Error('Generated admin client is stale');
} else await writeFile(target, output);
