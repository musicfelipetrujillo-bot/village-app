// V3 — Community Rooms types

export type RoomType = 'stage_local' | 'topic' | 'support';
export type RoomAnonymousMode = 'none' | 'optional' | 'mandatory';
export type RoomColorTheme = 'rust' | 'olive' | 'brown' | 'cream';
export type MessageType = 'user' | 'system' | 'ai_companion' | 'expert';
export type AIScanStatus = 'pending' | 'clear' | 'flagged' | 'crisis';
export type CrisisSeverity = 'low' | 'medium' | 'high' | 'critical';
export type CrisisFlagStatus = 'open' | 'reviewed' | 'escalated' | 'resolved';
export type ModeratorRole = 'moderator' | 'lead_moderator' | 'expert';

export interface Room {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  description: string;
  room_type: RoomType;
  color_theme: RoomColorTheme;
  city: string | null;
  stage_week_min: number | null;
  stage_week_max: number | null;
  anonymous_mode: RoomAnonymousMode;
  is_active: boolean;
  member_count: number;
  created_at: string;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  sender_user_id: string | null;
  sender_anon_id: string | null;
  body: string;
  message_type: MessageType;
  parent_id: string | null;
  is_deleted: boolean;
  ai_scan_status: AIScanStatus;
  created_at: string;
  // Resolved display fields
  display_name?: string;
  display_avatar_seed?: string;
  is_anon?: boolean;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  emoji: '❤️' | '🤗' | '💪' | '😂' | '😢' | '🙏';
  count: number;
  user_reacted: boolean;
}

export interface CrisisFlag {
  id: string;
  message_id: string;
  room_id: string;
  flagged_user_id: string | null;
  severity: CrisisSeverity;
  trigger_phrases: string[];
  ai_assessment: string | null;
  status: CrisisFlagStatus;
  sms_sent: boolean;
  created_at: string;
}

// AI skill response shapes
export interface CrisisDetectionResponse {
  severity: 'none' | CrisisSeverity;
  crisis_type: string | null;
  safe_message: string | null; // message to show mom if crisis detected
}

export interface ContentModerationResponse {
  flagged: boolean;
  category: string | null;
  confidence: number;
}
