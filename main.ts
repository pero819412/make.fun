import { readFileSync, writeFileSync, mkdirSync, cpSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRadar } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';
const args = process.argv.slice(2);
function arg(name: string, fallback: string) {
  const index = args.indexOf('--'+name);
  if (index >= 0 && (!args[index+1] || args[index+1].startsWith('--'))) throw Error('Missing value for --'+name);
  return index >= 0 ? args[index+1] : args.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3) ?? fallback;
}
const root = fileURLToPath(new URL('.',import.meta.url));
let input = arg('input','/input/snapshot.json');
if (statSync(input).isDirectory()) input = join(input,'snapshot.json');
const radar = buildRadar(JSON.parse(readFileSync(input,'utf8')));
if (radar.rows.length < 100 || radar.rows.length > 4000 || radar.rows.some((r,i)=>r.rank!==i+1 || !Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd<=0 || r.implied_value_usd>1e14 || (i>0 && r.implied_value_usd>radar.rows[i-1].implied_value_usd) || r.farm_steps.length<3 || r.farm_steps.length>12 || r.farm_steps.some(s=>s.length<20 || s.length>600))) throw Error('Board fails output contract');
const out = resolve(arg('output',process.env.MAKEFUN_OUTPUT_DIR ?? '/output'));
if (out === resolve(root) || out === resolve(root,'dashboard') || out === resolve(root,'screenshots')) throw Error('Output must be separate from source');
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'board.json'),JSON.stringify({rows:radar.rows})+'\n');
writeFileSync(join(out,'data.js'),'window.RADAR='+JSON.stringify(radar).replaceAll('<','\\u003c')+';\n');
for (const directory of ['dashboard','screenshots']) cpSync(join(root,directory),join(out,directory),{recursive:true});
writeFileSync(join(out,'dossier.json'),buildDossier(out,{text_max_bytes:65536,screenshots:{max:4,max_bytes:524288},dashboard:{max_files:400,max_bytes:4194304}}));
console.log(`RADAR / ${radar.rows.length} ranked rows / ${radar.watchlist_size} watchlist covered / ${radar.live.length} live records separate`);
console.log(`Global median: ${radar.calibration.global_multiple.toFixed(6)}x from ${radar.calibration.global_peer_count} positive-cap peers. Output: ${out}`);
