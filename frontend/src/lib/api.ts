import { getSessionToken } from '@/auth/session-token'

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function getLoginError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) return 'Adresse e-mail ou mot de passe invalide.'
  return error instanceof Error ? error.message : 'La connexion a échoué.'
}

type ApiOptions = Omit<RequestInit, 'headers'> & {
  token?: string | null
  headers?: HeadersInit
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token: explicitToken, headers: initialHeaders, ...requestOptions } = options
  const token =
    explicitToken === undefined
      ? path === '/auth/login'
        ? null
        : getSessionToken()
      : explicitToken
  const headers = new Headers(initialHeaders)
  if (requestOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
    response = await fetch(`${baseUrl}${path}`, {
      ...requestOptions,
      headers,
    })
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifiez qu'il est démarré.", 0)
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message || 'Une erreur est survenue lors de la requête.',
      response.status,
      payload?.error?.code,
    )
  }
  return payload as T
}
