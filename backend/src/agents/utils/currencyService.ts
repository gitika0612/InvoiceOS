// Live exchange rate fetcher with 1-hour in-memory cache
// Uses exchangerate-api.com free tier — no API key needed

interface RateCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

// Typed shape of the API response
interface ExchangeRateApiResponse {
  result: string;
  base_code: string;
  rates: Record<string, number>;
}

let cache: RateCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const FALLBACK_RATES: Record<string, number> = {
  USD: 94,
  GBP: 106,
  EUR: 90,
  CAD: 69,
  AUD: 61,
  SGD: 70,
  AED: 26,
};

async function fetchLiveRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/INR", {
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as ExchangeRateApiResponse;

    // data.rates contains { USD: 0.01064, GBP: 0.00943, ... } (value of 1 INR in that currency)
    // We want: how many INR = 1 USD → invert: 1 / 0.01064 = 94
    const inrRates: Record<string, number> = {};
    for (const [currency, rate] of Object.entries(data.rates)) {
      if (rate > 0) {
        inrRates[currency] = Math.round(1 / rate);
      }
    }
    return inrRates;
  } catch (err) {
    console.warn("⚠️ Exchange rate fetch failed, using fallback rates:", err);
    return FALLBACK_RATES;
  }
}

export async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();

  // Return cached rates if still fresh
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }

  const rates = await fetchLiveRates();
  cache = { rates, fetchedAt: now };
  return rates;
}

export async function buildCurrencyContext(): Promise<string> {
  const rates = await getExchangeRates();

  const r = (currency: string): number =>
    rates[currency] ?? FALLBACK_RATES[currency] ?? 0;

  return `$1 USD = ₹${r("USD")} | £1 GBP = ₹${r("GBP")} | €1 EUR = ₹${r(
    "EUR"
  )} | 1 AED = ₹${r("AED")} | 1 SGD = ₹${r("SGD")}`;
}
