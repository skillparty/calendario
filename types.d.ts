// Global shared types for Calendar10
// These types are used by JS modules via sibling .d.ts files to enable gradual TypeScript adoption.

/**
 * Base task stored on the client. When date is null, the task belongs to the agenda (undated).
 * When date is a YYYY-MM-DD string, it belongs to a calendar day.
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  /** YYYY-MM-DD or null for undated tasks */
  date: string | null;
  /** 24h format HH:mm or null */
  time?: string | null;
  completed: boolean;
  /** Whether the task participates in notifications/reminders */
  isReminder: boolean;
  priority?: number;
  tags?: string[];
}

/** A task that is assigned to a specific calendar date (YYYY-MM-DD). */
export interface CalendarTask extends Task {
  date: string; // narrowed from Task
}

/** A task without an assigned date (agenda bucket). */
export interface AgendaTask extends Task {
  date: null; // narrowed from Task
}

/**
 * Server-side task representation as returned by the backend API.
 * Field names mirror the API (snake_case for is_reminder).
 */
export interface APITask {
  id: number;
  title: string;
  description?: string | null;
  date?: string | null; // YYYY-MM-DD or null
  time?: string | null; // HH:mm or null
  completed?: boolean;
  is_reminder?: boolean;
  priority?: number;
  tags?: string[];
  // Other server fields are ignored for typing purposes
  [key: string]: unknown;
}

/** Mapping from dateKey to array of tasks. Use key 'undated' to store agenda tasks. */
export type TasksByDate = Record<string, Task[]>;

export interface UserProfile {
  id?: number | string;
  login?: string;
  username?: string;
  name?: string;
  avatar_url?: string;
  [key: string]: unknown;
}

export interface UserSession {
  /** JWT token when logging through backend */
  jwt?: string;
  /** GitHub personal access token when using Gist-only mode */
  token?: string;
  user?: UserProfile | null;
  loginTime?: number;
  [key: string]: unknown;
}

export interface FiltersState {
  month: string; // 'all' or '0'..'11'
  status: string; // 'all' | 'pending' | 'completed'
}

export interface AppState {
  currentDate: Date;
  tasks: TasksByDate;
  userSession: UserSession | null;
  userGistId: string | null;
  lastGistUpdatedAt: string | null;
  backgroundSyncTimer: any; // setInterval handle
  baseSyncIntervalMs: number;
  currentSyncIntervalMs: number;
  maxSyncIntervalMs: number;
  filters: FiltersState;
}
