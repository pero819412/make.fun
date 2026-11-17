import { readFileSync, writeFileSync, mkdirSync, cpSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
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
const context = { window: {} as any };
runInNewContext(readFileSync(join(root,'dashboard/model.js'),'utf8'),context);
const radar = context.window.RADAR_MODEL.compute(context.window.RADAR_MODEL.prepare(JSON.parse(readFileSync(input,'utf8'))));
for (const row of radar.rows) {
  const {capital_usd, estimated_total_fees_usd: fees} = row.farm_summary;
  if (!Number.isFinite(capital_usd) || capital_usd <= 0 || fees.length !== 2 || fees.some(f => !Number.isFinite(f) || f < 0) || fees[0] > fees[1] || fees[1] > capital_usd * 0.25) throw Error(`Farm fee budget exceeds contract: ${row.slug}`);
}
const boardRows = radar.rows.map(({farm_summary, ...row})=>row);
if (radar.rows.length < 100 || radar.rows.length > 4000 || radar.rows.some((r,i)=>r.rank!==i+1 || !Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd<=0 || r.implied_value_usd>1e14 || (i>0 && r.implied_value_usd>radar.rows[i-1].implied_value_usd) || r.farm_steps.length<3 || r.farm_steps.length>12 || r.farm_steps.some(s=>s.length<20 || s.length>600))) throw Error('Board fails output contract');
const out = resolve(arg('output',process.env.MAKEFUN_OUTPUT_DIR ?? '/output'));
if (out === resolve(root) || out === resolve(root,'dashboard') || out === resolve(root,'screenshots')) throw Error('Output must be separate from source');
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'board.json'),JSON.stringify({rows:boardRows})+'\n');
writeFileSync(join(out,'data.js'),'window.RADAR='+JSON.stringify({...radar, rows:radar.rows.map(r=>({slug:r.slug,implied_value_usd:r.implied_value_usd,farm_summary:r.farm_summary}))}).replaceAll('<','\\u003c')+';\n');
for (const directory of ['dashboard','screenshots']) cpSync(join(root,directory),join(out,directory),{recursive:true});
writeFileSync(join(out,'dossier.json'),buildDossier(out,{text_max_bytes:65536,screenshots:{max:4,max_bytes:524288},dashboard:{max_files:400,max_bytes:4194304}}));
console.log(`RADAR / ${radar.rows.length} ranked rows / ${radar.watchlist_size} watchlist covered / ${radar.live.length} live records separate`);
console.log(`Global median: ${radar.calibration.global_multiple.toFixed(6)}x from ${radar.calibration.global_peer_count} positive-cap peers. Output: ${out}`);
