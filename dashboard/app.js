'use strict';
const shipped=window.RADAR;
const D=window.RADAR_MODEL.compute(shipped);
const boardValues=new Map(shipped.rows.map(r=>[r.slug,r.implied_value_usd]));
if(D.rows.some(r=>r.implied_value_usd!==boardValues.get(r.slug)))throw Error('Board recomputation mismatch');
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(n);
const exact=n=>'$'+Math.round(n).toLocaleString('en-US');
const pct=n=>n===null?'—':(n>=0?'+':'')+n.toFixed(2)+'%';
let sort='implied_value_usd',direction=-1;
const columns=[['rank','#'],['name','Protocol'],['category','Category'],['chains','Chains'],['tvl_usd','TVL'],['change_7d','7d TVL'],['age_days','Age / days'],['implied_value_usd','Implied value'],['multiple','MC / TVL'],['plan','Plan']];
$('date').textContent='Snapshot / '+D.as_of;
$('stats').innerHTML=[[D.rows.length,'ranked opportunities'],[D.watchlist_size+'/'+D.watchlist_size,'watchlist covered'],[D.rows.filter(r=>!r.watchlist).length,'below-floor discoveries'],[D.calibration.global_multiple.toFixed(3)+'×','global peer median']].map(([n,t])=>`<div class="stat"><strong>${n}</strong><span>${t}</span></div>`).join('');
$('category').innerHTML+=[...new Set(D.rows.map(r=>r.category??'Uncategorized'))].sort().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
function table(){
 const q=$('search').value.toLowerCase(),cat=$('category').value;
 const rows=D.rows.filter(r=>(!cat||(r.category??'Uncategorized')===cat)&&(!$('watch').checked||r.watchlist)&&[r.name,r.category,...r.chains].join(' ').toLowerCase().includes(q));
 const val=r=>sort==='plan'?r.farm_summary.capital_usd:sort==='multiple'?r.model.base_multiple:sort==='chains'?r.chains.join(', '):r[sort];
 rows.sort((a,b)=>{const x=val(a),y=val(b);if(x===null)return y===null?0:1;if(y===null)return -1;return (typeof x==='string'?x.localeCompare(y):x-y)*direction||a.rank-b.rank;});
 $('head').innerHTML='<tr>'+columns.map(([key,title])=>`<th class="${['rank','tvl_usd','change_7d','age_days','implied_value_usd','multiple'].includes(key)?'num':''}" aria-sort="${sort===key?(direction===1?'ascending':'descending'):'none'}"><button data-sort="${key}">${title}${sort===key?(direction===1?' ↑':' ↓'):''}</button></th>`).join('')+'</tr>';
 $('rows').innerHTML=rows.map(r=>`<tr><td class="small">${String(r.rank).padStart(2,'0')}</td><td><a href="#detail=${encodeURIComponent(r.slug)}">${esc(r.name)}</a>${r.watchlist?'<span class="badge">WATCH</span>':''}</td><td>${esc(r.category??'Uncategorized')}</td><td title="${esc(r.chains.join(', '))}">${esc(r.chains.slice(0,2).join(', '))}${r.chains.length>2?' +'+(r.chains.length-2):''}</td><td title="${exact(r.tvl_usd)}">${money(r.tvl_usd)}</td><td class="${r.change_7d===null?'':r.change_7d>=0?'up':'down'}">${pct(r.change_7d)}</td><td>${r.age_days??'—'}</td><td class="value" title="${exact(r.implied_value_usd)}">${money(r.implied_value_usd)}</td><td title="${r.model.peer_count} category peer${r.model.peer_count===1?'':'s'}">${r.model.base_multiple.toFixed(3)}×<span class="small">${r.model.peer_count} category peer${r.model.peer_count===1?'':'s'}</span></td><td class="plan-cell" title="Capital / estimated total fees / hold days">${exact(r.farm_summary.capital_usd)} / $${r.farm_summary.estimated_total_fees_usd.join('–')}<span class="small">${r.farm_summary.hold_days} days hold</span></td></tr>`).join('');
 $('count').textContent=rows.length+' / '+D.rows.length;
 $('filter-chip').hidden=!(cat||q||$('watch').checked);
 $('filter-chip').textContent=[cat,q?'Search: '+$('search').value:'',$('watch').checked?'Watchlist':''].filter(Boolean).join(' / ')+' · '+rows.length+' of '+D.rows.length;
 $('empty').hidden=rows.length!==0;
}
$('head').addEventListener('click',e=>{const b=e.target.closest('[data-sort]');if(!b)return;direction=sort===b.dataset.sort?-direction:(['name','category','chains','rank'].includes(b.dataset.sort)?1:-1);sort=b.dataset.sort;table();});
$('search').addEventListener('input',table);$('watch').addEventListener('change',table);
$('category').addEventListener('change',()=>{location.hash=$('category').value?'filter='+encodeURIComponent($('category').value):'';table();});
function resetBoard(){sort='implied_value_usd';direction=-1;$('search').value='';$('category').value='';$('watch').checked=false;location.hash='';table();}
$('reset').onclick=resetBoard;
$('radar-nav').onclick=resetBoard;
$('live-rows').innerHTML=D.live.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td title="${exact(p.mcap_usd)}">${money(p.mcap_usd)}</td><td>${money(p.tvl_usd)}</td><td>${(p.mcap_usd/p.tvl_usd).toFixed(3)}×</td></tr>`).join('');
$('clamp-bounds').textContent=`Peer winsorization band: [${(D.calibration.global_multiple/4).toFixed(6)}×, ${(D.calibration.global_multiple*4).toFixed(6)}×]. Final multiple band: [${(D.calibration.global_multiple/3).toFixed(6)}×, ${(D.calibration.global_multiple*3).toFixed(6)}×]. Shrinkage weight k = 6. Zero market caps appear in Live market but do not calibrate the model.`;
$('calibration').innerHTML='<table><thead><tr><th>Category</th><th>Peers</th><th>Raw median</th><th>Winsorized median</th><th>Global median</th><th>Blended multiple</th></tr></thead><tbody>'+Object.entries(D.calibration.categories).map(([c,v])=>`<tr><td>${esc(c)}</td><td class="num">${v.peer_count}</td><td class="num">${v.raw_category_median===null?'—':v.raw_category_median.toFixed(6)+'×'}</td><td class="num">${v.category_median===null?'—':v.category_median.toFixed(6)+'×'}</td><td class="num">${v.global_median.toFixed(6)}×</td><td class="num">${v.multiple.toFixed(6)}×</td></tr>`).join('')+'</tbody></table>';
let boardHash='';
function route(){
 const hash=location.hash.slice(1),params=new URLSearchParams(hash),isDetail=params.has('detail');
 const liveMode=hash==='live';
 document.querySelector('.intro').hidden=isDetail||liveMode;
 $('stats').hidden=isDetail||liveMode;$('model').hidden=isDetail||liveMode;
 $('live').hidden=isDetail||hash!=='live';$('board').hidden=isDetail||hash==='live';$('detail').hidden=!isDetail;
 if(isDetail)window.scrollTo({top:0,left:0,behavior:'instant'});
 if(!isDetail&&!liveMode&&hash!=='model')boardHash=location.hash;
 if(params.has('filter')){$('category').value=params.get('filter');table();}
 if(params.has('detail')){
  const r=D.rows.find(r=>r.slug===params.get('detail'));$('detail').hidden=false;
  if(!r){$('detail').innerHTML='<h2>Protocol not found</h2><a href="#">Return to radar</a>';return;}
  const m=r.model;
  $('detail').innerHTML=`<a class="small" href="${esc(boardHash||'#')}">← Back to radar</a><div class="section-title"><h2>#${r.rank} ${esc(r.name)}</h2><strong class="value">${exact(r.implied_value_usd)} implied value</strong></div><p>${[r.category,r.chains.join(', '),'No token recorded',r.watchlist?'Watchlist':'Discovery'].filter(Boolean).map(esc).join(' / ')}</p><p>${esc(r.why)}</p><div class="breakdown"><div>TVL<strong>${money(r.tvl_usd)}</strong>${exact(r.tvl_usd)}</div><div>Peer multiple<strong>${m.base_multiple.toFixed(4)}×</strong>${m.peer_count} category peer${m.peer_count===1?'':'s'}<br>Winsorized category median: ${m.category_median===null?'—':m.category_median.toFixed(6)+'×'}${m.raw_category_median!==null&&(m.raw_category_median<m.global_median/4||m.raw_category_median>m.global_median*4)?'<br>Raw median '+m.raw_category_median.toFixed(6)+'× outside winsorization band ['+(m.global_median/4).toFixed(6)+'×, '+(m.global_median*4).toFixed(6)+'×]':''}<br>Global median: ${m.global_median.toFixed(6)}×<br>Blended with k = 6</div><div>Growth factor<strong>${m.growth_multiplier.toFixed(4)}×</strong>Raw ${pct(r.change_7d)} · clamped ${pct(m.growth_pct)}</div><div>Maturity factor<strong>${m.maturity_multiplier.toFixed(4)}×</strong>${r.age_days===null?'Unknown age → 365 days':r.age_days+' days'} · listed ${esc(r.listed_at??'unknown')}</div></div><p class="formula">${exact(r.tvl_usd)} × ${m.base_multiple.toFixed(6)} = ${exact(m.base_usd)} base<br>Base × ${m.growth_multiplier.toFixed(6)} × ${m.maturity_multiplier.toFixed(6)} ≈ ${exact(r.implied_value_usd)}</p><p class="recomputed">Recomputed in page: ${exact(r.implied_value_usd)} — matches board.json</p><h3>Field plan / ${esc(r.name)}</h3><p class="muted">Suggested category workflow. Check support and eligibility first; skip actions that do not fit the product. Fees are budget estimates, not snapshot observations.</p><p>Capital: ${exact(r.farm_summary.capital_usd)} / Estimated total fees: $${r.farm_summary.estimated_total_fees_usd.join('–')} / Setup: ${r.farm_summary.setup_minutes} minutes / Hold: ${r.farm_summary.hold_days} days. Fee estimate covers setup, scheduled repeat actions and exit; excludes variable service/exit charges.</p><ol class="plan">${r.farm_steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`;
 }
 if(hash==='live')window.scrollTo({top:0,left:0,behavior:'instant'});
 if(hash==='model')$('model').scrollIntoView({block:'start'});
}
window.addEventListener('hashchange',route);table();route();
