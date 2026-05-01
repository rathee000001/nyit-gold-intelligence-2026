/**
 * Gold Nexus Alpha factor metadata
 *
 * Clean professor-style factor registry used by the Intelligence factor cards.
 * This file intentionally removes the old merge-conflict content and uses the
 * current weekday-clean Gold Nexus Alpha matrix columns.
 */

export type FactorCategory =
  | "Target"
  | "Macro"
  | "Currency"
  | "Risk"
  | "Geopolitics"
  | "Positioning"
  | "Commodities"
  | "Growth";

export type FactorRelevance = "High" | "Medium" | "Low";

export type ImpactDirection = "Direct" | "Inverse" | "Variable";

export type VolatilityProfile = "Low" | "Moderate" | "High" | "Extreme";

export interface FactorDef {
  id: string;
  name: string;
  category: FactorCategory;
  sourceName: string;
  sourceUrl: string;
  description: string;
  mechanism: string;
  frequency: string;
  relevance: FactorRelevance;
  impactDirection?: ImpactDirection;
  relevanceScore?: number;
  volatilityProfile?: VolatilityProfile;
  units?: string;
  inceptionYear?: number;
  mainModelUse?: "Yes" | "No" | "Sensitivity Only";
  professorNote?: string;
}

export const FACTOR_METADATA: Record<string, FactorDef> = {
  gold_price: {
    id: "gold_price",
    name: "Gold Price (USD/oz)",
    category: "Target",
    sourceName: "LBMA / historical gold dataset",
    sourceUrl: "https://www.lbma.org.uk/prices-and-data/precious-metal-prices",
    description:
      "The dependent variable for the forecasting platform: daily gold price measured in U.S. dollars per troy ounce.",
    mechanism:
      "Gold is the target series. Forecasting methods estimate future gold-price behavior using either past gold prices alone or the approved macro, currency, risk, policy, commodity, and positioning factors.",
    frequency: "Daily",
    relevance: "High",
    impactDirection: "Direct",
    relevanceScore: 10,
    volatilityProfile: "Moderate",
    units: "USD/oz",
    inceptionYear: 1968,
    mainModelUse: "Yes",
    professorNote: "Target variable. Do not treat this as an explanatory factor in multivariate models.",
  },

  real_yield: {
    id: "real_yield",
    name: "10Y Real Yield",
    category: "Macro",
    sourceName: "FRED / TIPS",
    sourceUrl: "https://fred.stlouisfed.org/series/DFII10",
    description:
      "10-year Treasury inflation-indexed yield, used as a real-rate proxy for the opportunity cost of holding gold.",
    mechanism:
      "Gold pays no coupon. When real yields rise, interest-bearing safe assets become more attractive and gold often faces pressure. When real yields fall, gold becomes relatively more attractive as a store of value.",
    frequency: "Daily",
    relevance: "High",
    impactDirection: "Inverse",
    relevanceScore: 9.5,
    volatilityProfile: "Moderate",
    units: "Percent",
    inceptionYear: 2003,
    mainModelUse: "Yes",
  },

  nominal_yield: {
    id: "nominal_yield",
    name: "10Y Nominal Yield",
    category: "Macro",
    sourceName: "FRED / DGS10",
    sourceUrl: "https://fred.stlouisfed.org/series/DGS10",
    description:
      "10-year Treasury constant maturity rate, representing the headline long-term U.S. risk-free rate.",
    mechanism:
      "Nominal yields affect discount rates, dollar strength, and fixed-income competition. The gold effect depends on whether yields are rising because of growth, inflation, or monetary tightening.",
    frequency: "Daily",
    relevance: "High",
    impactDirection: "Inverse",
    relevanceScore: 8,
    volatilityProfile: "Low",
    units: "Percent",
    inceptionYear: 1968,
    mainModelUse: "Yes",
  },

  tips_curve: {
    id: "tips_curve",
    name: "TIPS Curve",
    category: "Macro",
    sourceName: "FRED / yield curve series",
    sourceUrl: "https://fred.stlouisfed.org/series/T10Y2Y",
    description:
      "Yield-curve style term-spread signal used to summarize market expectations about growth, inflation, and future policy conditions.",
    mechanism:
      "Curve flattening or inversion can indicate stress or recession expectations. Those regimes may support gold through safe-haven demand and expectations of easier future monetary policy.",
    frequency: "Daily",
    relevance: "Medium",
    impactDirection: "Variable",
    relevanceScore: 7.5,
    volatilityProfile: "Moderate",
    units: "Spread / percentage points",
    inceptionYear: 1997,
    mainModelUse: "Yes",
  },

  fed_bs: {
    id: "fed_bs",
    name: "Federal Reserve Balance Sheet",
    category: "Macro",
    sourceName: "FRED / WALCL",
    sourceUrl: "https://fred.stlouisfed.org/series/WALCL",
    description:
      "Total assets held by the Federal Reserve, used as a liquidity and quantitative-easing proxy.",
    mechanism:
      "Balance-sheet expansion can increase system liquidity and support hard-asset demand. Contraction can tighten liquidity and change the gold price environment.",
    frequency: "Weekly, aligned to daily",
    relevance: "High",
    impactDirection: "Direct",
    relevanceScore: 8.5,
    volatilityProfile: "Low",
    units: "USD millions",
    inceptionYear: 2003,
    mainModelUse: "Yes",
  },

  m2_supply: {
    id: "m2_supply",
    name: "M2 Money Supply",
    category: "Macro",
    sourceName: "FRED / M2SL",
    sourceUrl: "https://fred.stlouisfed.org/series/M2SL",
    description:
      "Broad U.S. money supply, used as a liquidity and currency-base expansion measure.",
    mechanism:
      "Long-run money supply expansion can support nominal hard-asset prices. Gold may benefit when investors see monetary expansion as reducing fiat purchasing power.",
    frequency: "Monthly, aligned to daily",
    relevance: "Medium",
    impactDirection: "Direct",
    relevanceScore: 7,
    volatilityProfile: "Low",
    units: "USD billions",
    inceptionYear: 1968,
    mainModelUse: "Yes",
  },

  inflation: {
    id: "inflation",
    name: "Inflation Expectations",
    category: "Macro",
    sourceName: "FRED / T10YIE",
    sourceUrl: "https://fred.stlouisfed.org/series/T10YIE",
    description:
      "Market-implied 10-year inflation expectation series, used to represent inflation pressure and purchasing-power risk.",
    mechanism:
      "Gold is often used as an inflation and currency-debasement hedge. Rising inflation expectations can support gold, especially if nominal yields do not rise enough to keep real yields high.",
    frequency: "Daily",
    relevance: "High",
    impactDirection: "Direct",
    relevanceScore: 9,
    volatilityProfile: "Moderate",
    units: "Percent",
    inceptionYear: 2003,
    mainModelUse: "Yes",
  },

  usd_index: {
    id: "usd_index",
    name: "U.S. Dollar Index",
    category: "Currency",
    sourceName: "FRED / trade-weighted USD",
    sourceUrl: "https://fred.stlouisfed.org/series/DTWEXBGS",
    description:
      "Broad U.S. dollar index used to capture the currency denominator effect in dollar-priced gold.",
    mechanism:
      "Gold is priced in U.S. dollars. A stronger dollar can make gold more expensive for non-U.S. buyers and can pressure gold prices; dollar weakness often supports gold.",
    frequency: "Daily",
    relevance: "High",
    impactDirection: "Inverse",
    relevanceScore: 9.2,
    volatilityProfile: "Low",
    units: "Index",
    inceptionYear: 1968,
    mainModelUse: "Yes",
  },

  eur_usd: {
    id: "eur_usd",
    name: "EUR/USD Exchange Rate",
    category: "Currency",
    sourceName: "FRED / DEXUSEU",
    sourceUrl: "https://fred.stlouisfed.org/series/DEXUSEU",
    description:
      "Euro-to-U.S.-dollar exchange rate, used as a regional dollar-counterweight and reserve-currency signal.",
    mechanism:
      "Euro strength usually reflects dollar weakness, which can support dollar-denominated gold. The series also helps capture European policy and currency stress regimes.",
    frequency: "Daily",
    relevance: "Medium",
    impactDirection: "Direct",
    relevanceScore: 7.8,
    volatilityProfile: "Moderate",
    units: "Exchange rate",
    inceptionYear: 1999,
    mainModelUse: "Yes",
  },

  jpy_usd: {
    id: "jpy_usd",
    name: "JPY/USD Exchange Rate",
    category: "Currency",
    sourceName: "FRED / DEXJPUS",
    sourceUrl: "https://fred.stlouisfed.org/series/DEXJPUS",
    description:
      "Japanese yen exchange-rate series used to capture global carry-trade and risk-off dynamics.",
    mechanism:
      "Yen movements can indicate global risk appetite and carry-trade stress. During risk-off episodes, currency funding shifts can interact with gold demand and liquidity conditions.",
    frequency: "Daily",
    relevance: "Medium",
    impactDirection: "Variable",
    relevanceScore: 7.2,
    volatilityProfile: "Moderate",
    units: "Exchange rate",
    inceptionYear: 1968,
    mainModelUse: "Yes",
  },

  vix_index: {
    id: "vix_index",
    name: "VIX Index",
    category: "Risk",
    sourceName: "CBOE / FRED VIXCLS",
    sourceUrl: "https://fred.stlouisfed.org/series/VIXCLS",
    description:
      "Equity-market volatility index, commonly interpreted as a market fear gauge.",
    mechanism:
      "Sharp increases in volatility can trigger safe-haven demand. Gold may benefit during systemic risk events, although liquidity stress can also create short-term selling pressure.",
    frequency: "Daily",
    relevance: "Medium",
    impactDirection: "Direct",
    relevanceScore: 8.4,
    volatilityProfile: "High",
    units: "Index",
    inceptionYear: 1990,
    mainModelUse: "Yes",
  },

  high_yield: {
    id: "high_yield",
    name: "High-Yield Spread",
    category: "Risk",
    sourceName: "FRED / BAMLH0A0HYM2",
    sourceUrl: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2",
    description:
      "High-yield corporate bond spread over Treasuries, used as a credit-stress proxy.",
    mechanism:
      "Wider spreads indicate rising credit risk and tightening financial conditions. That can support defensive assets, but this series starts too late in the current dataset for main long-window models.",
    frequency: "Daily",
    relevance: "Medium",
    impactDirection: "Direct",
    relevanceScore: 7.6,
    volatilityProfile: "Moderate",
    units: "Percent",
    inceptionYear: 2023,
    mainModelUse: "Sensitivity Only",
    professorNote:
      "Excluded from main regression, SARIMAX, and XGBoost because the usable history starts around 2023-05-01. Use only for optional short-window sensitivity.",
  },

  fin_stress: {
    id: "fin_stress",
    name: "Financial Stress Index",
    category: "Risk",
    sourceName: "FRED / STLFSI4",
    sourceUrl: "https://fred.stlouisfed.org/series/STLFSI4",
    description:
      "Composite financial-stress index summarizing pressure across interest-rate, spread, volatility, and market components.",
    mechanism:
      "Positive or rising stress can increase safe-haven demand and change liquidity conditions. Gold can respond as investors move from paper risk toward reserve assets.",
    frequency: "Weekly, aligned to daily",
    relevance: "Medium",
    impactDirection: "Direct",
    relevanceScore: 8,
    volatilityProfile: "Moderate",
    units: "Index",
    inceptionYear: 1993,
    mainModelUse: "Yes",
  },

  gpr_index: {
    id: "gpr_index",
    name: "Geopolitical Risk Index",
    category: "Geopolitics",
    sourceName: "Caldara / Iacoviello GPR",
    sourceUrl: "https://www.matteoiacoviello.com/gpr.htm",
    description:
      "Text-based geopolitical risk index measuring war threats, military tensions, terrorism, and conflict-related news pressure.",
    mechanism:
      "Geopolitical shocks can add a safe-haven premium to gold that is not fully explained by yields or currency variables. The official cutoff currently depends on this series availability.",
    frequency: "Monthly, aligned to daily",
    relevance: "High",
    impactDirection: "Direct",
    relevanceScore: 8.8,
    volatilityProfile: "High",
    units: "Index",
    inceptionYear: 1968,
    mainModelUse: "Yes",
  },

  policy_unc: {
    id: "policy_unc",
    name: "Economic Policy Uncertainty",
    category: "Geopolitics",
    sourceName: "Economic Policy Uncertainty Project",
    sourceUrl: "https://www.policyuncertainty.com/",
    description:
      "Policy uncertainty index capturing uncertainty around fiscal, monetary, regulatory, and political-economic decisions.",
    mechanism:
      "Higher uncertainty can support gold demand because investors may seek assets that are less dependent on government policy credibility and future policy clarity.",
    frequency: "Monthly, aligned to daily",
    relevance: "Medium",
    impactDirection: "Direct",
    relevanceScore: 7.4,
    volatilityProfile: "Moderate",
    units: "Index",
    inceptionYear: 1968,
    mainModelUse: "Yes",
    professorNote:
      "Use the current corrected dataset metadata: valid from 1968-01-04 for this project baseline.",
  },

  oil_wti: {
    id: "oil_wti",
    name: "WTI Crude Oil",
    category: "Commodities",
    sourceName: "FRED / DCOILWTICO",
    sourceUrl: "https://fred.stlouisfed.org/series/DCOILWTICO",
    description:
      "West Texas Intermediate crude oil price, used as an energy-cost and inflation-pressure proxy.",
    mechanism:
      "Oil price increases can push inflation expectations higher and influence real yields. Gold can respond through inflation-hedge demand and macro stress channels.",
    frequency: "Daily",
    relevance: "Medium",
    impactDirection: "Direct",
    relevanceScore: 6.8,
    volatilityProfile: "High",
    units: "USD/barrel",
    inceptionYear: 1983,
    mainModelUse: "Yes",
  },

  ppi_index: {
    id: "ppi_index",
    name: "Producer Price Index",
    category: "Commodities",
    sourceName: "FRED / PPIACO",
    sourceUrl: "https://fred.stlouisfed.org/series/PPIACO",
    description:
      "Producer Price Index for commodities, used as a wholesale input-cost and inflation-pressure indicator.",
    mechanism:
      "Rising input costs can lead consumer inflation and affect inflation expectations. Gold may respond as a hedge against future purchasing-power erosion.",
    frequency: "Monthly, aligned to daily",
    relevance: "Medium",
    impactDirection: "Direct",
    relevanceScore: 7.2,
    volatilityProfile: "Low",
    units: "Index",
    inceptionYear: 1968,
    mainModelUse: "Yes",
  },

  gld_tonnes: {
    id: "gld_tonnes",
    name: "GLD ETF Holdings",
    category: "Positioning",
    sourceName: "State Street / SPDR Gold Shares",
    sourceUrl: "https://www.spdrgoldshares.com/usa/historical-data/",
    description:
      "Physical gold tonnes held by the SPDR Gold Trust, used as an institutional gold-positioning proxy.",
    mechanism:
      "ETF holdings reflect investor demand for gold exposure through a large institutional vehicle. Rising holdings can confirm investment demand behind price moves.",
    frequency: "Daily",
    relevance: "High",
    impactDirection: "Direct",
    relevanceScore: 9,
    volatilityProfile: "Moderate",
    units: "Metric tonnes",
    inceptionYear: 2004,
    mainModelUse: "Yes",
  },

  unrate: {
    id: "unrate",
    name: "Unemployment Rate",
    category: "Growth",
    sourceName: "FRED / UNRATE",
    sourceUrl: "https://fred.stlouisfed.org/series/UNRATE",
    description:
      "U.S. civilian unemployment rate, used as a labor-market and policy-cycle indicator.",
    mechanism:
      "Rising unemployment may increase expectations of rate cuts or monetary support, which can reduce real yields and support gold. Strong labor markets can have the opposite effect.",
    frequency: "Monthly, aligned to daily",
    relevance: "Medium",
    impactDirection: "Variable",
    relevanceScore: 6.5,
    volatilityProfile: "Low",
    units: "Percent",
    inceptionYear: 1968,
    mainModelUse: "Yes",
  },

  ind_prod: {
    id: "ind_prod",
    name: "Industrial Production",
    category: "Growth",
    sourceName: "FRED / INDPRO",
    sourceUrl: "https://fred.stlouisfed.org/series/INDPRO",
    description:
      "U.S. industrial production index, used as a real-economy output and cycle indicator.",
    mechanism:
      "Weak production can signal recessionary pressure and safe-haven demand. Strong production can indicate growth conditions that compete with defensive assets.",
    frequency: "Monthly, aligned to daily",
    relevance: "Low",
    impactDirection: "Variable",
    relevanceScore: 6.2,
    volatilityProfile: "Low",
    units: "Index",
    inceptionYear: 1968,
    mainModelUse: "Yes",
  },

  cap_util: {
    id: "cap_util",
    name: "Capacity Utilization",
    category: "Growth",
    sourceName: "FRED / TCU",
    sourceUrl: "https://fred.stlouisfed.org/series/TCU",
    description:
      "Capacity utilization rate, used to measure production slack and bottleneck pressure.",
    mechanism:
      "High utilization can signal supply constraints and inflation pressure. Low utilization can signal weak growth and potential policy easing. Both regimes can affect gold through macro expectations.",
    frequency: "Monthly, aligned to daily",
    relevance: "Low",
    impactDirection: "Variable",
    relevanceScore: 6,
    volatilityProfile: "Low",
    units: "Percent of capacity",
    inceptionYear: 1968,
    mainModelUse: "Yes",
  },
};

export const FACTOR_ORDER = [
  "gold_price",
  "real_yield",
  "nominal_yield",
  "tips_curve",
  "fed_bs",
  "m2_supply",
  "inflation",
  "usd_index",
  "eur_usd",
  "jpy_usd",
  "vix_index",
  "high_yield",
  "fin_stress",
  "gpr_index",
  "policy_unc",
  "oil_wti",
  "ppi_index",
  "gld_tonnes",
  "unrate",
  "ind_prod",
  "cap_util",
] as const;

export const FACTORS: FactorDef[] = FACTOR_ORDER.map(
  (id) => FACTOR_METADATA[id]
).filter(Boolean);

export function getFactorMetadata(id: string): FactorDef | undefined {
  return FACTOR_METADATA[id];
}

export default FACTOR_METADATA;
