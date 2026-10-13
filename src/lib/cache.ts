/**
 * WAVEO — cache em memória com partilha de pedidos em curso.
 *
 * Duas responsabilidades:
 *
 *  1. **Reduzir pedidos aos fornecedores.** O plano gratuito do Open-Meteo
 *     permite 10 000 pedidos por dia. Com uma cache de 15 minutos e pedidos
 *     multi-ponto (todos os spots numa só chamada), o consumo diário fica
 *     muito abaixo disso.
 *  2. **Servir dados obsoletos em vez de nada.** Se um fornecedor estiver
 *     temporariamente em baixo, preferimos mostrar a última previsão conhecida
 *     — claramente marcada como desatualizada — a mostrar um ecrã vazio.
 *
 * A cache vive no processo do servidor. Em ambiente serverless, cada instância
 * tem a sua; é uma otimização, não uma garantia.
 */

interface Entry<T> {
  value: T;
  storedAt: number;
  expiresAt: number;
}

/** Quanto tempo além do TTL aceitamos servir dados obsoletos. */
const STALE_GRACE_MS = 6 * 60 * 60 * 1000;

export interface CacheLookup<T> {
  value: T;
  /** `true` quando o valor já passou o TTL mas ainda está dentro da tolerância. */
  stale: boolean;
  ageMs: number;
}

export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly maxEntries: number;

  constructor(maxEntries = 200) {
    this.maxEntries = maxEntries;
  }

  /** Lê um valor válido (dentro do TTL). */
  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) return null;
    return entry.value;
  }

  /**
   * Lê um valor mesmo que já tenha expirado, desde que dentro da tolerância.
   * Usado como rede de segurança quando o fornecedor falha.
   */
  getStale(key: string): CacheLookup<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    const ageMs = Date.now() - entry.storedAt;
    if (ageMs > entry.expiresAt - entry.storedAt + STALE_GRACE_MS) {
      this.entries.delete(key);
      return null;
    }
    return { value: entry.value, stale: Date.now() > entry.expiresAt, ageMs };
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.entries.size >= this.maxEntries) {
      // Evicção simples do mais antigo.
      const oldest = [...this.entries.entries()].sort(
        (a, b) => a[1].storedAt - b[1].storedAt,
      )[0];
      if (oldest) this.entries.delete(oldest[0]);
    }
    const now = Date.now();
    this.entries.set(key, {
      value,
      storedAt: now,
      expiresAt: now + ttlMs,
    });
  }

  /**
   * Devolve o valor em cache ou executa `producer`, garantindo que pedidos
   * concorrentes para a mesma chave partilham uma única execução.
   */
  async resolve(key: string, ttlMs: number, producer: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = producer()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  /** Marca explicitamente uma chave como inválida. */
  invalidate(key: string): void {
    this.entries.delete(key);
  }

  /** Esvazia a cache (usado em testes). */
  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

/** TTL configurado por ambiente, com um valor por omissão sensato. */
export function configuredTtlMs(): number {
  const raw = process.env.WAVEO_CACHE_TTL_SECONDS;
  const parsed = raw ? Number(raw) : Number.NaN;
  const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : 900;
  return seconds * 1000;
}

/** Tempo limite por pedido a fornecedores, configurável por ambiente. */
export function configuredTimeoutMs(): number {
  const raw = process.env.WAVEO_PROVIDER_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
}

/** Número de dias de previsão a pedir, limitado ao que os fornecedores aceitam. */
export function configuredForecastDays(): number {
  const raw = process.env.WAVEO_FORECAST_DAYS;
  const parsed = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed)) return 7;
  return Math.min(16, Math.max(1, Math.round(parsed)));
}

/** Se os dados de demonstração podem ser usados quando tudo o resto falha. */
export function demoDataEnabled(): boolean {
  const raw = process.env.WAVEO_ENABLE_DEMO_DATA;
  if (raw === undefined || raw === "") return true;
  return !["false", "0", "no"].includes(raw.trim().toLowerCase());
}
