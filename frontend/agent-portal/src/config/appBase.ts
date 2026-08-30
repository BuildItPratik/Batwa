export function normalizeBasePath(baseUrl: string): string | undefined {
  const value = baseUrl.trim().split(/[?#]/, 1)[0]
  if (!value || value === '/' || value === './' || value === '.') return undefined

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.replace(/\/+$/, '') || undefined
}

export function joinAppPath(path: string, basePath?: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const normalizedBase = normalizeBasePath(basePath || '')
  return `${normalizedBase || ''}${normalizedPath}` || '/'
}

export const APP_BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL)

export function appAssetUrl(path: string): string {
  return joinAppPath(path, APP_BASE_PATH)
}
