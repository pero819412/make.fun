/* Shared, deterministic snapshot model: browser and Node VM. */
(function () {
'use strict';
const key=p=>p.category??'Uncategorized';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const median=xs=>{const a=[...xs].sort((a,b)=>a-b),n=a.length;return n ? n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2 : null;};
function eligible(p){return p.mcap_usd===null&&p.gecko_id===null&&p.symbol===null&&!['Bridge','Canonical Bridge','Liquid Staking','Liquid Restaking','Restaked BTC','CEX'].includes(p.category)&&!(/\s(v\d+(\.\d+)?|\d+\.\d+)$/i.test(p.name)||/\b(wrapped|staked|staking)\b/i.test(p.name)||/^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/i.test(p.name));}
function prepare(s){
 const age=p=>p.listed_at?Math.max(0,Math.floor((Date.parse(s.as_of)-Date.parse(p.listed_at))/86400000)):null;
 return {as_of:s.as_of,floor_usd:s.floor_usd,watchlist_size:s.watchlist.length,
 peers:s.protocols.filter(p=>p.mcap_usd>0&&p.tvl_usd>0).map(({slug,category,tvl_usd,mcap_usd})=>({slug,category,tvl_usd,mcap_usd})),
 candidates:s.protocols.filter(p=>eligible(p)&&(s.watchlist.includes(p.slug)||p.tvl_usd<s.floor_usd)).map(p=>({slug:p.slug,name:p.name,category:p.category,chains:p.chains,tvl_usd:p.tvl_usd,change_7d_pct:p.change_7d,listed_days:age(p),listed_at:p.listed_at,watchlist:s.watchlist.includes(p.slug)})),
 live:s.protocols.filter(p=>p.mcap_usd!==null).sort((a,b)=>b.mcap_usd-a.mcap_usd)};
}
function calibrate(s){
 const global=median(s.peers.map(p=>p.mcap_usd/p.tvl_usd));
 if(global===null)throw Error('No positive live peers');
 const categories=Object.fromEntries([...new Set([...s.peers,...s.candidates].map(key))].sort().map(c=>{
 const ps=s.peers.filter(p=>key(p)===c),n=ps.length,raw=median(ps.map(p=>p.mcap_usd/p.tvl_usd)),cm=median(ps.map(p=>clamp(p.mcap_usd/p.tvl_usd,global/4,global*4)));
 return [c,{peer_count:n,raw_category_median:raw,category_median:cm,global_median:global,multiple:clamp((n*(cm??0)+6*global)/(n+6),global/3,global*3)}];}));
 return {global_multiple:global,global_peer_count:s.peers.length,shrinkage_k:6,categories};
}
const exactActions={
 'Onchain Capital Allocator':'Deposit','Indexes':'Buy index shares worth','Risk Curators':'Deposit','Options Vault':'Deposit',
 'Restaking':'Restake','Dexs':'Add liquidity worth','Lending':'Supply','CDP':'Deposit collateral worth',
 'Prediction Market':'Fund a prediction market account with','Governance Incentives':'Allocate',
 'Crypto Card Issuer':'Fund a card account with','Insurance':'Buy cover with a premium of'
};
function plan(p){
 let amount=p.tvl_usd>=1e9?250:p.tvl_usd>=1e8?150:p.tvl_usd>=2e7?75:40;
 const chain=p.chains.find(c=>c!=='Ethereum')??p.chains[0]??'the supported chain',age=p.listed_days;
 const days=age===null?30:age<180?60:age<365?45:30;
 const gas=chain==='Ethereum'?[5,20]:[.1,3],c=key(p);
 const cadence=chain==='Ethereum'?'monthly':'weekly',interval=chain==='Ethereum'?30:7;
 const repeats=Math.ceil(days/interval),tx=repeats+3;
 // Reserve setup, entry, repeat actions and exit, plus a 1% service allowance.
 while(tx*gas[1]+Math.ceil(amount*.01)>amount*.1)amount=Math.ceil((amount+1)/50)*50;
 const fee=Math.ceil(amount*.01);
 let action=exactActions[c];
 if(!action){
 if(/vault|curator|allocator|index|restak|yield|farm/i.test(c))action='Deposit';
 else if(/lend|cdp|collateral/i.test(c))action='Supply collateral worth';
 else if(/dex|liquidity/i.test(c))action='Add liquidity worth';
 else if(/\bbridge\b|\bchain\b/i.test(c))action='Transfer';
 else if(/derivative|options|trading/i.test(c))action='Fund a trading account with';
 else if(/payment/i.test(c))action='Make a payment of';
 else if(/stak/i.test(c))action='Stake';
 else action='Allocate';
 }
 const trading=/derivative|options|trading|\bbridge\b|\bchain\b/i.test(c)&&!/vault/i.test(c);
 const product=/exchange|aggregator/i.test(c)?'position':/vault|curator|allocator|yield|farm/i.test(c)?'vault':null;
 const target=product?`${/^[aeiou]/i.test(p.name)?'an':'a'} ${p.name} ${product}`:p.name;
 const summary={capital_usd:amount,estimated_total_fees_usd:[Number((tx*gas[0]).toFixed(2)),tx*gas[1]+fee],setup_minutes:30,hold_days:days};
 const steps=[
 `Prepare $${amount} for ${p.name} on ${chain}. Verify the official app, supported assets, minimums, eligibility and withdrawal terms before funding. Stop if these checks fail. Cost: $${gas.join('–')} gas allowance. Time: 10 minutes.`,
 `${action} $${amount} ${action==='Deposit'?'into':action==='Transfer'?'through':'using'} ${target} on ${chain}. Cost: $${gas.join('–')} gas plus $${fee} estimated fees/slippage allowance. Time: 20 minutes.`,
 `${cadence==='monthly'?'Monthly':'Weekly'}: monitor risks and repeat one useful supported action with the $${amount} activity on ${p.name} on ${chain} without manufacturing volume. Cost: $${gas.join('–')} gas per ${cadence} action. Time: 10 minutes ${cadence}.`,
 `At the end of the ${days}-day hold on ${chain} (${age===null?'listing age unknown':age+' days listed'}), decide whether to exit the $${amount} activity. Check the withdrawal or unstake window and claim eligibility, then log the outcome and exit decision. ${trading?'Retain trade or transfer records.':'Record any queue or lockup before withdrawing.'} Cost: $0 to review. Time: 10 minutes.`,
 `Check ${p.name}'s official rewards page for the $${amount} activity; record when no campaign exists. Never pay to claim or disclose a seed phrase. Cost: $0 to check. Time: 5 minutes weekly.`,
 `Exit the $${amount} activity on ${chain}: repay any debt, withdraw or redeem when allowed, revoke unused approvals and log transactions and fees. Cost: reserve $${gas.join('–')} gas plus documented exit fees. Time: 15 minutes; queues may add days.`
 ];
 return {summary,steps};
}
function compute(s){
 const calibration=calibrate(s);
 const rows=s.candidates.map(p=>{
 const cat=calibration.categories[key(p)],growth=clamp(p.change_7d_pct??0,-60,120),gf=1+growth/200,mf=.6+.4*Math.min(p.listed_days??365,1095)/1095,base=p.tvl_usd*cat.multiple,fp=plan(p);
 return {...p,change_7d:p.change_7d_pct,age_days:p.listed_days,token_status:'pre-token',implied_value_usd:Math.max(1,Math.round(base*gf*mf)),model:{base_usd:base,base_multiple:cat.multiple,peer_count:cat.peer_count,raw_category_median:cat.raw_category_median,category_median:cat.category_median,global_median:cat.global_median,growth_pct:growth,growth_multiplier:gf,maturity_multiplier:mf},why:`TVL × ${cat.multiple.toFixed(6)}x blended multiple; ${cat.peer_count} category peer${cat.peer_count===1?'':'s'}; growth and listing maturity applied.`,farm_steps:fp.steps,farm_summary:fp.summary};
 }).sort((a,b)=>b.implied_value_usd-a.implied_value_usd||a.slug.localeCompare(b.slug)).map((p,i)=>({...p,rank:i+1}));
 return {...s,calibration,rows};
}
window.RADAR_MODEL={median,eligible,prepare,calibrate,plan,compute};
})();
