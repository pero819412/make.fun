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
 const summary={capital_usd:amount,estimated_total_fees_usd:[Number((tx*gas[0]).toFixed(2)),tx*gas[1]+fee],setup_minutes:30,hold_days:days};
 const entry=`$${amount} on ${chain} through ${p.name}`;
 const monitor=`${cadence==='monthly'?'Monthly':'Weekly'} on ${chain}`;
 const playbooks=[
 [/risk curator/i,[
  `Deposit a supported stablecoin worth ${entry} into the curator vault; verify its collateral exposure, curator mandate and redemption terms.`,
  `Record the vault shares received and starting share price for ${p.name}; check which lending markets and collateral assets the curator can allocate to.`,
  `${monitor}: track vault share price, curator rebalancing, utilization and bad-debt exposure. Keep the stablecoin vault position only while its mandate fits.`,
  `After ${days} days, compare ${p.name} vault share value with the original stablecoin deposit and review any redemption queue before requesting withdrawal.`]],
 [/onchain capital allocator/i,[
  `Deposit a supported stablecoin worth ${entry} into an allocator vault after reviewing strategy weights, manager permissions and redemption limits.`,
  `${monitor}: inspect ${p.name}'s stablecoin allocations, strategy returns and manager changes; rebalance only when the stated strategy requires it.`,
  `At ${days} days, reconcile allocator vault shares against the stablecoin deposit and request redemption if strategy risk or withdrawal terms have changed.`]],
 [/lend/i,[
  `Supply a supported stablecoin worth ${entry} to the lending market; check utilization, supply caps and available withdrawal liquidity.`,
  `Borrow only if a lending loop is intended: cap initial borrowing at 30% LTV against the supplied collateral, use a supported stablecoin and record the liquidation threshold. Otherwise keep ${p.name} supply-only.`,
  `${monitor}: watch health factor, collateral prices, variable borrow rates and stablecoin liquidity. Repay debt early if health factor approaches 2; do not increase borrowing to manufacture activity.`,
  `At ${days} days, compare ${p.name} stablecoin supply interest with borrowing costs, repay all debt before removing collateral and check withdrawal liquidity.`]],
 [/^cdp$|collateralized debt/i,[
  `Deposit supported collateral worth ${entry} into a CDP; verify its oracle, liquidation threshold and collateral-specific debt ceiling.`,
  `Mint the protocol stablecoin against that collateral only below a 30% initial LTV ceiling and below the product's own limit; keep a stablecoin repayment reserve outside ${p.name}.`,
  `${monitor}: check collateral value, stablecoin peg, stability fees and liquidation distance; repay minted debt if LTV rises toward 40% or a stricter product limit.`,
  `After ${days} days, repay the minted stablecoin plus accrued fees in ${p.name}, close the CDP and release collateral when the debt balance reaches zero.`]],
 [/dex|liquidity/i,[
  `Add liquidity worth ${entry} to the main supported trading pair after checking both token assets, pool depth, fee tier and impermanent-loss exposure.`,
  `For concentrated liquidity on ${p.name}, set a price range suited to the pair and record both token quantities and entry prices; use the full-range pool if ranges are unsupported.`,
  `Check the pair's price range weekly; ${chain==='Ethereum'?'batch any paid range adjustment monthly':'adjust the range only when justified by price movement'}. Compare earned swap fees with impermanent loss before adding capital.`,
  `At ${days} days, remove ${p.name} liquidity if appropriate, collect accrued pair fees and compare the two redeemed token balances with simply holding the entry assets.`]],
 [/derivative|perp|options|trading/i,[
  `Fund a derivatives margin account with supported stablecoin collateral worth ${entry}; inspect funding rates, liquidation rules and settlement assets.`,
  `Use only a small part of ${p.name} margin for a supported perpetual or derivative position, with at most 1x notional exposure and a predefined loss limit; skip trades without an intended thesis.`,
  `${monitor}: review stablecoin margin, funding payments and liquidation distance. Close positions at the loss limit and retain fills and funding records for the ${days}-day review.`]],
 [/index/i,[
  `Buy supported index shares worth ${entry}; inspect the underlying token basket, constituent weights, redemption method and management fees.`,
  `${monitor}: compare ${p.name} index share price with basket NAV, track constituent rebalances and avoid buying at a large premium.`,
  `After ${days} days, compare the index token basket return with fees and decide whether to sell shares or redeem the underlying assets.`]],
 [/restak/i,[
  `Restake a supported staking asset worth ${entry}; inspect the underlying validator exposure, slashing conditions and unbonding period first.`,
  `Record the restaking receipt shares and ${p.name} operator or service allocations; verify whether additional delegation exposes the same collateral to more slashing.`,
  `${monitor}: check operator performance, slashing events and receipt-token value. Avoid adding service exposure solely for points.`,
  `At ${days} days, review ${p.name} restaked collateral and start the unbonding queue if exiting; allow the documented delay before redeeming receipt shares.`]],
 [/yield|farm|vault/i,[
  `Deposit a supported stablecoin or required LP asset worth ${entry} into the yield vault; inspect strategy contracts, reward-token exposure and lockups.`,
  `${monitor}: compare ${p.name} vault share price and net yield after fees; claim or compound reward tokens only when the expected proceeds exceed transaction costs.`,
  `At ${days} days, assess the yield strategy's drawdown and redeem vault shares or unstake the LP asset when the withdrawal window permits.`]],
 [/prediction market/i,[
  `Fund a prediction market account with a supported stablecoin worth ${entry}; read market resolution rules, oracle sources and settlement dates.`,
  `Take small outcome-share positions on ${p.name}, risking at most 5% of this stablecoin budget per market; record the thesis, entry odds, size and maximum loss.`,
  `${monitor}: review outcome-share prices and resolution disputes; keep trade and settlement records and avoid increasing stakes to chase losses.`,
  `At ${days} days, sell outcome shares where liquid or retain only positions whose settlement date and resolution risk you accept; redeem resolved ${p.name} positions and log proceeds.`]],
 [/bridge|chain/i,[
  `Transfer a small test amount of a supported stablecoin through ${p.name} on ${chain}; verify the destination network, token contract, bridge route and finality time.`,
  `After confirming receipt of the test stablecoin, transfer the remaining budget up to ${entry}; record source and destination transaction hashes and any wrapped-token exposure.`,
  `${monitor}: reconcile transferred stablecoin balances and pending messages; make another transfer only for a real destination-chain need during the ${days}-day period.`]],
 [/.*/,[
  `Identify ${p.name}'s core ${c} action and supported asset class in its official app before committing ${entry}; skip the workflow if the product or withdrawal path cannot be verified.`,
  `Use a supported stablecoin or the product's required base asset for one small core action within the $${amount} budget; record receipt assets, transaction hashes and withdrawal conditions.`,
  `${monitor}: reconcile ${p.name} base-asset and receipt balances, check product-specific risks and repeat only a useful supported action. Review net results after ${days} days.`]]
 ];
 const workflow=playbooks.find(([pattern])=>pattern.test(c))[1];
 const steps=[
  `Prepare $${amount} for ${p.name} (${c}) on ${chain}. Verify the official app, supported assets, minimums and eligibility. Use a cheaper non-Ethereum chain when listed; stop if checks fail. Setup: 30 minutes including entry.`,
  ...workflow,
  `Budget $${summary.estimated_total_fees_usd.join('–')} total estimated fees for the ${days}-day plan. Gas allowance: $${gas.join('–')} per transaction plus $${fee} service/slippage reserve. Use a ${cadence} paid-action cadence; raise capital until fees fit, and skip actions if actual fees exceed this budget.`,
  `Check ${p.name}'s official rewards and withdrawal terms; record when no campaign exists. After the ${days}-day review, withdraw or redeem the remaining supported assets when allowed, revoke unused approvals and log fees. Never pay to claim or disclose a seed phrase.`
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
