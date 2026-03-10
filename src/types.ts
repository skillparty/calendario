// Global shared types for Calendar10
// These types are used by JS modules via sibling .d.ts files to enable gradual TypeScript adoption.

/**
 * Base task stored on the client. When date is null, the task belongs to the agenda (undated).
 * When date is a YYYY-MM-DD string, it belongs to a calendar day.
 */
export interface Task {
  id: string;
  /** Numeric backend ID when task has been synced */
  serverId?: number;
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
  /** Recurrence pattern: 'daily', 'weekly', 'monthly', 'yearly' or undefined/null for none */
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  /** ID linking all instances of a recurrent series. Usually the ID of the original task. */
  recurrenceId?: string;
  /** Unix timestamp of last modification */
  lastModified?: number;
  /** Locally modified but not yet confirmed synced */
  dirty?: boolean;

  // ── Phase 2: Group collaboration fields ──
  /** Group this task belongs to (null = personal task) */
  group_id?: number | null;
  /** User ID this task is assigned to within a group */
  assigned_to?: number | null;
  /** Kanban-style task status for group tasks */
  task_status?: 'todo' | 'in_progress' | 'done' | 'blocked' | null;
}

// ── Phase 2: Group collaboration types ──────────────────────────────────────

export type GroupRole = 'owner' | 'admin' | 'member';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';

export interface Group {
  id: number;
  name: string;
  description?: string | null;
  owner_id: number;
  invite_code?: string | null;
  created_at?: string;
  updated_at?: string;
  /** populated by API join */
  my_role?: GroupRole;
  member_count?: number;
  joined_at?: string;
}

export interface GroupMember {
  group_id: number;
  user_id: number;
  role: GroupRole;
  joined_at?: string;
  /** populated by API join */
  users?: {
    id: number;
    username?: string;
    name?: string;
    avatar_url?: string;
  };
}

/** Group-specific task (extends Task with required group fields) */
export interface GroupTask extends Task {
  group_id: number;
  task_status: TaskStatus;
  assigned_to?: number | null;
  /** populated by API join */
  assigned_user?: {
    id: number;
    username?: string;
    name?: string;
    avatar_url?: string;
  } | null;
}

/** State slice for groups in the Svelte store */
export interface GroupsState {
  groups: Group[];
  activeGroupId: number | null;
  loading: boolean;
  error: string | null;
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
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  recurrence_id?: string | null;
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
  user_metadata?: { name?: string; avatar_url?: string;[key: string]: any };
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
  priority: string; // 'all' | '1' | '2' | '3'
}

export interface AppState {
  currentDate: Date;
  tasks: TasksByDate;
  userSession: UserSession | null;
  groups: Group[];
  activeGroupId: number | null;
  userGistId: string | null;
  lastGistUpdatedAt: string | null;
  backgroundSyncTimer: any; // setInterval handle
  backendSyncTimer: any; // setInterval handle for backend polling
  baseSyncIntervalMs: number;
  currentSyncIntervalMs: number;
  maxSyncIntervalMs: number;
  filters: FiltersState;
}

declare global {
  interface Window {
    showPdfExportModal?: () => void;
    closePdfExportModal?: () => void;
    generatePDF?: () => void;
    toggleExportOptions?: () => void;

    enhancedState?: unknown;
    jspdf?: {
      jsPDF: new () => any;
    };
  }
}

export { };
