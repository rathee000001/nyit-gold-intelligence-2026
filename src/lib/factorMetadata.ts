/**
 * ============================================================================================================================================================
 * MODULE: MODEL 3 FACTOR METADATA (DAILY INTELLIGENCE REGISTRY)
 * ============================================================================================================================================================
 * ID:              0xMETA_MODEL3_V3_DAILY_ENRICHED
 * PURPOSE:         Centralized Daily registry for 21 Active Model 3 Factors.
 * UPGRADE:         Enriched with Impact Direction, Relevance, and Volatility metadata.
 * THEME:           NYIT Laboratory Institutional Standards.
 * ============================================================================================================================================================
 */

export interface FactorDefinition {
  id: string;
  label: string;
  category: 'Target' | 'Macro' | 'Currency' | 'Risk' | 'Commodity' | 'Econ';
  inceptionYear: number; 
  frequency: 'Daily' | 'Monthly' | 'Quarterly' | 'Weekly' | 'Annual';
  source: 'FRED' | 'Bloomberg' | 'World Gold Council' | 'LBMA' | 'CBOE' | 'NYMEX' | 'COMEX' | 'BLS' | 'Treasury' | 'State Street' | 'Kaggle';
  sourceUrl: string; 
  units: string;
  impactDirection: 'Direct' | 'Inverse' | 'Variable';
  relevanceScore: number; // 1-10 (Institutional Weighting)
  volatilityProfile: 'Low' | 'Moderate' | 'High' | 'Extreme';
  description: string;
  mechanism: string; 
}

