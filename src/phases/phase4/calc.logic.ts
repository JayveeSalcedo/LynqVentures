/** Pure ports of the legacy Launch calculators. Inputs are the raw strings of the legacy fields. */
type Inputs = Record<string, unknown>;
const value = (inputs: Inputs, id: string) => typeof inputs[id] === 'string' ? inputs[id] as string : '';

/** Lesson 66 `calculate66`: contribution per unit, contribution / price and units to cover fixed cost. */
export function calculate66(inputs: Inputs): string {
  const raw = ['calcPrice66', 'calcCost66', 'calcFixed66'].map(id => value(inputs, id).trim());
  const [price, cost, fixed] = raw.map(Number);
  if (!value(inputs, 'calcUnit66').trim() || raw.some(v => v === '') || [price, cost, fixed].some(v => !Number.isFinite(v) || v < 0))
    return 'Enter unit/currency/period and finite nonnegative inputs; missing values are not zero.';
  const contribution = price - cost, margin = price > 0 ? contribution / price * 100 : null, units = contribution > 0 ? Math.ceil(fixed / contribution) : null;
  if (!Number.isFinite(contribution) || (margin !== null && !Number.isFinite(margin)) || (units !== null && !Number.isSafeInteger(units)))
    return 'Scenario exceeds supported numeric range; use smaller inputs and compatible units.';
  return 'Hypothetical only: contribution per unit ' + contribution.toFixed(2) + '; contribution / price ' + (margin === null ? 'undefined at zero price' : margin.toFixed(2) + '%') + '; units to cover stated fixed cost ' + (units === null ? 'not achievable with nonpositive contribution' : units) + '. Before excluded costs; not net profit, forecast, demand or price approval.';
}

/** Lesson 73 `calculateRate73`: activation, meaningful usage participation and within-window repeat share. */
export function calculateRate73(inputs: Inputs): string {
  const raw = ['rateEligible73', 'rateActivated73', 'rateActive73', 'rateRepeat73'].map(id => value(inputs, id).trim());
  const [eligible, activated, active, repeat] = raw.map(Number);
  if (!value(inputs, 'rateContext73').trim() || raw.some(v => v === '') || [eligible, activated, active, repeat].some(v => !Number.isSafeInteger(v) || v < 0))
    return 'Enter context and finite nonnegative whole counts; missing data is not zero.';
  if (activated > eligible || active > eligible || repeat > active)
    return 'Incompatible subsets: activated/active cannot exceed eligible; repeat cannot exceed active.';
  const rate = (n: number, d: number) => d === 0 ? 'undefined (zero denominator)' : (n / d * 100).toFixed(2) + '%';
  return 'Scenario only: activation ' + rate(activated, eligible) + '; meaningful usage participation ' + rate(active, eligible) + '; within-window repeat share ' + rate(repeat, active) + '. Same compatible cohort/window required; repeat share is not retention. No source, behavior, causal improvement or traction verified.';
}

export const reviewIds76 = ['reviewContext76', 'reviewRevenue76', 'reviewDirect76', 'reviewOpex76', 'reviewOpening76', 'reviewReceipts76', 'reviewFunding76', 'reviewPayments76'];
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Lesson 76 `calculateReview76`: gross/operating subtotals and the closing cash bridge. */
export function calculateReview76(inputs: Inputs): string {
  if (!value(inputs, 'reviewContext76').trim()) return 'Enter currency, exact period and scenario/source limits.';
  const nums = reviewIds76.slice(1).map(id => value(inputs, id));
  if (nums.some(v => v.trim() === '' || !Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 1e12))
    return 'Enter every amount explicitly: finite non-negative values up to 1 trillion. Blank is unknown; zero must be entered.';
  const [R, D, O, B, C, F, P] = nums.map(Number), gross = R - D, operating = gross - O, closing = B + C + F - P;
  return 'Illustrative scenario only — ' + value(inputs, 'reviewContext76') + ' · Gross subtotal: ' + fmt(gross) + ' · Gross margin: ' + (R === 0 ? 'undefined (zero net revenue)' : fmt(gross / R * 100) + '%') + ' · Operating subtotal: ' + fmt(operating) + ' (not net profit) · Closing cash bridge: ' + fmt(closing) + (closing < 0 ? ' · Negative closing cash: funding/timing gap requires review.' : '') + ' · No source, accounting classification or cash availability verified.';
}

export const calculators: Record<string, (inputs: Inputs) => string> = { calc66: calculate66, rate73: calculateRate73, review76: calculateReview76 };
