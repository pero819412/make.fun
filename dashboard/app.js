'use strict';
const D=window.RADAR;
if(!D)throw new Error('Snapshot data is missing: run main.ts and open out/dashboard/index.html');
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(n);
const exact=n=>'$'+Math.round(n).toLocaleString('en-US');
const pct=n=>n===null?'—':(n>=0?'+':'')+n.toFixed(2)+'%';
let sort='implied_value_usd',direction=-1;
const columns=[['rank','#'],['name','Protocol'],['category','Category'],['chains','Chains'],['tvl_usd','TVL'],['change_7d','7d TVL'],['age_days','Age / days'],['implied_value_usd','Implied value'],['multiple','MC / TVL']];
$('date').textContent='SEALED SNAPSHOT / '+D.as_of;
$('stats').innerHTML=[[D.rows.length,'ranked opportunities'],[D.watchlist_size+'/'+D.watchlist_size,'watchlist covered'],[D.rows.filter(r=>!r.watchlist).length,'below-floor discoveries'],[D.calibration.global_multiple.toFixed(3)+'×','global peer median']].map(([n,t])=>`<div class="stat"><strong>${n}</strong><span>${t}</span></div>`).join('');
$('category').innerHTML+=[...new Set(D.rows.map(r=>r.category??'Uncategorized'))].sort().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
function table(){
 const q=$('search').value.toLowerCase(),cat=$('category').value;
 const rows=D.rows.filter(r=>(!cat||(r.category??'Uncategorized')===cat)&&(!$('watch').checked||r.watchlist)&&[r.name,r.category,...r.chains].join(' ').toLowerCase().includes(q));
 const val=r=>sort==='multiple'?r.model.base_multiple:sort==='chains'?r.chains.join(', '):r[sort];
 rows.sort((a,b)=>{const x=val(a),y=val(b);if(x===null)return y===null?0:1;if(y===null)return -1;return (typeof x==='string'?x.localeCompare(y):x-y)*direction||a.rank-b.rank;});
 $('head').innerHTML='<tr>'+columns.map(([key,title])=>`<th aria-sort="${sort===key?(direction===1?'ascending':'descending'):'none'}"><button data-sort="${key}">${title}${sort===key?(direction===1?' ↑':' ↓'):''}</button></th>`).join('')+'</tr>';
 $('rows').innerHTML=rows.map(r=>`<tr><td class="small">${String(r.rank).padStart(2,'0')}</td><td><a href="#detail=${encodeURIComponent(r.slug)}">${esc(r.name)}</a>${r.watchlist?'<span class="badge">WATCH</span>':''}</td><td>${esc(r.category??'Uncategorized')}</td><td title="${esc(r.chains.join(', '))}">${esc(r.chains.slice(0,2).join(', '))}${r.chains.length>2?' +'+(r.chains.length-2):''}</td><td title="${exact(r.tvl_usd)}">${money(r.tvl_usd)}</td><td class="${r.change_7d>=0?'up':'down'}">${pct(r.change_7d)}</td><td>${r.age_days??'—'}</td><td class="value" title="${exact(r.implied_value_usd)}">${money(r.implied_value_usd)}</td><td title="${r.model.peer_count} category peers${r.model.fallback?'; global fallback':''}">${r.model.base_multiple.toFixed(3)}×${r.model.fallback?' *':''}<span class="small">${r.model.peer_count} category peers</span></td></tr>`).join('');
 $('count').textContent=rows.length+' / '+D.rows.length;
 $('empty').hidden=rows.length!==0;
}
$('head').addEventListener('click',e=>{const b=e.target.closest('[data-sort]');if(!b)return;direction=sort===b.dataset.sort?-direction:(['name','category','chains','rank'].includes(b.dataset.sort)?1:-1);sort=b.dataset.sort;table();});
$('search').addEventListener('input',table);$('watch').addEventListener('change',table);
$('category').addEventListener('change',()=>{location.hash=$('category').value?'filter='+encodeURIComponent($('category').value):'';table();});
$('reset').onclick=()=>{$('search').value='';$('category').value='';$('watch').checked=false;location.hash='';table();};
$('live-rows').innerHTML=D.live.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td title="${exact(p.mcap_usd)}">${money(p.mcap_usd)}</td><td>${money(p.tvl_usd)}</td><td>${(p.mcap_usd/p.tvl_usd).toFixed(3)}×</td></tr>`).join('');
$('clamp-bounds').textContent='Calibration bounds: '+D.calibration.winsor_low.toFixed(6)+'× to '+D.calibration.winsor_high.toFixed(6)+'×. Zero market caps are visible in Live market but excluded from valuation peers.';
$('calibration').innerHTML=`<span>Global: ${D.calibration.global_multiple.toFixed(3)}× / ${D.calibration.global_peer_count} peers</span>`+Object.entries(D.calibration.categories).filter(([,v])=>!v.fallback).map(([c,v])=>`<span>${esc(c)}: ${v.multiple.toFixed(3)}× / ${v.peer_count} peers</span>`).join('');
function route(){
 const hash=location.hash.slice(1),params=new URLSearchParams(hash),isDetail=params.has('detail');
 document.querySelector('.intro').hidden=isDetail;
 $('stats').hidden=isDetail;$('model').hidden=isDetail;
 $('live').hidden=isDetail||hash!=='live';$('board').hidden=isDetail||hash==='live';$('detail').hidden=!isDetail;
 if(isDetail)window.scrollTo({top:0,left:0,behavior:'instant'});
 if(!hash){$('category').value='';table();}
 if(params.has('filter')){$('category').value=params.get('filter');table();}
 if(params.has('detail')){
  const r=D.rows.find(r=>r.slug===params.get('detail'));$('detail').hidden=false;
  if(!r){$('detail').innerHTML='<h2>Protocol not found</h2><a href="#">Return to radar</a>';return;}
  const m=r.model;
  $('detail').innerHTML=`<a class="small" href="#">← Back to radar</a><div class="section-title"><h2>#${r.rank} ${esc(r.name)}</h2><strong class="value">${exact(r.implied_value_usd)} implied value</strong></div><p>${esc(r.category)} · ${esc(r.chains.join(', '))} · No token recorded · ${r.watchlist?'Watchlist':'Below-floor discovery'}</p><p>${esc(r.why)}</p><div class="breakdown"><div>TVL<strong>${money(r.tvl_usd)}</strong>${exact(r.tvl_usd)}</div><div>Peer multiple<strong>${m.base_multiple.toFixed(4)}×</strong>${m.peer_count} category peers · ${m.fallback?'global fallback, '+m.calibration_peer_count+' peers':'category median'}</div><div>Growth factor<strong>${m.growth_multiplier.toFixed(4)}×</strong>Raw ${pct(r.change_7d)} · clamped ${pct(m.growth_pct)}</div><div>Maturity factor<strong>${m.maturity_multiplier.toFixed(4)}×</strong>${r.age_days===null?'Unknown age → 365 days':r.age_days+' days'} · listed ${esc(r.listed_at??'unknown')}</div></div><p class="formula">${exact(r.tvl_usd)} × ${m.base_multiple.toFixed(6)} = ${exact(m.base_usd)} base<br>Base × ${m.growth_multiplier.toFixed(6)} × ${m.maturity_multiplier.toFixed(6)} ≈ ${exact(r.implied_value_usd)}</p><h3>Field plan / ${esc(r.name)}</h3><p class="muted">Suggested category workflow. Check support and eligibility first; skip actions that do not fit the product. Fees are budget estimates, not snapshot observations.</p><ol class="plan">${r.farm_steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`;
 }
 if(hash==='live'||hash==='model')$(hash).scrollIntoView({block:'start'});
}
window.addEventListener('hashchange',route);table();route();
