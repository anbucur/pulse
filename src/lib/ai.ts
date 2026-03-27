import { getAuth } from 'firebase/auth';

async function getIdToken(): Promise<string> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  return token;
}

export async function callAI<T = unknown>(endpoint: string, body: object): Promise<T> {
  const token = await getIdToken();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || 'AI request failed');
  }
  return response.json() as Promise<T>;
}
