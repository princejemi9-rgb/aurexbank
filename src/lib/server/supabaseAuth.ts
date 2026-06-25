import { fetchWithRemoteTimeout } from "./remoteTimeout";

export type SupabaseRouteUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

async function readRemoteError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as
    | { msg?: string; message?: string; error_description?: string; error?: string }
    | null;

  return (
    data?.msg ||
    data?.message ||
    data?.error_description ||
    data?.error ||
    fallback
  );
}

export async function getSupabaseUser(
  supabaseUrl: string,
  supabaseAnonKey: string,
  accessToken: string
): Promise<{
  error?: string;
  status: number;
  user: SupabaseRouteUser | null;
}> {
  const response = await fetchWithRemoteTimeout(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch(() => null);

  if (!response) {
    return {
      error: "Unable to verify session",
      status: 503,
      user: null,
    };
  }

  if (!response.ok) {
    return {
      error: await readRemoteError(response, "Invalid session"),
      status: response.status || 401,
      user: null,
    };
  }

  const user = (await response.json().catch(() => null)) as
    | SupabaseRouteUser
    | null;

  if (!user?.id) {
    return {
      error: "Invalid session",
      status: 401,
      user: null,
    };
  }

  return { status: 200, user };
}
