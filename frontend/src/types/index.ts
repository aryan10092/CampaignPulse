export interface Campaign {
  id: string;
  title: string;
  subject: string;
  body: string;
  total_count: number;
  sent_count: number;
  processing_count: number;
  failed_count: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  percentage: number;
  created_at: string;
}

export interface Recipient {
  id: string | number;
  email: string;
  name: string;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
  error_reason?: string | null;
  sent_at?: string | null;
}

export interface CampaignProgressEvent {
  campaignId: string;
  total: number;
  sent: number;
  processing: number;
  failed: number;
  percentage: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

export interface RecipientUpdateEvent {
  recipientId: string | number;
  email: string;
  name: string;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
  sentAt?: string;
  errorReason?: string;
}
