/**
 * Call this from any fetch wrapper when the server returns 401.
 * Clears localStorage and reloads to the login page.
 */
export function handleUnauthorized(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}
