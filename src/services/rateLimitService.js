/**
 * Rate Limiting Service — UniBrik
 *
 * Client-side sliding window rate limiter to protect Firebase quota
 * from abuse and excessive requests. This is NOT a replacement for
 * server-side rate limiting (e.g., Firebase App Check or Cloud Functions),
 * but it prevents accidental overuse and deters simple bot attacks.
 */

// ── Rate limit configurations ─────────────────────────────────────
const RATE_LIMITS = {
  sendMessage: { maxRequests: 10, windowSeconds: 60, label: 'enviar mensagens' },
  createProduct: { maxRequests: 3, windowSeconds: 300, label: 'criar anúncios' },
  updateProduct: { maxRequests: 5, windowSeconds: 60, label: 'editar anúncios' },
  deleteProduct: { maxRequests: 5, windowSeconds: 60, label: 'excluir anúncios' },
  reportProduct: { maxRequests: 3, windowSeconds: 600, label: 'reportar anúncios' },
  createConversation: { maxRequests: 5, windowSeconds: 300, label: 'iniciar conversas' },
  uploadPhoto: { maxRequests: 15, windowSeconds: 300, label: 'enviar fotos' },
}

// ── Internal state ────────────────────────────────────────────────
// Map<string, number[]> — operation key → array of timestamps (ms)
const operationTimestamps = new Map()

// Map<string, number> — operation key → consecutive denial count (for backoff)
const denialCounts = new Map()

// ── Core functions ────────────────────────────────────────────────

/**
 * Check whether an operation is allowed under the current rate limits.
 * Does NOT consume a slot — call `recordOperation` after the operation succeeds.
 *
 * @param {string} operationKey — one of the keys in RATE_LIMITS
 * @returns {{ allowed: boolean, retryAfterMs: number, message: string }}
 */
export function checkRateLimit(operationKey) {
  const config = RATE_LIMITS[operationKey]

  if (!config) {
    // Unknown operation — allow by default (no limit configured)
    return { allowed: true, retryAfterMs: 0, message: '' }
  }

  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const timestamps = getTimestamps(operationKey)

  // Remove expired timestamps outside the sliding window
  const validTimestamps = timestamps.filter((t) => now - t < windowMs)
  operationTimestamps.set(operationKey, validTimestamps)

  if (validTimestamps.length >= config.maxRequests) {
    const oldestInWindow = validTimestamps[0]
    const retryAfterMs = oldestInWindow + windowMs - now

    // Increment denial count for exponential backoff messaging
    const denials = (denialCounts.get(operationKey) || 0) + 1
    denialCounts.set(operationKey, denials)

    const retrySeconds = Math.ceil(retryAfterMs / 1000)
    const message = formatRateLimitMessage(config.label, retrySeconds, denials)

    return { allowed: false, retryAfterMs, message }
  }

  // Reset denial count on successful check
  denialCounts.set(operationKey, 0)

  return { allowed: true, retryAfterMs: 0, message: '' }
}

/**
 * Record that an operation was performed. Call this AFTER the operation
 * succeeds so that failed attempts don't consume rate limit slots.
 *
 * @param {string} operationKey — one of the keys in RATE_LIMITS
 */
export function recordOperation(operationKey) {
  const timestamps = getTimestamps(operationKey)
  timestamps.push(Date.now())
  operationTimestamps.set(operationKey, timestamps)
}

/**
 * Convenience: check rate limit and throw if exceeded.
 * Use this at the top of service functions to guard operations.
 *
 * @param {string} operationKey — one of the keys in RATE_LIMITS
 * @throws {Error} with user-friendly message if rate limited
 */
export function enforceRateLimit(operationKey) {
  const result = checkRateLimit(operationKey)

  if (!result.allowed) {
    const error = new Error(result.message)
    error.code = 'RATE_LIMITED'
    error.retryAfterMs = result.retryAfterMs
    throw error
  }
}

/**
 * Reset all rate limit counters. Useful on logout.
 */
export function resetAllRateLimits() {
  operationTimestamps.clear()
  denialCounts.clear()
}

/**
 * Reset rate limit counters for a specific operation.
 *
 * @param {string} operationKey
 */
export function resetRateLimit(operationKey) {
  operationTimestamps.delete(operationKey)
  denialCounts.delete(operationKey)
}

/**
 * Get the current status of a rate limit for UI display.
 *
 * @param {string} operationKey
 * @returns {{ remaining: number, total: number, windowSeconds: number, resetInMs: number }}
 */
export function getRateLimitStatus(operationKey) {
  const config = RATE_LIMITS[operationKey]

  if (!config) {
    return { remaining: Infinity, total: Infinity, windowSeconds: 0, resetInMs: 0 }
  }

  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const timestamps = getTimestamps(operationKey).filter((t) => now - t < windowMs)
  const remaining = Math.max(0, config.maxRequests - timestamps.length)
  const resetInMs = timestamps.length > 0
    ? timestamps[0] + windowMs - now
    : 0

  return {
    remaining,
    total: config.maxRequests,
    windowSeconds: config.windowSeconds,
    resetInMs: Math.max(0, resetInMs),
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function getTimestamps(key) {
  return operationTimestamps.get(key) || []
}

function formatRateLimitMessage(label, retrySeconds, denialCount) {
  if (retrySeconds <= 0) {
    return `Muitas tentativas de ${label}. Tente novamente em breve.`
  }

  const timeText = retrySeconds >= 60
    ? `${Math.ceil(retrySeconds / 60)} minuto${Math.ceil(retrySeconds / 60) > 1 ? 's' : ''}`
    : `${retrySeconds} segundo${retrySeconds > 1 ? 's' : ''}`

  if (denialCount >= 3) {
    return `Limite de ${label} excedido repetidamente. Aguarde ${timeText} antes de tentar novamente.`
  }

  return `Limite de ${label} atingido. Tente novamente em ${timeText}.`
}

export default {
  checkRateLimit,
  recordOperation,
  enforceRateLimit,
  resetAllRateLimits,
  resetRateLimit,
  getRateLimitStatus,
}
