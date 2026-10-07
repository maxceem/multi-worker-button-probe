// Feasibility probe only: no gateway code, credentials, database, or billing.
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const config = JSON.parse(await readFile('wrangler.json', 'utf8'));
const name = process.env.WRANGLER_CI_OVERRIDE_NAME || config.name;
if (!/^[a-z0-9][a-z0-9-]{0,43}$/.test(name)) throw new Error('Choose a Worker name of at most 44 lowercase letters, digits, or hyphens');
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) throw new Error('This probe requires the account ID and API token provided to Workers Builds');
const source = await readFile('realtime.js', 'utf8');
const release = createHash('sha256').update(source + config.compatibility_date + 'wrangler@4.113.0').digest('hex').slice(0, 12);
const companion = `${name}-rt-${release}`;

async function api(path, allowMissing = false) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000),
  });
  const body = await response.json();
  if (allowMissing && body.errors?.some(error => error.code === 10007)) return null;
  if (!response.ok || !body.success) throw new Error(`Cloudflare API failure: ${JSON.stringify(body.errors)}`);
  return body.result;
}

async function deploy(path, env) {
  await new Promise((resolve, reject) => {
    const child = spawn('./node_modules/.bin/wrangler', ['deploy', '--config', path], {env, stdio:'inherit'});
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Wrangler exited with ${code}`)));
  });
}

const companionConfig = {
  name: companion, main: 'realtime.js', compatibility_date: config.compatibility_date,
  account_id: account, workers_dev: true, preview_urls: false,
  vars: { RELEASE: release },
  durable_objects: { bindings: [{name:'SESSIONS', class_name:'ProbeSession'}] },
  migrations: [{tag:'v1', new_sqlite_classes:['ProbeSession']}],
};
await writeFile('realtime.generated.json', JSON.stringify(companionConfig, null, 2));

// Workers Builds targets one primary Worker. Keep its checks on the primary
// subprocess, but do not apply that identity to a separately named companion.
const companionEnv = {...process.env};
delete companionEnv.WRANGLER_CI_OVERRIDE_NAME;
delete companionEnv.WRANGLER_CI_MATCH_TAG;
if (await api('/workers/services/' + companion, true)) {
  console.log(`Keeping existing realtime release ${companion}`);
} else {
  await deploy('realtime.generated.json', companionEnv);
}

const {subdomain} = await api('/workers/subdomain');
if (!subdomain) throw new Error('Enable a workers.dev subdomain before running this probe');
const realtimeURL = `https://${companion}.${subdomain}.workers.dev`;
let ready = false;
for (let attempt = 0; attempt < 10; attempt++) {
  try {
    const response = await fetch(realtimeURL + '/health', {signal:AbortSignal.timeout(5000)});
    ready = response.ok && (await response.json()).release === release;
  } catch {}
  if (ready) break;
  await new Promise(resolve => setTimeout(resolve, 2000));
}
if (!ready) throw new Error('Companion health check failed; primary Worker has not been updated');

await writeFile('gateway.generated.json', JSON.stringify({
  ...config, name, account_id: account,
  vars: {RELEASE:release, REALTIME_URL:realtimeURL},
  services: [{binding:'REALTIME', service:companion}],
}, null, 2));
await deploy('gateway.generated.json', process.env);
console.log('Realtime endpoint: ' + realtimeURL + '/ws');
console.log('Probe only: old realtime releases are retained. Remove the probe Workers after testing.');
