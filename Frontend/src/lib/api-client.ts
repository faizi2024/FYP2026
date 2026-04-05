const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiRequest(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
}