// User types
export interface User {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

// Chat message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: ChatAction[];
}

export interface ChatAction {
  type: 'oauth' | 'link' | 'button';
  provider?: string;
  url?: string;
  label: string;
  onClick?: () => void;
}

// Connector types
export interface Connector {
  id: string;
  provider: 'google_ads' | 'facebook_ads' | 'shopify';
  name: string;
  status: 'available' | 'connected' | 'coming_soon';
  lastSync?: Date;
  accountName?: string;
}

// Dashboard/Metrics types
export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  roas: number;
  cpc: number;
  ctr: number;
}

export interface DashboardData {
  url: string;
  insight: string;
  campaignsCount: number;
  metrics: CampaignMetrics[];
}

// WebSocket event types
export interface SocketEvents {
  connect: () => void;
  disconnect: () => void;
  chat_message: (data: { message: string; user_id: string }) => void;
  chat_response: (data: { message: string; actions?: ChatAction[] }) => void;
  error: (error: string) => void;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface OAuthInitResponse {
  authUrl: string;
  provider: string;
  message: string;
}

export interface ConnectorStatusResponse {
  connected: boolean;
  available: boolean;
  accountName?: string;
  lastSync?: string;
}
