/** Snapshot-only valuation. No name-specific scores or external data. */
export interface Protocol {
  slug: string; name: string; category: string | null; chains: string[];
  tvl_usd: number; change_7d: number | null; mcap_usd: number | null;
  listed_at: string | null; gecko_id: string | null; symbol: string | null;
}
export interface Snapshot { as_of: string; floor_usd: number; protocols: Protocol[]; watchlist: string[] }
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const median = (a: number[]) => a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
const key = (p: Protocol) => p.category ?? 'Uncategorized';
export function calibrate(s: Snapshot) {
  const peers = s.protocols.filter(p => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const ratios = peers.map(p => p.mcap_usd! / p.tvl_usd).sort((a,b) => a-b);
  if (!ratios.length) throw Error('No positive live market-cap peers');
  const quantile = (q: number) => { const i = (ratios.length-1)*q; const f = Math.floor(i); return ratios[f]+(ratios[Math.ceil(i)]-ratios[f])*(i-f); };
  const low = quantile(.05), high = quantile(.95);
  const robust = (values: number[]) => median(values.map(x => clamp(x, low, high)).sort((a,b)=>a-b));
  const global = robust(ratios);
  const categories = Object.fromEntries([...new Set(s.protocols.map(key))].sort().map(category => {
    const values = peers.filter(p=>key(p)===category).map(p=>p.mcap_usd!/p.tvl_usd);
    return [category, { multiple: values.length >= 4 ? robust(values) : global, peer_count: values.length, fallback: values.length < 4 }];
  }));
  return { global_multiple: global, global_peer_count: peers.length, winsor_low: low, winsor_high: high, minimum_peers: 4, categories };
}
function plan(p: Protocol, age: number | null) {
  const amount = p.tvl_usd >= 1e9 ? 250 : p.tvl_usd >= 1e8 ? 150 : p.tvl_usd >= 2e7 ? 75 : 40;
  const chain = p.chains[0] ?? 'the supported chain';
  const gas = chain === 'Ethereum' ? '5–20' : '0.10–3';
  const days = age === null ? 30 : age < 180 ? 60 : age < 365 ? 45 : 30;
  const c = key(p).toLowerCase();
  let action = 'inspect the documented product and use its smallest supported deposit or service';
  if (/lend|cdp|collateral/.test(c)) action = 'supply a supported asset; only if borrowing is available, borrow at most 20% of collateral and monitor health daily';
  else if (/dex|liquidity/.test(c)) action = 'split between two supported assets and add liquidity to a liquid pool; inspect range and impermanent-loss exposure';
  else if (/bridge|chain/.test(c)) action = 'bridge a small supported asset transfer to the documented destination, then test a return transfer';
  else if (/stak/.test(c)) action = 'stake the supported native asset after checking validator and withdrawal queue terms';
  else if (/derivative|perpetual|options/.test(c)) action = 'fund margin and test one minimum-size trade at 1x exposure, then close it; avoid leverage';
  else if (/prediction/.test(c)) action = 'fund a supported market and place a position capped at 10% of this budget; inspect settlement rules';
  else if (/yield|vault|curator|allocator|farm/.test(c)) action = 'deposit into a documented vault after checking underlying assets, withdrawal limits and strategy risk';
  else if (/rwa/.test(c)) action = 'check jurisdiction and onboarding eligibility, then subscribe only if the minimum and redemption terms fit this budget';
  else if (/stable|synthetic|basis/.test(c)) action = 'mint or deposit the supported asset after checking collateral, peg and redemption mechanics';
  else if (/governance/.test(c)) action = 'read an active proposal and delegate or vote only if the documented eligibility permits; avoid buying influence just for activity';
  else if (/payments|card/.test(c)) action = 'check jurisdiction and supported payment rails, then make one useful small payment only if eligible; do not leave idle funds on a card account';
  else if (/insurance/.test(c)) action = 'quote and buy only useful cover after reading exclusions and claim conditions';
  return [
    `Prepare a $${amount} maximum capital budget for ${p.name} on ${chain}. Verify its official app independently and test the smallest transfer. Cost: $${gas} gas allowance, not a live quote. Time: 10 minutes.`,
    `With up to $${amount} on ${p.name}, ${action}. If unsupported or above the minimum, skip. Cost: $${gas} gas plus up to $${Math.ceil(amount*.01)} fees/slippage allowance. Time: 20 minutes.`,
    `Weekly: review the $${amount} position and repeat one useful supported action, or vote if eligible; do not manufacture volume. Cost: $${gas} gas per week, plus applicable service fees. Time: 10 minutes weekly.`,
    `Review the $${amount} position for ${days} days (${age === null ? 'listing age unknown' : age+' days since listing'}). For trading or bridges, retain records instead of forcing an open position. Cost: $0 gas while idle; capital and market risk remain. Time: ${days} days, 5 minutes per review.`,
    `Check ${p.name}'s official points/rewards page for the $${amount} activity budget; if none exists, record that. Never pay to claim or disclose a seed phrase; gas only for a verified transaction. Cost: $0 to check. Time: 5 minutes weekly.`,
    `Exit the up-to-$${amount} position: repay debt first, withdraw or redeem when allowed, revoke unused approvals and log transaction IDs, fees and results. Cost: reserve $${gas} gas plus documented exit fees. Time: 15 minutes; queues may add days.`
  ];
}
export function buildRadar(s: Snapshot) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.as_of) || !Number.isFinite(Date.parse(s.as_of)) || !Number.isFinite(s.floor_usd) || s.floor_usd <= 0 || !Array.isArray(s.protocols) || !Array.isArray(s.watchlist)) throw Error('Invalid snapshot metadata');
  const slugs = new Set<string>();
  for (const p of s.protocols) {
    if (!p || typeof p.slug !== 'string' || typeof p.name !== 'string' || !Number.isFinite(p.tvl_usd) || p.tvl_usd <= 0 || !Array.isArray(p.chains) || p.chains.some(c=>typeof c !== 'string') || (p.change_7d !== null && !Number.isFinite(p.change_7d)) || (p.mcap_usd !== null && !Number.isFinite(p.mcap_usd))) throw Error('Invalid protocol record');
    if (slugs.has(p.slug)) throw Error('Duplicate protocol: '+p.slug);
    slugs.add(p.slug);
  }
  if (new Set(s.watchlist).size !== s.watchlist.length) throw Error('Duplicate watchlist slug');
  const calibration = calibrate(s);
  const score = (p: Protocol) => {
    const parsed = p.listed_at ? Date.parse(p.listed_at+'T00:00:00Z') : NaN;
    const age = Number.isFinite(parsed) ? Math.max(0,Math.floor((Date.parse(s.as_of+'T00:00:00Z')-parsed)/86400000)) : null;
    const cat = calibration.categories[key(p)];
    const growth = clamp(p.change_7d ?? 0,-60,120);
    const gf = 1 + growth/200, mf = .6 + .4*Math.min(age ?? 365,1095)/1095;
    const base = p.tvl_usd*cat.multiple;
    return { ...p, token_status: 'pre-token', watchlist: s.watchlist.includes(p.slug), age_days: age,
      implied_value_usd: Math.max(1,Math.round(base*gf*mf)),
      model: { base_usd: base, base_multiple: cat.multiple, peer_count: cat.peer_count, calibration_peer_count: cat.fallback ? calibration.global_peer_count : cat.peer_count, fallback: cat.fallback, growth_pct: growth, growth_multiplier: gf, maturity_multiplier: mf },
      why: `$${p.tvl_usd.toLocaleString('en-US')} TVL × ${cat.multiple.toFixed(3)}x ${cat.fallback ? 'global fallback' : key(p)+' peers'}; ${p.change_7d === null ? 'unknown' : p.change_7d.toFixed(2)+'%'} weekly growth; ${age === null ? 'unknown listing age (365-day assumption)' : age+' days listed'}.`,
      farm_steps: plan(p,age) };
  };
  const eligible = (p: Protocol) => p.mcap_usd === null && p.gecko_id === null && p.symbol === null && p.category !== 'CEX' && !/\s(v\d+(\.\d+)?|\d+\.\d+)$/i.test(p.name);
  const compare = (a: ReturnType<typeof score>, b: ReturnType<typeof score>) => b.implied_value_usd-a.implied_value_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
  const required = s.watchlist.map(slug => { const p = s.protocols.find(p=>p.slug===slug); if (!p || !eligible(p)) throw Error('Invalid watchlist record: '+slug); return score(p); });
  const early = s.protocols.filter(p=>eligible(p) && p.tvl_usd < s.floor_usd && !s.watchlist.includes(p.slug)).map(score).sort(compare).slice(0,Math.max(0,240-required.length));
  const rows = [...required,...early].sort(compare).map((p,i)=>({...p,rank:i+1}));
  const live = s.protocols.filter(p=>p.mcap_usd !== null).sort((a,b)=>b.mcap_usd!-a.mcap_usd!);
  return { as_of:s.as_of, floor_usd:s.floor_usd, watchlist_size:s.watchlist.length, calibration, rows, live };
}
