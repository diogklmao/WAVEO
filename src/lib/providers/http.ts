/**
 * WAVEO — cliente HTTP para fornecedores de dados.
 *
 * Todos os pedidos externos passam por aqui para garantir um comportamento
 * uniforme em caso de falha:
 *
 *  - tempo limite explícito, para que um fornecedor lento não bloqueie a
 *    resposta ao utilizador;
 *  - número limitado de tentativas, apenas para erros transitórios;
 *  - erros normalizados em `ApiError`, com um código que a interface sabe
 *    traduzir;
 *  - respeito pelo cabeçalho `Retry-After` em respostas 429.
 *
 * Nenhuma chave de API é colocada em URLs no cliente: quando um fornecedor
 * exigir credenciais, estas são lidas de variáveis de ambiente apenas no
 * servidor.
 */

import type { ApiError } from "../types";

export type ApiErrorCode = ApiError["code"];

export class ProviderError extends Error {
  readonly code: ApiErrorCode;
  readonly detail?: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly providerId: string;

  constructor(
    providerId: string,
    code: ApiErrorCode,
    message: string,
    options: { detail?: string; retryable?: boolean; status?: number } = {},
  ) {
    super(message);
    this.name = "ProviderError";
    this.providerId = providerId;
    this.code = code;
    this.detail = options.detail;
    this.retryable = options.retryable ?? true;
    this.status = options.status;
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      detail: this.detail,
      retryable: this.retryable,
    };
  }
}

export interface FetchJsonOptions {
  providerId: string;
  timeoutMs: number;
  retries?: number;
  /** Cabeçalhos adicionais (ex.: chave de API num fornecedor autenticado). */
  headers?: Record<string, string>;
  /** Sinal externo para cancelar (ex.: o cliente cancelou o pedido). */
  signal?: AbortSignal;
}

const DEFAULT_RETRIES = 1;
const BASE_BACKOFF_MS = 400;

/**
 * Obtém e analisa JSON de um fornecedor, com tempo limite e tentativas.
 * Lança sempre `ProviderError` em caso de falha — nunca deixa escapar um
 * `TypeError` de rede nem um erro de `JSON.parse`.
 */
export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions,
): Promise<T> {
  const { providerId, timeoutMs, retries = DEFAULT_RETRIES, headers, signal } = options;

  let lastError: ProviderError | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) {
      await delay(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    }

    try {
      return await attemptFetch<T>(url, { providerId, timeoutMs, headers, signal });
    } catch (error) {
      const providerError =
        error instanceof ProviderError
          ? error
          : new ProviderError(providerId, "desconhecido", "Erro inesperado.", {
              detail: error instanceof Error ? error.message : String(error),
            });

      lastError = providerError;

      // Não vale a pena insistir quando o pedido em si está errado ou quando
      // o fornecedor nos está a limitar.
      if (
        !providerError.retryable ||
        providerError.code === "limite_de_pedidos" ||
        providerError.code === "fora_de_cobertura"
      ) {
        break;
      }

      // Se o utilizador cancelou, não repetimos.
      if (signal?.aborted) break;
    }
  }

  throw lastError ??
    new ProviderError(providerId, "desconhecido", "Falha ao contactar o fornecedor.");
}

