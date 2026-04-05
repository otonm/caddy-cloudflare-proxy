export function isUpstreamError(err: unknown): boolean {
  // Node native fetch wraps connection errors: err.cause.code
  const cause = (err as { cause?: NodeJS.ErrnoException }).cause
  if (
    cause?.code === 'ECONNREFUSED' ||
    cause?.code === 'ENOTFOUND' ||
    cause?.code === 'ETIMEDOUT'
  ) {
    return true
  }
  // Direct errno (e.g., dockerode socket errors)
  const code = (err as NodeJS.ErrnoException).code
  return code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT'
}
