import type { ApiResponse, Connector, OAuthInitResponse, ConnectorStatusResponse } from '@/types';
import { getIdToken } from './firebase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Helper to make authenticated requests
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