export const FACTOR_METADATA: Record<string, FactorDefinition> = {
  
  // --- TARGET VARIABLE (The "Y" Variable) ---
  gold_spot: {
    id: 'gold_spot',
    label: 'Gold Price (USD/oz)',
    category: 'Target',
    inceptionYear: 1968,
    frequency: 'Daily',
    source: 'LBMA',
    sourceUrl: 'https://www.lbma.org.uk/prices-and-data/precious-metal-prices',
    units: 'USD/oz',
    impactDirection: 'Direct',
    relevanceScore: 10,
    volatilityProfile: 'Moderate',
    description: 'The primary dependent variable for Model 3. Merged Daily High-Fidelity dataset spanning 1968-2026.',
    mechanism: 'Price discovery based on LBMA PM Fix (Legacy) and Exchange Highs (Modern). Acts as the neural target for regression analysis.'
  },

  // --- MACRO VARIABLES ---
  real_yield: {
    id: 'real_yield',
    label: '10Y Real Yield',
    category: 'Macro',
    inceptionYear: 1968,
    frequency: 'Daily',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/DFII10',
    units: 'Percentage',
    impactDirection: 'Inverse',
    relevanceScore: 9.5,
    volatilityProfile: 'Moderate',
    description: '10-Year Treasury Inflation-Indexed Security (TIPS) yield.',
    mechanism: 'The "Prime Inverse Anchor." As real yields rise, the opportunity cost of holding non-yielding gold increases, typically forcing prices lower.'
  },
  nominal_yield: {
    id: 'nominal_yield',
    label: '10Y Nominal Yield',
    category: 'Macro',
    inceptionYear: 1968,
    frequency: 'Daily',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/DGS10',
    units: 'Percentage',
    impactDirection: 'Inverse',
    relevanceScore: 8.0,
    volatilityProfile: 'Low',
    description: '10-Year Treasury Constant Maturity Rate.',
    mechanism: 'Benchmark for global risk-free rates. Directly influences USD strength and capital flow from hard assets to fixed income.'
  },
  tips_curve: {
    id: 'tips_curve',
    label: 'TIPS Curve (10Y-2Y)',
    category: 'Macro',
    inceptionYear: 1997, 
    frequency: 'Daily',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/T10Y2Y',
    units: 'Basis Points',
    impactDirection: 'Variable',
    relevanceScore: 7.5,
    volatilityProfile: 'Moderate',
    description: 'Yield spread between 10-year and 2-year real yields.',
    mechanism: 'Slope indicator for economic expectations. Inversions often signal systemic shifts that drive safe-haven demand.'
  },
  fed_bs: {
    id: 'fed_bs',
    label: 'Fed Balance Sheet',
    category: 'Macro',
    inceptionYear: 2003, 
    frequency: 'Weekly',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/WALCL',
    units: 'USD Millions',
    impactDirection: 'Direct',
    relevanceScore: 8.5,
    volatilityProfile: 'Low',
    description: 'Total Assets held by the Federal Reserve.',
    mechanism: 'Monetary base expansion proxy. Large-scale asset purchases (QE) are historically correlated with gold debasement hedges.'
  },
  m2_supply: {
    id: 'm2_supply',
    label: 'M2 Money Supply',
    category: 'Macro',
    inceptionYear: 1968,
    frequency: 'Monthly',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/M2SL',
    units: 'USD Billions',
    impactDirection: 'Direct',
    relevanceScore: 7.0,
    volatilityProfile: 'Low',
    description: 'The broad measure of USD liquidity in the economy.',
    mechanism: 'Inflationary "tide" indicator. A larger supply of currency typically leads to a nominal rise in hard asset valuations over time.'
  },
  inflation: {
    id: 'inflation',
    label: 'CPI Breakeven',
    category: 'Macro',
    inceptionYear: 1968,
    frequency: 'Daily',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/T10YIE',
    units: 'Percentage',
    impactDirection: 'Direct',
    relevanceScore: 9.0,
    volatilityProfile: 'Moderate',
    description: 'Market-based expectation of average inflation over 10 years.',
    mechanism: 'Primary driver of real yield calculations. Rising inflation expectations increase gold’s appeal as a purchasing power hedge.'
  },

  // --- CURRENCY VARIABLES ---
  usd_index: {
    id: 'usd_index',
    label: 'DXY Dollar Index',
    category: 'Currency',
    inceptionYear: 1968,
    frequency: 'Daily',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/DTWEXBGS',
    units: 'Index Point',
    impactDirection: 'Inverse',
    relevanceScore: 9.2,
    volatilityProfile: 'Low',
    description: 'Broad trade-weighted U.S. Dollar index.',
    mechanism: 'Currency Denominator. Since gold is USD-denominated, a stronger DXY makes gold more expensive for foreign holders, suppressing demand.'
  },
  eur_usd: {
    id: 'eur_usd',
    label: 'Euro / USD',
    category: 'Currency',
    inceptionYear: 1999, 
    frequency: 'Daily',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/DEXUSEU',
    units: 'Exchange Rate',
    impactDirection: 'Direct',
    relevanceScore: 7.8,
    volatilityProfile: 'Moderate',
    description: 'Spot exchange rate of Euro to USD.',
    mechanism: 'Counter-weight to the Dollar. Strength here reflects a shift out of the USD reserve, often benefitting hard assets.'
  },
  jpy_usd: {
    id: 'jpy_usd',
    label: 'Yen / USD',
    category: 'Currency',
    inceptionYear: 1968,
    frequency: 'Daily',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/DEXJPUS',
    units: 'Exchange Rate',
    impactDirection: 'Variable',
    relevanceScore: 7.2,
    volatilityProfile: 'Moderate',
    description: 'Spot exchange rate of Japanese Yen to USD.',
    mechanism: 'Liquidity funding currency. Reflects carry-trade status and global risk-on/risk-off positioning.'
  },

  // --- RISK VARIABLES ---
  vix_index: {
    id: 'vix_index',
    label: 'VIX Index',
    category: 'Risk',
    inceptionYear: 1990, 
    frequency: 'Daily',
    source: 'CBOE',
    sourceUrl: 'https://fred.stlouisfed.org/series/VIXCLS',
    units: 'Volatility Index',
    impactDirection: 'Direct',
    relevanceScore: 8.4,
    volatilityProfile: 'High',
    description: 'Market volatility "Fear Gauge."',
    mechanism: 'Tactical Risk Proxy. Extreme spikes in VIX typically correspond with safe-haven rotations into physical gold and liquidity.'
  },
  high_yield: {
    id: 'high_yield',
    label: 'High Yield Spread',
    category: 'Risk',
    inceptionYear: 1986, 
    frequency: 'Daily',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2',
    units: 'Percentage',
    impactDirection: 'Direct',
    relevanceScore: 7.6,
    volatilityProfile: 'Moderate',
    description: 'Spread between high-yield corporate bonds and Treasuries.',
    mechanism: 'Credit Stress Indicator. Rising spreads signal deteriorating liquidity and economic health, favoring defensive assets.'
  },
  fin_stress: {
    id: 'fin_stress',
    label: 'Fin Stress Index',
    category: 'Risk',
    inceptionYear: 1993, 
    frequency: 'Weekly',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/STLFSI4',
    units: 'Index Point',
    impactDirection: 'Direct',
    relevanceScore: 8.0,
    volatilityProfile: 'Moderate',
    description: 'Composite St. Louis Fed Stress Index.',
    mechanism: 'Systemic risk aggregator. Captures strain across 18 market data points including interest rates and yield spreads.'
  },
  gpr_index: {
    id: 'gpr_index',
    label: 'Geopolitical Risk',
    category: 'Risk',
    inceptionYear: 1968, 
    frequency: 'Monthly',
    source: 'Bloomberg',
    sourceUrl: 'https://www.matteoiacoviello.com/gpr.htm',
    units: 'Index Point',
    impactDirection: 'Direct',
    relevanceScore: 8.8,
    volatilityProfile: 'High',
    description: 'Iacoviello/Caldara Geopolitical Risk Index.',
    mechanism: 'War and Conflict Proxy. Quantifies threats using news-cycle text mining. High scores trigger "Safe Haven" price premiums.'
  },
  policy_unc: {
    id: 'policy_unc',
    label: 'Policy Uncertainty',
    category: 'Risk',
    inceptionYear: 1968, 
    frequency: 'Monthly',
    source: 'Bloomberg',
    sourceUrl: 'https://www.policyuncertainty.com/',
    units: 'Index Point',
    impactDirection: 'Direct',
    relevanceScore: 7.4,
    volatilityProfile: 'Moderate',
    description: 'Economic Policy Uncertainty Index.',
    mechanism: 'Confusion Premium. Measures uncertainty regarding fiscal and monetary policy shifts, often supporting gold as a hedge.'
  },

  // --- COMMODITY VARIABLES ---
  oil_wti: {
    id: 'oil_wti',
    label: 'WTI Crude Oil',
    category: 'Commodity',
    inceptionYear: 1983, 
    frequency: 'Daily',
    source: 'NYMEX',
    sourceUrl: 'https://fred.stlouisfed.org/series/DCOILWTICO',
    units: 'USD/Barrel',
    impactDirection: 'Direct',
    relevanceScore: 6.8,
    volatilityProfile: 'High',
    description: 'West Texas Intermediate crude oil spot price.',
    mechanism: 'Energy Input Inflation. Rising oil prices increase the PPI and feed into longer-term CPI expectations.'
  },
  ppi_index: {
    id: 'ppi_index',
    label: 'PPI Index',
    category: 'Commodity',
    inceptionYear: 1968,
    frequency: 'Monthly',
    source: 'BLS',
    sourceUrl: 'https://fred.stlouisfed.org/series/PPIACO',
    units: 'Index 1982=100',
    impactDirection: 'Direct',
    relevanceScore: 7.2,
    volatilityProfile: 'Low',
    description: 'Producer Price Index for all commodities.',
    mechanism: 'Wholesale Inflation Proxy. Leading indicator for consumer prices and a core component of commodity-cycle modeling.'
  },
  gld_tonnes: {
    id: 'gld_tonnes',
    label: 'GLD ETF Tonnes',
    category: 'Commodity',
    inceptionYear: 2004, 
    frequency: 'Daily',
    source: 'State Street',
    sourceUrl: 'https://www.spdrgoldshares.com/usa/historical-data/',
    units: 'Metric Tonnes',
    impactDirection: 'Direct',
    relevanceScore: 9.0,
    volatilityProfile: 'Moderate',
    description: 'Physical holdings of the SPDR Gold Trust.',
    mechanism: 'Investment Demand Proxy. Reflects the flow of western institutional capital into physical metal via the equity market.'
  },

  // --- ECON VARIABLES ---
  unrate: {
    id: 'unrate',
    label: 'Unemployment Rate',
    category: 'Econ',
    inceptionYear: 1968,
    frequency: 'Monthly',
    source: 'BLS',
    sourceUrl: 'https://fred.stlouisfed.org/series/UNRATE',
    units: 'Percentage',
    impactDirection: 'Variable',
    relevanceScore: 6.5,
    volatilityProfile: 'Low',
    description: 'U.S. Civilian Unemployment Rate.',
    mechanism: 'Economic Health Lag. Influences Federal Reserve "Pivot" timing; high unemployment often leads to lower rates and higher gold.'
  },
  ind_prod: {
    id: 'ind_prod',
    label: 'Industrial Prod',
    category: 'Econ',
    inceptionYear: 1968,
    frequency: 'Monthly',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/INDPRO',
    units: 'Index 2017=100',
    impactDirection: 'Variable',
    relevanceScore: 6.2,
    volatilityProfile: 'Low',
    description: 'Total Industrial Production Index.',
    mechanism: 'Real Output Measure. Declining industrial production signals economic contraction, increasing gold’s safe-haven appeal.'
  },
  cap_util: {
    id: 'cap_util',
    label: 'Capacity Util',
    category: 'Econ',
    inceptionYear: 1968,
    frequency: 'Monthly',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/series/TCU',
    units: 'Percentage of Capacity',
    impactDirection: 'Inverse',
    relevanceScore: 6.0,
    volatilityProfile: 'Low',
    description: 'Percentage of total manufacturing capacity used.',
    mechanism: 'Slack Indicator. High capacity utilization creates inflationary bottlenecking, impacting commodity price cycles.'
  }
};