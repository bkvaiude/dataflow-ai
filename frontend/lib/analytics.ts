// Google Analytics 4 Event Tracking Utility
// Measurement ID: G-7DC703NYK9

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-7DC703NYK9';

// Check if GA is loaded
export const isGALoaded = (): boolean => {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
};

// Generic event tracking
export const trackEvent = (
  action: string,
  category: string,
  label?: string,
  value?: number
) => {
  if (!isGALoaded()) return;

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

// ============================================
// Authentication Events
// ============================================
export const trackLogin = (method: string = 'google') => {
  if (!isGALoaded()) return;
  window.gtag('event', 'login', { method });
};

export const trackSignUp = (method: string = 'google') => {
  if (!isGALoaded()) return;
  window.gtag('event', 'sign_up', { method });
};

export const trackLogout = () => {
  trackEvent('logout', 'authentication');
};

// ============================================
// Onboarding Events
// ============================================
export const trackFirstPipelineCreated = (pipelineType?: string) => {
  if (!isGALoaded()) return;
  window.gtag('event', 'first_pipeline_created', {
    event_category: 'onboarding',
    pipeline_type: pipelineType,
  });
};

export const trackFirstSourceConnected = (sourceType: string) => {
  if (!isGALoaded()) return;
  // This is a conversion event
  window.gtag('event', 'conversion', {
    send_to: `${GA_MEASUREMENT_ID}/first_source_connected`,
  });
  window.gtag('event', 'first_source_connected', {
    event_category: 'onboarding',
    source_type: sourceType,
  });
};

// ============================================
// Pipeline Actions
// ============================================
export const trackPipelineCreated = (pipelineName?: string, sourceType?: string) => {
  if (!isGALoaded()) return;
  window.gtag('event', 'pipeline_created', {
    event_category: 'pipeline',
    pipeline_name: pipelineName,
    source_type: sourceType,
  });
};

export const trackPipelineStarted = (pipelineId: string) => {
  if (!isGALoaded()) return;
  window.gtag('event', 'pipeline_started', {
    event_category: 'pipeline',
    pipeline_id: pipelineId,
  });
};

export const trackPipelineDeleted = (pipelineId: string) => {
  if (!isGALoaded()) return;
  window.gtag('event', 'pipeline_deleted', {
    event_category: 'pipeline',
    pipeline_id: pipelineId,
  });
};

// ============================================
// Chat/AI Events
// ============================================
export const trackChatMessageSent = (messageLength?: number) => {
  if (!isGALoaded()) return;
  window.gtag('event', 'chat_message_sent', {
    event_category: 'chat',
    message_length: messageLength,
  });
};

export const trackConfirmationAccepted = (confirmationType: string) => {
  if (!isGALoaded()) return;
  window.gtag('event', 'confirmation_accepted', {
    event_category: 'chat',
    confirmation_type: confirmationType,
  });
};

// ============================================
// Feature Usage Events
// ============================================
export const trackEnrichmentCreated = (enrichmentType?: string) => {
  if (!isGALoaded()) return;
  window.gtag('event', 'enrichment_created', {
    event_category: 'feature_usage',
    enrichment_type: enrichmentType,
  });
};

export const trackAlertRuleCreated = (alertType?: string) => {
  if (!isGALoaded()) return;
  window.gtag('event', 'alert_rule_created', {
    event_category: 'feature_usage',
    alert_type: alertType,
  });
};

// ============================================
// Error Events
// ============================================
export const trackApiError = (endpoint: string, errorCode?: number, errorMessage?: string) => {
  if (!isGALoaded()) return;
  window.gtag('event', 'api_error', {
    event_category: 'error',
    endpoint: endpoint,
    error_code: errorCode,
    error_message: errorMessage?.substring(0, 100), // Truncate long messages
  });
};

export const trackConnectionFailed = (connectionType: string, errorMessage?: string) => {
  if (!isGALoaded()) return;
  window.gtag('event', 'connection_failed', {
    event_category: 'error',
    connection_type: connectionType,
    error_message: errorMessage?.substring(0, 100),
  });
};

// ============================================
// Page View Tracking
// ============================================
export const trackPageView = (url: string, title?: string) => {
  if (!isGALoaded()) return;
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: url,
    page_title: title,
  });
};

// ============================================
// CTA Tracking
// ============================================
export const trackCTAClick = (ctaName: string, ctaLocation: string) => {
  if (!isGALoaded()) return;
  window.gtag('event', 'cta_click', {
    event_category: 'engagement',
    cta_name: ctaName,
    cta_location: ctaLocation,
  });
};

// Type declaration for gtag
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
    dataLayer: unknown[];
  }
}
