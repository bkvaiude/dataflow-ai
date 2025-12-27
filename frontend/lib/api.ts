import type { ApiResponse, Connector, OAuthInitResponse, ConnectorStatusResponse } from '@/types';
import { getIdToken } from './firebase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Helper to make authenticated requests with automatic token refresh
const fetchWithAuth = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  try {
    const token = await getIdToken();

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    // Handle 401 Unauthorized - token might have expired
    if (response.status === 401) {
      // Try refreshing token and retry once
      const refreshed = await import('./firebase').then(m => m.checkAuthStatus());
      if (refreshed) {
        const newToken = await getIdToken();
        const retryResponse = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(newToken && { Authorization: `Bearer ${newToken}` }),
            ...options.headers,
          },
        });

        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          return { success: false, error: retryData.detail || 'Request failed' };
        }
        return { success: true, data: retryData };
      }

      return { success: false, error: 'Authentication required' };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.detail || 'Request failed' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('API error:', error);
    return { success: false, error: 'Network error' };
  }
};

// Connectors API
export const listConnectors = async (): Promise<ApiResponse<Connector[]>> => {
  return fetchWithAuth<Connector[]>('/api/connectors');
};

export const checkConnectorStatus = async (
  provider: string
): Promise<ApiResponse<ConnectorStatusResponse>> => {
  return fetchWithAuth<ConnectorStatusResponse>(`/api/connectors/${provider}/status`);
};

export const initiateOAuth = async (
  provider: string,
  userId: string
): Promise<ApiResponse<OAuthInitResponse>> => {
  return fetchWithAuth<OAuthInitResponse>(`/api/oauth/${provider}/init/?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
  });
};

// Chat API (fallback if WebSocket not available)
export const sendChatMessageHttp = async (
  message: string
): Promise<ApiResponse<{ message: string }>> => {
  return fetchWithAuth<{ message: string }>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
};

// Health check
export const healthCheck = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
};
