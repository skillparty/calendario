// Enhanced TypeScript definitions for Calendar10
// Provides stronger type safety and better developer experience

/**
 * Priority levels for tasks (1-5 scale)
 */
export type Priority = 1 | 2 | 3 | 4 | 5;

/**
 * Task synchronization status
 */
export type SyncStatus = 'pending' | 'synced' | 'error' | 'conflict';

/**
 * Task view filters
 */
export type TaskFilter = 'all' | 'pending' | 'completed' | 'today' | 'week' | 'month';

/**
 * Export format options
 */
export type ExportFormat = 'pdf' | 'csv' | 'json' | 'ical';

/**
 * Base task interface with all properties
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  /** YYYY-MM-DD or null for undated tasks */
  date: string | null;
  /** HH:mm format or null */
  time?: string | null;
  completed: boolean;
  isReminder: boolean;
  priority?: Priority;
  tags?: string[];
  /** Server-side ID for backend sync */
  serverId?: number;
  /** Unix timestamp of last modification */
  lastModified?: number;
  /** Current sync status */
  syncStatus?: SyncStatus;
  /** Recurring task pattern */
  recurrence?: RecurrencePattern;
  /** Task attachments */
  attachments?: Attachment[];
}

/**
 * Recurrence pattern for repeating tasks
 */
export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: string;
  daysOfWeek?: number[]; // 0-6 for weekly
  dayOfMonth?: number; // for monthly
}

/**
 * File attachment for tasks
 */
export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
}

/**
 * Task specifically assigned to a calendar date
 */
export interface CalendarTask extends Task {
  date: string; // narrowed from Task
}

/**
 * Task without an assigned date (agenda/bucket)
 */
export interface AgendaTask extends Task {
  date: null; // narrowed from Task
}

/**
 * Input for creating a new task (without system fields)
 */
export type TaskInput = Omit<Task, 'id' | 'serverId' | 'syncStatus' | 'lastModified'>;

/**
 * Input for updating an existing task
 */
export type TaskUpdate = Partial<TaskInput>;

/**
 * Server API task representation
 */
export interface APITask {
  id: number;
  title: string;
  description?: string | null;
  date?: string | null;
  time?: string | null;
  completed?: boolean;
  is_reminder?: boolean;
  priority?: number;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Task grouped by date for calendar view
 */
export type TasksByDate = Record<string, Task[]>;

/**
 * User profile information
 */
export interface UserProfile {
  id?: number | string;
  login?: string;
  username?: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  preferences?: UserPreferences;
}

/**
 * User preferences and settings
 */
export interface UserPreferences {
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  timezone?: string;
  weekStartsOn?: 0 | 1 | 6; // Sunday, Monday, Saturday
  defaultView?: 'calendar' | 'agenda';
  notificationSettings?: NotificationSettings;
}

/**
 * Notification configuration
 */
export interface NotificationSettings {
  enabled: boolean;
  reminderMinutesBefore?: number[];
  dailySummary?: boolean;
  dailySummaryTime?: string;
}

/**
 * User session information
 */
export interface UserSession {
  jwt?: string;
  token?: string;
  user?: UserProfile | null;
  loginTime?: number;
  expiresAt?: number;
}

/**
 * Application filter state
 */
export interface FiltersState {
  month: string;
  status: string;
  tags?: string[];
  search?: string;
  dateRange?: DateRange;
}

/**
 * Date range for filtering
 */
export interface DateRange {
  start: string;
  end: string;
}

/**
 * Main application state
 */
export interface AppState {
  currentDate: Date;
  tasks: TasksByDate;
  userSession: UserSession | null;
  userGistId: string | null;
  lastGistUpdatedAt: string | null;
  backgroundSyncTimer: any;
  baseSyncIntervalMs: number;
  currentSyncIntervalMs: number;
  maxSyncIntervalMs: number;
  filters: FiltersState;
  ui: UIState;
}

/**
 * UI state management
 */
export interface UIState {
  isLoading: boolean;
  loadingMessage?: string;
  error?: ErrorState | null;
  activeModal?: string | null;
  selectedTaskId?: string | null;
  view: 'calendar' | 'agenda';
}

/**
 * Error state representation
 */
export interface ErrorState {
  message: string;
  code?: string;
  details?: any;
  timestamp: number;
}

/**
 * API Response wrapper
 */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: PaginationInfo;
}

/**
 * Pagination information
 */
export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Type guards for runtime type checking
 */
export const TypeGuards = {
  isCalendarTask: (task: Task): task is CalendarTask => 
    task.date !== null && typeof task.date === 'string',
  
  isAgendaTask: (task: Task): task is AgendaTask => 
    task.date === null,
  
  isValidPriority: (value: any): value is Priority => 
    typeof value === 'number' && value >= 1 && value <= 5,
  
  isValidDate: (date: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) return false;
    const d = new Date(date + 'T00:00:00');
    return !isNaN(d.getTime());
  },
  
  isValidTime: (time: string): boolean => {
    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return regex.test(time);
  }
};

/**
 * Constants for the application
 */
export const Constants = {
  MAX_TITLE_LENGTH: 500,
  MAX_DESCRIPTION_LENGTH: 5000,
  MAX_TAGS: 10,
  MAX_ATTACHMENTS: 5,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  DEFAULT_PRIORITY: 3 as Priority,
  SYNC_INTERVAL_MS: 120000, // 2 minutes
  NOTIFICATION_LEAD_TIME: 15, // minutes
} as const;

/**
 * Event types for the event system
 */
export type AppEvent = 
  | { type: 'task:created'; payload: Task }
  | { type: 'task:updated'; payload: Task }
  | { type: 'task:deleted'; payload: string }
  | { type: 'tasks:loaded'; payload: Task[] }
  | { type: 'sync:started' }
  | { type: 'sync:completed' }
  | { type: 'sync:failed'; payload: Error }
  | { type: 'auth:login'; payload: UserSession }
  | { type: 'auth:logout' }
  | { type: 'ui:loading'; payload: boolean }
  | { type: 'ui:error'; payload: ErrorState }
  | { type: 'filter:changed'; payload: FiltersState };

/**
 * Observer pattern callback
 */
export type Observer<T = any> = (event: T) => void;

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;
