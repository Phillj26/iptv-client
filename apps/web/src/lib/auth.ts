export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

export interface AuthResult {
  session?: AuthSession;
  user?: AuthUser;
}

interface AuthApiUser {
  id: string;
  email?: string;
}

interface AuthApiResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  user?: AuthApiUser;
  error?: string;
  error_description?: string;
  msg?: string;
}

const sessionStorageKey = "streamline-auth-v1";

function authConfig(): { url: string; key: string } | undefined {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  return url && key ? { url, key } : undefined;
}

export function isAuthConfigured(): boolean {
  return Boolean(authConfig());
}

function toUser(user: AuthApiUser): AuthUser {
  return { id: user.id, email: user.email };
}

function toSession(response: AuthApiResponse): AuthSession | undefined {
  if (!response.access_token || !response.refresh_token || !response.user) {
    return undefined;
  }

  const expiresAt = response.expires_at
    ? response.expires_at * 1000
    : Date.now() + (response.expires_in ?? 3600) * 1000;
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt,
    user: toUser(response.user)
  };
}

async function request(path: string, init: RequestInit = {}): Promise<AuthApiResponse> {
  const config = authConfig();
  if (!config) {
    throw new Error("Login is not configured for this build. Add the Supabase environment variables and rebuild.");
  }

  const response = await fetch(`${config.url}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      "Content-Type": "application/json",
      ...init.headers
    }
  });
  const body = await response.json().catch(() => ({})) as AuthApiResponse;
  if (!response.ok) {
    throw new Error(body.error_description || body.msg || body.error || "Authentication request failed.");
  }
  return body;
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const response = await request("token?grant_type=password", {
    body: JSON.stringify({ email, password }),
    method: "POST"
  });
  return { session: toSession(response), user: response.user ? toUser(response.user) : undefined };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const response = await request("signup", {
    body: JSON.stringify({ email, password }),
    method: "POST"
  });
  return { session: toSession(response), user: response.user ? toUser(response.user) : undefined };
}

export async function refreshSession(session: AuthSession): Promise<AuthSession | undefined> {
  const response = await request("token?grant_type=refresh_token", {
    body: JSON.stringify({ refresh_token: session.refreshToken }),
    method: "POST"
  });
  return toSession(response);
}

export async function signOut(session: AuthSession): Promise<void> {
  const config = authConfig();
  if (!config) {
    return;
  }

  await fetch(`${config.url}/auth/v1/logout`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${session.accessToken}`
    },
    method: "POST"
  });
}

export function loadSession(): AuthSession | undefined {
  try {
    const serialized = window.localStorage.getItem(sessionStorageKey);
    if (!serialized) {
      return undefined;
    }
    const session = JSON.parse(serialized) as AuthSession;
    return typeof session.accessToken === "string" && typeof session.refreshToken === "string" && typeof session.expiresAt === "number" && typeof session.user?.id === "string"
      ? session
      : undefined;
  } catch {
    return undefined;
  }
}

export function saveSession(session: AuthSession): void {
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(sessionStorageKey);
}