async function attemptFetch<T>(
  url: string,
  options: {
    providerId: string;
    timeoutMs: number;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  },
): Promise<T> {
  const { providerId, timeoutMs, headers, signal } = options;

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  const compositeSignal = anySignal([timeoutController.signal, signal]);

  // O temporizador só é cancelado depois de o corpo ter sido lido: um
  // fornecedor que responde com cabeçalhos e depois deixa o corpo pendurado
  // bloquearia a página indefinidamente se o tempo limite terminasse no
  // momento em que a resposta chega.
  try {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...headers,
        },
        signal: compositeSignal,
        cache: "no-store",
      });
    } catch (error) {
      if (timeoutController.signal.aborted) {
        throw new ProviderError(
          providerId,
          "tempo_limite",
          `O fornecedor não respondeu em ${Math.round(timeoutMs / 1000)} segundos.`,
          { retryable: true },
        );
      }
      if (signal?.aborted) {
        throw new ProviderError(providerId, "desconhecido", "Pedido cancelado.", {
          retryable: false,
        });
      }
      throw new ProviderError(
        providerId,
        "fornecedor_indisponivel",
        "Não foi possível contactar o fornecedor. Verifique a ligação à Internet.",
        {
          detail: error instanceof Error ? error.message : String(error),
          retryable: true,
        },
      );
    }

    if (!response.ok) {
      throw await toProviderError(providerId, response);
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      // Um corpo interrompido pelo tempo limite não é uma resposta inválida:
      // é um fornecedor lento, e o código de erro tem de o dizer.
      if (timeoutController.signal.aborted) {
        throw new ProviderError(
          providerId,
          "tempo_limite",
          `O fornecedor não terminou a resposta em ${Math.round(timeoutMs / 1000)} segundos.`,
          { retryable: true },
        );
      }
      throw new ProviderError(
        providerId,
        "resposta_invalida",
        "O fornecedor devolveu uma resposta que não foi possível interpretar.",
        {
          detail: error instanceof Error ? error.message : String(error),
          retryable: false,
        },
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

async function toProviderError(
  providerId: string,
  response: Response,
): Promise<ProviderError> {
  let reason = "";
  try {
    const body = (await response.json()) as { reason?: string; error?: boolean };
    reason = body?.reason ?? "";
  } catch {
    // Corpo não-JSON: ficamos com o código de estado.
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    return new ProviderError(
      providerId,
      "limite_de_pedidos",
      "O fornecedor recusou o pedido por excesso de utilização. Tente novamente mais tarde.",
      {
        detail: retryAfter ? `Retry-After: ${retryAfter}` : reason || undefined,
        retryable: false,
        status: 429,
      },
    );
  }

  if (response.status === 400) {
    // O Open-Meteo devolve 400 com um motivo quando as coordenadas estão fora
    // da grelha do modelo ou quando uma variável não existe para o domínio.
    const looksOutOfCoverage = /out of|bound|no data|not available/i.test(reason);
    return new ProviderError(
      providerId,
      looksOutOfCoverage ? "fora_de_cobertura" : "resposta_invalida",
      looksOutOfCoverage
        ? "O fornecedor não tem dados para este ponto ou para esta variável."
        : "O fornecedor rejeitou o pedido.",
      { detail: reason || undefined, retryable: false, status: 400 },
    );
  }

  return new ProviderError(
    providerId,
    "fornecedor_indisponivel",
    `O fornecedor respondeu com o estado ${response.status}.`,
    {
      detail: reason || undefined,
      retryable: response.status >= 500,
      status: response.status,
    },
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Combina vários `AbortSignal` num só. `AbortSignal.any` existe em runtimes
 * recentes, mas mantemos uma alternativa para não depender disso.
 */
function anySignal(signals: (AbortSignal | undefined)[]): AbortSignal {
  const usable = signals.filter((s): s is AbortSignal => Boolean(s));
  if (usable.length === 1) return usable[0]!;

  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(usable);
  }

  const controller = new AbortController();
  for (const signal of usable) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

/**
 * Converte valores devolvidos por APIs externas em `number | null`.
 * Trata `null`, `undefined`, strings vazias e `NaN` como ausência de dado —
 * nunca como zero, que seria uma informação falsa.
 */
export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Converte valores booleanos externos (0/1/true/"true") em `boolean | null`. */
export function toNullableBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "true" || lower === "1") return true;
    if (lower === "false" || lower === "0") return false;
  }
  return null;
}

/** Extrai um array de uma resposta, devolvendo `[]` se não existir. */
export function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
