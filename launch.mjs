// node launch.mjs meta <image url>          write coin/metadata.json
// node launch.mjs <metadata url> [--send]   build and simulate the create; --send sends it
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Connection, Keypair, LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js';

const FIRST_BUY_SOL = 0.005;
const MAX_SPEND_SOL = 0.05;
const RPC = process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com';

const coin = JSON.parse(readFileSync('coin/coin.json', 'utf8'));
const [arg, flag] = process.argv.slice(2);

if (arg === 'meta') {
  const image = flag;
  if (!image?.startsWith('https://')) throw new Error('pass the image URL');
  writeFileSync('coin/metadata.json', JSON.stringify({ ...coin, image }, null, 2) + '\n');
  process.exit(0);
}

if (!arg?.startsWith('https://')) throw new Error('pass the metadata URL');
if (!coin.description.includes('make.fun/bounty/makefun-coin-promo-01')) throw new Error('description lacks the bounty link');
if (!/^https:\/\/(.+\.)?make\.fun\//.test(coin.website)) throw new Error('website is not on make.fun');

const meta = await (await fetch(arg)).json();
for (const k of ['name', 'symbol', 'description', 'website']) {
  if (meta[k] !== coin[k]) throw new Error(`hosted metadata ${k} differs from coin/coin.json`);
}
const img = await fetch(meta.image);
if (!img.ok || !img.headers.get('content-type')?.startsWith('image/')) throw new Error(`image does not read: ${meta.image}`);

const wallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.WALLET ?? 'wallet.json', 'utf8'))));
mkdirSync('out', { recursive: true });
if (!existsSync('out/mint.json')) writeFileSync('out/mint.json', JSON.stringify([...Keypair.generate().secretKey]), { mode: 0o600 });
const mint = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync('out/mint.json', 'utf8'))));

const res = await fetch('https://pumpportal.fun/api/trade-local', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    publicKey: wallet.publicKey.toBase58(),
    action: 'create',
    tokenMetadata: { name: coin.name, symbol: coin.symbol, uri: arg },
    mint: mint.publicKey.toBase58(),
    denominatedInSol: 'true',
    amount: FIRST_BUY_SOL,
    slippage: 10,
    priorityFee: 0.0001,
    pool: 'pump',
  }),
});
if (res.status !== 200) throw new Error(`trade-local ${res.status}: ${await res.text()}`);
const tx = VersionedTransaction.deserialize(new Uint8Array(await res.arrayBuffer()));
tx.sign([mint, wallet]);

const conn = new Connection(RPC, 'confirmed');
const before = await conn.getBalance(wallet.publicKey);
const sim = await conn.simulateTransaction(tx, { sigVerify: true, accounts: { encoding: 'base64', addresses: [wallet.publicKey.toBase58()] } });
if (sim.value.err) throw new Error(`simulation failed: ${JSON.stringify(sim.value.err)}\n${sim.value.logs?.join('\n')}`);
const cost = (before - sim.value.accounts[0].lamports) / LAMPORTS_PER_SOL;
console.log(`mint ${mint.publicKey.toBase58()}`);
console.log(`wallet ${wallet.publicKey.toBase58()} balance ${before / LAMPORTS_PER_SOL} SOL`);
console.log(`simulated cost ${cost} SOL (first buy ${FIRST_BUY_SOL} SOL)`);
if (cost > MAX_SPEND_SOL) throw new Error(`cost ${cost} SOL is over the ${MAX_SPEND_SOL} SOL limit`);

if (flag !== '--send') process.exit(0);
const sig = await conn.sendTransaction(tx, { skipPreflight: false, maxRetries: 5 });
console.log(`create_signature ${sig}`);
const done = await conn.confirmTransaction(sig, 'finalized');
if (done.value.err) throw new Error(`create failed: ${JSON.stringify(done.value.err)}`);
writeFileSync('LAUNCH.json', JSON.stringify({ mint: mint.publicKey.toBase58(), create_signature: sig }, null, 2) + '\n');
console.log('finalized, LAUNCH.json written');
