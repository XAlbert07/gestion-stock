const TOKEN_KEY = 'gestion-stock.session-token'

export function getSessionToken(): string | null {
  return typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_KEY)
}

export function saveSessionToken(token: string) {
  window.sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearSessionToken() {
  window.sessionStorage.removeItem(TOKEN_KEY)
}
