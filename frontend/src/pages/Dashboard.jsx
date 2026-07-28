import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  getSpaceSummaryDashboard,
  getSuperAdminAssignmentHistory,
  getSuperAdminActivitySpaces,
  getSuperAdminAuditLogDetail,
  getSuperAdminAuditLogs,
  getSuperAdminDashboard,
  getSuperAdminRecentActivities,
} from '../api/dashboardApi';
import { API_BASE_URL } from '../api/axiosClient';

const getLayoutQueryString = (search) => {
  const currentParams = new URLSearchParams(search);
  const nextParams = new URLSearchParams();
  ['role', 'spaceRole', 'user'].forEach((key) => {
    const value = currentParams.get(key);
    if (value) {
      nextParams.set(key, value);
    }
  });
  const query = nextParams.toString();
  return query ? `?${query}` : '';
};

const STATUS_COLORS = {
  done: '#4C2B74',
  in_progress: '#6366F1',
  new: '#10B981',
  overdue: '#DE350B',
  in_testing: '#A100FF',
  pending_review: '#F59E0B',
  need_revision: '#FF2D00',
  cancelled: '#64748b',
};

const REPRESENTATIVE_STATUS_KEYS = new Set(['new', 'in_progress', 'done', 'overdue']);

const ACCOUNT_STYLES = {
  active: { color: '#10b981', gradient: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)', glow: 'rgba(16, 185, 129, 0.2)', icon: 'check_circle' },
  pending: { color: '#f59e0b', gradient: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)', glow: 'rgba(245, 158, 11, 0.2)', icon: 'pending' },
  locked: { color: '#ef4444', gradient: 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)', glow: 'rgba(239, 68, 68, 0.2)', icon: 'lock' },
  inactive: { color: '#64748b', gradient: 'linear-gradient(90deg, #64748b 0%, #94a3b8 100%)', glow: 'rgba(100, 116, 139, 0.1)', icon: 'person_off' },
};

const PRIORITY_STYLES = {
  HIGH: { color: '#FF8B00', icon: 'keyboard_arrow_up' },
  MEDIUM: { color: '#DE350B', icon: 'drag_handle' },
  LOW: { color: '#4C2B74', icon: 'keyboard_arrow_down' },
};

const FALLBACK_AVATAR_COLORS = ['#3525cd', '#db2777', '#10b981', '#f97316', '#64748b', '#7c3aed'];

const getAvatarColor = (value = '') => {
  const seed = String(value || 'unknown');
  const total = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return FALLBACK_AVATAR_COLORS[total % FALLBACK_AVATAR_COLORS.length];
};

const toTitleCase = (value = '') => String(value)
  .replace(/_/g, ' ')
  .toLowerCase()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = normalizeDate(value);
  if (!date) return String(value).replace('T', ' ').slice(0, 16);
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const groupFromDate = (value, uppercase = false) => {
  const date = normalizeDate(value);
  if (!date) return uppercase ? 'IN THE LAST WEEK' : 'In the last week';
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.floor((startOfToday - startOfDate) / 86400000);
  if (daysAgo <= 0) return uppercase ? 'TODAY' : 'Today';
  if (daysAgo === 1) return uppercase ? 'YESTERDAY' : 'Yesterday';
  return uppercase ? 'IN THE LAST WEEK' : 'In the last week';
};

const formatRelativeTime = (value) => {
  const date = normalizeDate(value);
  if (!date) return formatDateTime(value);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60000) return 'JUST NOW';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}M AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}D AGO`;
  return formatDateTime(value);
};

const formatActivityRelativeTime = (value) => {
  const date = normalizeDate(value);
  if (!date) return formatDateTime(value);
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDateTime(value);
};

const formatActivityDateHeading = (value) => {
  const date = normalizeDate(value);
  if (!date) return 'Recent';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const normalizeAvatarUrl = (avatarUrl) => {
  if (!avatarUrl) return '';
  if (/^(blob:|data:|https?:\/\/)/i.test(avatarUrl)) return avatarUrl;
  const path = avatarUrl.startsWith('media/') ? `/${avatarUrl}` : avatarUrl;
  if (/^https?:\/\//i.test(API_BASE_URL)) {
    try {
      return `${new URL(API_BASE_URL).origin}${path}`;
    } catch {
      return avatarUrl;
    }
  }
  return path;
};

const normalizeUser = (user) => {
  const name = user?.full_name || user?.email || 'System';
  return {
    ...user,
    full_name: name,
    initials: user?.initials || name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '--',
    avatarUrl: normalizeAvatarUrl(user?.avatar_url || user?.avatarUrl || ''),
    color: getAvatarColor(user?.user_id || name),
  };
};

const statusPillClass = (value = '') => {
  const key = String(value).toLowerCase();
  if (key.includes('task')) return 'bg-teal-50 text-teal-700 border-teal-100';
  if (key.includes('user')) return 'bg-blue-50 text-blue-700 border-blue-100';
  if (key.includes('token') || key.includes('session')) return 'bg-slate-100 text-slate-700 border-slate-200';
  if (key.includes('comment') || key.includes('revision') || key.includes('cancel')) return 'bg-red-50 text-red-700 border-red-100';
  if (key.includes('assignment')) return 'bg-amber-50 text-amber-700 border-amber-100';
  if (key.includes('done')) return 'bg-green-50 text-green-700 border-green-100';
  if (key.includes('progress')) return 'bg-blue-50 text-blue-700 border-blue-100';
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

const normalizeAuditLabelTitle = (value = '', action = '') => {
  const text = `${value} ${action}`.toLowerCase();
  if (text.includes('task')) return 'Task';
  if (text.includes('space')) return 'Space';
  if (text.includes('comment')) return 'Comment';
  if (text.includes('attachment') || text.includes('file')) return 'Attachment';
  if (text.includes('session')) return 'Session';
  if (text.includes('token')) return 'Token';
  if (
    text.includes('user') ||
    text.includes('avatar') ||
    text.includes('upload avatar') ||
    text.includes('email') ||
    text.includes('verification') ||
    text.includes('register') ||
    text.includes('logout') ||
    text.includes('profile') ||
    text.includes('password')
  ) {
    return 'User';
  }
  return toTitleCase(value || action || 'System');
};

const uniqueOptions = (options) => {
  const seen = new Set();
  return options.filter((option) => {
    const key = String(option.value || option.label || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const AUDIT_LABEL_OPTIONS = [
  { value: "All Labels", label: "All Labels" },
  { value: "User", label: "User" },
  { value: "Task", label: "Task" },
  { value: "Space", label: "Space" },
  { value: "Session", label: "Session" },
  { value: "Token", label: "Token" },
];

const AUDIT_EVENT_OPTIONS = [
  { value: "All Events", label: "All Events" },
  { value: "Login", label: "Login" },
  { value: "Logout", label: "Logout" },
  { value: "Create User", label: "Create User" },
  { value: "Register User", label: "Register User" },
  { value: "Change Password", label: "Change Password" },
  { value: "Reset Password", label: "Reset Password" },
  { value: "Update Profile", label: "Update Profile" },
  { value: "Update Avatar", label: "Update Avatar" },
  { value: "Update User", label: "Update User" },
  { value: "Update User Status", label: "Update User Status" },
  { value: "Update User Lock Status", label: "Update User Lock Status" },
  { value: "Create Space", label: "Create Space" },
  { value: "Update Space", label: "Update Space" },
  { value: "Archive Space", label: "Archive Space" },
  { value: "Restore Space", label: "Restore Space" },
];

const AUDIT_DATE_RANGE_OPTIONS = [
  { value: "All time", label: "All time" },
  { value: "Today", label: "Today" },
  { value: "Yesterday", label: "Yesterday" },
  { value: "Last 7 days", label: "Last 7 days" },
  { value: "Last 30 days", label: "Last 30 days" },
  { value: "Last 90 days", label: "Last 90 days" },
  { value: "Last 6 months", label: "Last 6 months" },
];

const auditEventKey = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const matchesAuditDateRange = (value, range) => {
  if (range === "All time") return true;
  const date = normalizeDate(value);
  if (!date) return false;
  if (range === "Today") return groupFromDate(value) === "Today";
  if (range === "Yesterday") return groupFromDate(value) === "Yesterday";

  const daysByRange = {
    "Last 7 days": 7,
    "Last 30 days": 30,
    "Last 90 days": 90,
    "Last 6 months": 183,
  };
  const days = daysByRange[range];
  if (!days) return true;
  return date.getTime() >= Date.now() - (days * 24 * 60 * 60 * 1000);
};

const toApiAuditEventType = (value) => {
  if (!value || value === "All Events") return undefined;
  return auditEventKey(value).toUpperCase();
};

const toApiAuditLabelTitle = (value) => {
  if (!value || value === "All Labels") return undefined;
  return String(value).trim().toUpperCase();
};

const toApiAuditSortOrder = (value) => (value === "Oldest First" ? "asc" : "desc");

const getAuditDateRangeParams = (range) => {
  if (!range || range === "All time") return {};

  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  const now = new Date();
  let from = null;
  let to = now;

  if (range === "Today") {
    from = startOfDay(now);
    to = endOfDay(now);
  } else if (range === "Yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    from = startOfDay(yesterday);
    to = endOfDay(yesterday);
  } else {
    const daysByRange = {
      "Last 7 days": 7,
      "Last 30 days": 30,
      "Last 90 days": 90,
      "Last 6 months": 183,
    };
    const days = daysByRange[range];
    if (!days) return {};
    from = new Date(now);
    from.setDate(now.getDate() - days);
  }

  return {
    date_from: from?.toISOString(),
    date_to: to?.toISOString(),
  };
};

const buildStatusData = (overview, fallback) => {
  const items = overview?.items?.length ? overview.items : [];
  if (!items.length) return fallback;
  const segmentTotal = Math.max(items.reduce((sum, item) => sum + Number(item.count || 0), 0), 1);
  let offset = 0;

  return items.map((item) => {
    const count = Number(item.count || 0);
    const dash = segmentTotal > 0 ? (count / segmentTotal) * 100 : 0;
    const midpoint = offset + (dash / 2);
    const angle = ((midpoint / 100) * 360 - 90) * (Math.PI / 180);
    const tooltipRadius = 46;
    const left = 50 + Math.cos(angle) * tooltipRadius;
    const top = 50 + Math.sin(angle) * tooltipRadius;
    const segment = {
      key: String(item.key || '').toLowerCase(),
      label: item.label || toTitleCase(item.key),
      count,
      color: STATUS_COLORS[String(item.key || '').toLowerCase()] || '#888995',
      dash,
      offset: -offset,
      tPos: {
        left: `${Math.max(6, Math.min(94, left))}%`,
        top: `${Math.max(8, Math.min(94, top))}%`,
      },
    };
    offset += dash;
    return segment;
  });
};

const buildPriorityData = (priorityBreakdown, fallback) => {
  const items = priorityBreakdown?.items?.length ? priorityBreakdown.items : [];
  if (!items.length) return fallback;
  return items.map((item) => {
    const key = String(item.key || item.label || '').toUpperCase();
    const style = PRIORITY_STYLES[key] || { color: '#888995', icon: 'drag_handle' };
    return {
      label: item.label || toTitleCase(key),
      value: Number(item.count || 0),
      color: style.color,
      icon: style.icon,
    };
  });
};

const buildYAxisTicks = (maxValue) => {
  const top = Math.max(5, Math.ceil(Math.max(maxValue, 1) / 5) * 5);
  const step = Math.max(1, Math.ceil(top / 5));
  return [5, 4, 3, 2, 1, 0].map((multiplier) => step * multiplier);
};

const buildAccountOverviewData = (overview, fallback) => {
  const items = overview?.items?.length ? overview.items : [];
  if (!items.length) return fallback;
  const total = Math.max(overview?.total || items.reduce((sum, item) => sum + Number(item.count || 0), 0), 1);
  return items.map((item) => {
    const styleKey = String(item.key || item.label || '').toLowerCase();
    const style = ACCOUNT_STYLES[styleKey] || ACCOUNT_STYLES.active;
    const count = Number(item.count || 0);
    return {
      label: item.label || toTitleCase(item.key),
      count,
      total,
      percentage: Math.round(Number(item.percentage ?? ((count / total) * 100))),
      ...style,
    };
  });
};

const buildAdminStats = (metrics, fallback) => {
  if (!metrics) return fallback;
  return [
    { icon: 'group', label: 'Total Users', value: metrics.total_users ?? 0, colorClass: 'text-indigo-600', gradientClass: 'gradient-indigo', delay: '0.05s' },
    { icon: 'assignment', label: 'Total Tasks', value: metrics.total_tasks ?? 0, colorClass: 'text-[#2d1b4e]', gradientClass: 'gradient-purple', delay: '0.1s' },
    { icon: 'check_circle', label: 'Completed Tasks', value: metrics.completed_tasks ?? 0, colorClass: 'text-green-600', gradientClass: 'gradient-green', delay: '0.2s' },
    { icon: 'sync', label: 'In Progress', value: metrics.in_progress_tasks ?? 0, colorClass: 'text-blue-600', gradientClass: 'gradient-blue', delay: '0.3s' },
    { icon: 'warning', label: 'Overdue Tasks', value: metrics.overdue_tasks ?? 0, colorClass: 'text-red-600', gradientClass: 'gradient-red', delay: '0.4s' },
  ];
};

const buildSpaceSummaryStats = (metrics, fallback, memberCount = 0) => {
  if (!metrics) return fallback;
  const stats = [];
  if (metrics.total_users !== null && metrics.total_users !== undefined) {
    stats.push({ icon: 'group', label: 'Total Users', value: metrics.total_users ?? memberCount, colorClass: 'text-indigo-600', gradientClass: 'gradient-indigo', delay: '0.05s' });
  }
  return [
    ...stats,
    { icon: 'assignment', label: 'Total Tasks', value: metrics.total_tasks ?? 0, colorClass: 'text-[#2d1b4e]', gradientClass: 'gradient-purple', delay: '0.1s' },
    { icon: 'check_circle', label: 'Completed Tasks', value: metrics.completed_tasks ?? 0, colorClass: 'text-green-600', gradientClass: 'gradient-green', delay: '0.2s' },
    { icon: 'sync', label: 'In Progress', value: metrics.in_progress_tasks ?? 0, colorClass: 'text-blue-600', gradientClass: 'gradient-blue', delay: '0.3s' },
    { icon: 'warning', label: 'Overdue Tasks', value: metrics.overdue_tasks ?? 0, colorClass: 'text-red-600', gradientClass: 'gradient-red', delay: '0.4s' },
  ];
};

const adminLoadingStats = [
  { icon: 'group', label: 'Total Users', value: '...', colorClass: 'text-indigo-600', gradientClass: 'gradient-indigo', delay: '0.05s' },
  { icon: 'assignment', label: 'Total Tasks', value: '...', colorClass: 'text-[#2d1b4e]', gradientClass: 'gradient-purple', delay: '0.1s' },
  { icon: 'check_circle', label: 'Completed Tasks', value: '...', colorClass: 'text-green-600', gradientClass: 'gradient-green', delay: '0.2s' },
  { icon: 'sync', label: 'In Progress', value: '...', colorClass: 'text-blue-600', gradientClass: 'gradient-blue', delay: '0.3s' },
  { icon: 'warning', label: 'Overdue Tasks', value: '...', colorClass: 'text-red-600', gradientClass: 'gradient-red', delay: '0.4s' },
];

const mapAuditLog = (log) => {
  const user = normalizeUser(log?.user);
  const labelTitle = normalizeAuditLabelTitle(log?.label_title, log?.action);
  return {
    id: log?.log_id || '',
    actionKey: log?.action || '',
    user: user.full_name,
    initials: user.initials,
    avatarBg: user.color,
    avatarUrl: user.avatarUrl,
    role: user.role ? toTitleCase(user.role) : 'System',
    event: log?.event || toTitleCase(log?.action || ''),
    labelTitle,
    createdAt: formatDateTime(log?.created_at),
    payload: {
      log_id: log?.log_id,
      user_id: log?.user?.user_id,
      action: log?.action,
      label_title: log?.label_title,
      entity_id: log?.entity_id,
      payload: log?.payload,
      created_at: log?.created_at,
    },
  };
};

const mapAuditActivity = (log) => {
  const user = normalizeUser(log?.user);
  const label = normalizeAuditLabelTitle(log?.label_title, log?.action);
  return {
    actionKey: log?.action || '',
    user: user.full_name,
    initials: user.initials,
    avatarColor: user.color,
    avatarUrl: user.avatarUrl,
    textColor: 'white',
    action: (log?.event || toTitleCase(log?.action || '')).toLowerCase(),
    status: String(label || '').toUpperCase(),
    statusColor: statusPillClass(label),
    time: formatDateTime(log?.created_at),
    labelTitle: toTitleCase(label),
    group: groupFromDate(log?.created_at),
    target: log?.entity_id,
  };
};

const mapRecentActivityTask = (activity, uppercaseGroup = true, { showSpaceContext = true } = {}) => {
  const assignees = (activity?.assignees || []).map((assignee) => {
    const user = normalizeUser(assignee);
    return { name: user.full_name, full_name: user.full_name, initials: user.initials, color: user.color, avatarUrl: user.avatarUrl };
  });
  const subtitleParts = [activity?.target_id];
  if (showSpaceContext) subtitleParts.push(activity?.space_name);
  return {
    title: activity?.target_title || activity?.action || activity?.target_id || 'Activity',
    subtitle: activity?.subtitle || subtitleParts.filter(Boolean).join(' - '),
    status: activity?.status || '',
    group: groupFromDate(activity?.created_at, uppercaseGroup),
    time: formatRelativeTime(activity?.created_at),
    assignees,
    icon: activity?.target_type === 'space' ? 'folder' : activity?.target_type === 'user' ? 'group' : 'check_box',
    type: activity?.target_type || 'task',
    space_id: activity?.space_id,
  };
};

const mapAssignedToMeActivity = (activity, options) => {
  const mapped = mapRecentActivityTask(activity, true, options);
  const status = String(activity?.status || '').toLowerCase();
  const statusGroup = status.includes('progress')
    ? 'IN PROGRESS'
    : status.includes('review') || status.includes('testing')
      ? 'IN REVIEW'
      : 'TO DO';
  return {
    ...mapped,
    group: statusGroup,
    status: activity?.status ? toTitleCase(activity.status) : 'To Do',
  };
};

const mapRecentActivityPreview = (activity) => {
  const user = normalizeUser(activity?.user);
  const label = normalizeAuditLabelTitle(activity?.label_title || activity?.target_type, activity?.action);
  const status = activity?.status || label;
  return {
    user: user.full_name,
    initials: user.initials,
    avatarColor: user.color,
    avatarUrl: user.avatarUrl,
    textColor: 'white',
    action: String(activity?.action || '').toLowerCase(),
    status: String(status || '').replace(/_/g, ' ').toUpperCase(),
    statusColor: statusPillClass(status),
    time: formatDateTime(activity?.created_at),
    relativeTime: formatActivityRelativeTime(activity?.created_at),
    createdAt: activity?.created_at,
    labelTitle: toTitleCase(label),
    group: groupFromDate(activity?.created_at),
    target: activity?.target_title || activity?.target_id,
    targetId: activity?.target_id,
  };
};

const mapAssignmentHistory = (history, { showSpaceContext = true } = {}) => {
  const previousAssignee = history?.previous_assignee ? normalizeUser(history.previous_assignee) : null;
  const newAssignee = history?.new_assignee ? normalizeUser(history.new_assignee) : null;
  const changedBy = history?.changed_by ? normalizeUser(history.changed_by) : null;
  return {
    assignment_history_id: history?.assignment_history_id,
    task_id: history?.task_id,
    task_title: history?.task_title || history?.task_id,
    space_name: showSpaceContext ? (history?.space_name || '') : '',
    previous_assignee: previousAssignee,
    new_assignee: newAssignee,
    changed_by: changedBy,
    reason: history?.reason,
    status: history?.change_status || 'done',
    group: groupFromDate(history?.changed_at, true),
    changed_at: formatDateTime(history?.changed_at),
    space_id: history?.space_id,
  };
};

const fetchSuperAdminDashboardBundle = async ({ spaceId } = {}) => {
  const recentParams = { page_size: 20 };
  const assignmentParams = { page_size: 100 };

  if (spaceId) {
    recentParams.space_id = spaceId;
    assignmentParams.space_id = spaceId;
  }

  const [dashboard, activitySpaces, workedOn, viewed, assignHistory, auditLogs, assignmentHistory] = await Promise.all([
    getSuperAdminDashboard(),
    getSuperAdminActivitySpaces(),
    getSuperAdminRecentActivities({ ...recentParams, tab: 'worked_on' }),
    getSuperAdminRecentActivities({ ...recentParams, tab: 'viewed' }),
    getSuperAdminRecentActivities({ ...recentParams, tab: 'assign_history' }),
    getSuperAdminAuditLogs({ page: 1, page_size: 8 }),
    getSuperAdminAssignmentHistory(assignmentParams),
  ]);

  return {
    dashboard,
    activitySpaces,
    workedOn,
    viewed,
    assignHistory,
    auditLogs,
    assignmentHistory,
  };
};

const assignmentStatusStyles = {
  done: "bg-green-50 text-green-700 border-green-100",
  in_progress: "bg-blue-50 text-blue-700 border-blue-100",
  need_revision: "bg-red-50 text-red-700 border-red-100",
  pending_review: "bg-amber-50 text-amber-700 border-amber-100",
  new: "bg-gray-100 text-gray-700 border-gray-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200"
};

const formatAssignmentStatus = (status = "") => status.replace(/_/g, " ").toUpperCase();

// Reusable Sub-components for cleaner structure
const UserAvatar = ({
  user,
  sizeClass = "w-9 h-9",
  textClass = "text-[10px]",
  className = "",
}) => {
  const avatarUrl = user?.avatarUrl || user?.avatar_url;
  const label = user?.full_name || user?.name || user?.email || "User";
  return (
    <div
      className={`${sizeClass} rounded-full border-2 border-white flex items-center justify-center ${textClass} font-bold text-white shadow-md overflow-hidden shrink-0 ${className}`}
      style={{ backgroundColor: user?.color || getAvatarColor(user?.user_id || label) }}
      title={label}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={label} className="h-full w-full object-cover" />
      ) : (
        user?.initials || label.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || "--"
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, colorClass, gradientClass, delay, compact = false }) => (
  <div className={`${gradientClass} ${compact ? 'px-5 py-4 rounded-2xl gap-3.5 min-h-[86px]' : 'p-6 rounded-2xl gap-4'} border border-white shadow-sm flex items-center interactive-card animate-card min-w-0`} style={{ animationDelay: delay }}>
    <div className={`${compact ? 'w-11 h-11 rounded-xl' : 'w-12 h-12 rounded-xl'} bg-white/70 flex items-center justify-center ${colorClass} shadow-sm ring-1 ring-white/70 shrink-0`}>
      <span className={`material-symbols-outlined ${compact ? 'text-[23px]' : 'text-[24px]'}`}>{icon}</span>
    </div>
    <div className="min-w-0">
      <p className={`${compact ? 'text-[9px] tracking-[0.09em] whitespace-nowrap' : 'text-[10px] tracking-widest'} font-bold text-[#5e636e] uppercase`}>{label}</p>
      <h3 className={`${compact ? 'text-xl leading-6' : 'text-2xl'} font-black ${label === 'Total Tasks' ? 'text-[#2d1b4e]' : 'text-[#170338]'}`}>{value}</h3>
    </div>
  </div>
);

const ActivityItem = ({ activity, isCompact = true }) => (
  <div className="flex gap-4 group">
    <div
      className={`rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border border-white shadow-sm ${isCompact ? 'w-10 h-10' : 'w-10 h-10 rounded-full'}`}
      style={{ backgroundColor: activity.avatarColor, color: activity.textColor }}
    >
      {activity.avatarUrl ? (
        <img src={activity.avatarUrl} alt={activity.user} className="h-full w-full rounded-xl object-cover" />
      ) : (
        activity.initials
      )}
    </div>
    <div className="flex-1">
      <div className={`flex flex-wrap items-center gap-x-1 behavior-relaxed ${isCompact ? 'text-[13px]' : 'text-[13px]'}`}>
        <span className={`font-bold ${isCompact ? 'text-[#170338]' : 'text-[#4C2B74] hover:underline cursor-pointer'}`}>{activity.user}</span>
        {!isCompact && <span className="text-[#5e636e] mx-1.5">{activity.action}</span>}
        {isCompact && <span className="text-[#5e636e] mx-1">{activity.action}</span>}
        <span className={`status-pill px-2 py-0.5 rounded ${isCompact ? 'rounded-full text-[9px]' : 'text-[10px]'} ${activity.statusColor} font-bold uppercase border whitespace-nowrap`}>
          {activity.status}
        </span>
        {activity.target && (
          <>
            <span className="text-[#5e636e] mx-1">{isCompact ? 'on' : 'on'}</span>
            {!isCompact ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-[14px]">check_box</span> {activity.target}
              </span>
            ) : (
              <span className="font-semibold text-[#1a1c1e] cursor-pointer hover:text-[#4C2B74] underline decoration-gray-200">
                {activity.target}
              </span>
            )}
          </>
        )}
      </div>
      <p className="text-[11px] text-[#5e636e] mt-0.5">{activity.time}</p>
    </div>
  </div>
);

const AuditLogPreviewItem = ({ activity }) => (
  <div className="group flex items-center justify-between gap-4 rounded-xl border border-transparent px-3 py-2.5 transition-all hover:border-purple-100 hover:bg-[#faf7ff]">
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white shadow-sm flex items-center justify-center text-xs font-black"
        style={{ backgroundColor: activity.avatarColor, color: activity.textColor }}
      >
        {activity.avatarUrl ? (
          <img src={activity.avatarUrl} alt={activity.user} className="h-full w-full object-cover" />
        ) : (
          activity.initials
        )}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="max-w-[130px] truncate text-[13px] font-black text-[#170338]">
            {activity.user}
          </span>
          <span className="min-w-0 truncate text-[13px] font-semibold text-[#5e636e]">
            {activity.action}
          </span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] font-semibold text-[#5e636e]">
          <span className="truncate">{activity.time}</span>
          {activity.target && (
            <>
              <span className="h-1 w-1 rounded-full bg-[#c7c4d8]"></span>
              <span className="truncate">{activity.target}</span>
            </>
          )}
        </div>
      </div>
    </div>
    <span className={`shrink-0 status-pill px-2.5 py-1 rounded-full text-[9px] ${activity.statusColor} font-black uppercase border whitespace-nowrap`}>
      {activity.status}
    </span>
  </div>
);

const RecentActivityTimelineItem = ({ activity }) => (
  <div className="flex gap-3 py-1.5">
    <div
      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] font-black text-white"
      style={{ backgroundColor: activity.avatarColor }}
      title={activity.user}
    >
      {activity.avatarUrl ? (
        <img src={activity.avatarUrl} alt={activity.user} className="h-full w-full object-cover" />
      ) : (
        activity.initials
      )}
    </div>
    <div className="min-w-0 flex-1 text-[13px] leading-5 text-[#3f3f46]">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="font-semibold text-[#4f46e5]">{activity.user}</span>
        <span className="text-[#3f3f46]">{activity.action}</span>
        {activity.target && (
          <>
            <span className="text-[#3f3f46]">on</span>
            <span className="inline-flex max-w-full items-center gap-1 rounded border border-[#c7d2fe] bg-white px-1.5 py-0.5 text-[13px] font-medium leading-4 text-[#4f46e5]">
              <span className="material-symbols-outlined text-[14px] leading-none">check_box</span>
              <span className="min-w-0 break-words">{activity.target}</span>
            </span>
          </>
        )}
        {activity.status && (
          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-black leading-3 ${activity.statusColor}`}>
            {activity.status}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[13px] text-[#5e636e]">{activity.relativeTime || activity.time}</div>
    </div>
  </div>
);

const Dashboard = ({ embedded = false, forcedRole = null, spaceMemberCount = 0, spaceId = null, summaryMemberId = null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [hoveredPriority, setHoveredPriority] = useState(null);
  const [hoveredAccount, setHoveredAccount] = useState(null);
  const roleParam = (forcedRole || searchParams.get('role') || 'ADMIN').toUpperCase();
  const isAdmin = !embedded;

  // Modal specific filters
  const [modalSearch, setModalSearch] = useState("");
  const [modalEventType, setModalEventType] = useState("All Events");
  const [modalTimeRange, setModalTimeRange] = useState("All time");
  const [modalSortOrder, setModalSortOrder] = useState("Newest First");
  const [selectedActivitySpaceId, setSelectedActivitySpaceId] = useState("");
  const [activitySpaceSearch, setActivitySpaceSearch] = useState("");
  const [activitySpaceFilterApplied, setActivitySpaceFilterApplied] = useState(false);
  const [showActivitySpaceOptions, setShowActivitySpaceOptions] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedDate, setSelectedDate] = useState("All Dates");

  // Custom Audit Logs specific states
  const [modalLabelTitle, setModalLabelTitle] = useState("All Labels");
  const [modalRowsPerPage, setModalRowsPerPage] = useState(25);
  const [modalPage, setModalPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [superAdminBundle, setSuperAdminBundle] = useState(null);
  const [spaceSummaryDashboard, setSpaceSummaryDashboard] = useState(null);
  const [modalAuditLogResponse, setModalAuditLogResponse] = useState(null);
  const [modalAuditLoading, setModalAuditLoading] = useState(false);
  const [modalAuditError, setModalAuditError] = useState("");
  const [auditLogDetails, setAuditLogDetails] = useState({});
  const [auditLogDetailLoadingId, setAuditLogDetailLoadingId] = useState(null);
  const [auditLogDetailError, setAuditLogDetailError] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    if (!embedded && roleParam === 'USER') {
      navigate(`/dashboard/spaces${getLayoutQueryString(location.search)}`, { replace: true });
    }
  }, [embedded, location.search, navigate, roleParam]);

  useEffect(() => {
    if (!isActivityModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isActivityModalOpen]);

  useEffect(() => {
    if (!isAdmin || !isActivityModalOpen) return;
    let isMounted = true;

    async function loadModalAuditLogs() {
      setModalAuditLoading(true);
      setModalAuditError("");
      try {
        const response = await getSuperAdminAuditLogs({
          page: modalPage,
          page_size: modalRowsPerPage,
          search: modalSearch.trim() || undefined,
          event_type: toApiAuditEventType(modalEventType),
          label_title: toApiAuditLabelTitle(modalLabelTitle),
          sort_order: toApiAuditSortOrder(modalSortOrder),
          ...getAuditDateRangeParams(modalTimeRange),
        });
        if (isMounted) {
          setModalAuditLogResponse(response);
        }
      } catch (error) {
        if (isMounted) {
          setModalAuditError(error?.response?.data?.detail || error?.message || "Could not load audit logs.");
          setModalAuditLogResponse({ total: 0, page: modalPage, page_size: modalRowsPerPage, items: [] });
        }
      } finally {
        if (isMounted) {
          setModalAuditLoading(false);
        }
      }
    }

    loadModalAuditLogs();
    return () => {
      isMounted = false;
    };
  }, [
    isAdmin,
    isActivityModalOpen,
    modalEventType,
    modalLabelTitle,
    modalPage,
    modalRowsPerPage,
    modalSearch,
    modalSortOrder,
    modalTimeRange,
  ]);

  useEffect(() => {
    if (!isAdmin) return;
    let isMounted = true;

    async function loadDashboard() {
      setDashboardLoading(true);
      setDashboardError("");
      try {
        const bundle = await fetchSuperAdminDashboardBundle({ spaceId: selectedActivitySpaceId });
        if (isMounted) {
          setSuperAdminBundle(bundle);
        }
      } catch (error) {
        if (isMounted) {
          setDashboardError(error?.response?.data?.detail || error?.message || "Could not load dashboard data.");
        }
      } finally {
        if (isMounted) {
          setDashboardLoading(false);
        }
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [isAdmin, selectedActivitySpaceId]);

  useEffect(() => {
    if (!embedded || !spaceId) return;
    let isMounted = true;

    async function loadSpaceSummary() {
      setDashboardLoading(true);
      setDashboardError("");
      try {
        const summary = await getSpaceSummaryDashboard(spaceId, {
          member_id: summaryMemberId || undefined,
          activities_page_size: 100,
          tasks_page_size: 100,
          assignment_page_size: 100,
        });
        if (isMounted) {
          setSpaceSummaryDashboard(summary);
        }
      } catch (error) {
        if (isMounted) {
          setDashboardError(error?.response?.data?.detail || error?.message || "Could not load space summary data.");
        }
      } finally {
        if (isMounted) {
          setDashboardLoading(false);
        }
      }
    }

    loadSpaceSummary();
    return () => {
      isMounted = false;
    };
  }, [embedded, spaceId, summaryMemberId]);

  const handleDashboardRefresh = async () => {
    setIsRefreshing(true);
    setModalSearch("");
    setModalEventType("All Events");
    setModalTimeRange("All time");
    setModalSortOrder("Newest First");
    setModalLabelTitle("All Labels");
    setModalPage(1);
    setModalAuditLogResponse(null);
    setModalAuditError("");
    setExpandedLogId(null);
    setDashboardError("");

    try {
      if (isAdmin) {
        const bundle = await fetchSuperAdminDashboardBundle({ spaceId: selectedActivitySpaceId });
        setSuperAdminBundle(bundle);
      } else if (embedded && spaceId) {
        const summary = await getSpaceSummaryDashboard(spaceId, {
          member_id: summaryMemberId || undefined,
          activities_page_size: 100,
          tasks_page_size: 100,
          assignment_page_size: 100,
        });
        setSpaceSummaryDashboard(summary);
      }
    } catch (error) {
      setDashboardError(error?.response?.data?.detail || error?.message || "Could not refresh dashboard data.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAuditLogToggle = async (logId) => {
    if (expandedLogId === logId) {
      setExpandedLogId(null);
      return;
    }

    setExpandedLogId(logId);
    setAuditLogDetailError("");
    if (auditLogDetails[logId]) return;

    setAuditLogDetailLoadingId(logId);
    try {
      const detail = await getSuperAdminAuditLogDetail(logId);
      setAuditLogDetails((current) => ({
        ...current,
        [logId]: mapAuditLog(detail),
      }));
    } catch (error) {
      setAuditLogDetailError(error?.response?.data?.detail || error?.message || "Could not load audit log detail.");
    } finally {
      setAuditLogDetailLoadingId(null);
    }
  };

  // Dashboard route is Super Admin. Embedded Summary can render User or Owner/Super Admin space views.
  const isEmbeddedSummary = embedded;
  const isPrivilegedSpaceSummary = embedded && (roleParam === "OWNER" || roleParam === "SUPER_ADMIN");
  const spaceSummary = spaceSummaryDashboard;
  const summaryStats = [];
  const superAdminDashboard = superAdminBundle?.dashboard;
  const adminAuditLogResponse = superAdminBundle?.auditLogs || superAdminDashboard?.audit_logs;
  const adminAssignmentHistoryResponse = superAdminBundle?.assignmentHistory || superAdminDashboard?.assignment_history;
  const activityCounts = isAdmin
    ? (superAdminBundle?.workedOn?.counts || superAdminDashboard?.activity_counts || {})
    : (spaceSummary?.activity_counts || {});
  const assignHistoryCount = isAdmin
    ? (activitySpaceFilterApplied ? (activityCounts.assign_history ?? adminAssignmentHistoryResponse?.total ?? 0) : 0)
    : (activityCounts.assign_history ?? spaceSummary?.assignment_history?.total ?? 0);
  const activitySpaces = superAdminBundle?.activitySpaces || superAdminDashboard?.activity_spaces || [];
  const activitySpaceTotals = activitySpaces.reduce(
    (totals, space) => ({
      activeMembers: totals.activeMembers + Number(space.active_member_count || 0),
      tasks: totals.tasks + Number(space.task_count || 0),
      assignmentHistory: totals.assignmentHistory + Number(space.assignment_history_count || 0),
    }),
    { activeMembers: 0, tasks: 0, assignmentHistory: 0 },
  );
  const activitySpaceOptions = [
    {
      id: "",
      label: "All Spaces",
      sub: `${activitySpaceTotals.activeMembers} active members - ${activitySpaceTotals.tasks} tasks`,
    },
    ...activitySpaces.map((space) => ({
      id: space.space_id,
      label: space.name_space,
      sub: [
        space.owner?.full_name || space.owner?.email ? `Owner: ${space.owner?.full_name || space.owner?.email}` : null,
        `${space.active_member_count || 0} active members`,
        `${space.task_count || 0} tasks`,
      ].filter(Boolean).join(" - "),
    })),
  ];
  const selectedActivitySpace = activitySpaceOptions.find((space) => space.id === selectedActivitySpaceId) || activitySpaceOptions[0];
  const normalizedActivitySpaceSearch = activitySpaceSearch.trim().toLowerCase();
  const visibleActivitySpaceOptions = activitySpaceOptions.filter((space) => (
    !normalizedActivitySpaceSearch ||
    `${space.label} ${space.sub}`.toLowerCase().includes(normalizedActivitySpaceSearch)
  ));

  useEffect(() => {
    setActivitySpaceSearch(activitySpaceFilterApplied ? selectedActivitySpace?.label || "" : "");
  }, [activitySpaceFilterApplied, selectedActivitySpace?.label]);

  const selectActivitySpace = (space) => {
    setSelectedActivitySpaceId(space.id);
    setActivitySpaceFilterApplied(true);
    setActivitySpaceSearch(space.id ? space.label : "");
    setShowActivitySpaceOptions(false);
  };

  const handleActivitySpaceFilterBlur = () => {
    window.setTimeout(() => {
      setShowActivitySpaceOptions(false);
      setActivitySpaceSearch(activitySpaceFilterApplied ? selectedActivitySpace?.label || "" : "");
    }, 120);
  };

  const handleActivitySpaceFilterKeyDown = (event) => {
    if (event.key === "Escape") {
      setShowActivitySpaceOptions(false);
      setActivitySpaceSearch(activitySpaceFilterApplied ? selectedActivitySpace?.label || "" : "");
      return;
    }
    if (event.key === "Enter" && visibleActivitySpaceOptions.length > 0) {
      event.preventDefault();
      selectActivitySpace(visibleActivitySpaceOptions[0]);
    }
  };

  const priorityBreakdownData = isAdmin
    ? buildPriorityData(superAdminDashboard?.priority_breakdown, [
      { label: 'High', value: 0, color: '#FF8B00', icon: 'keyboard_arrow_up' },
      { label: 'Medium', value: 0, color: '#DE350B', icon: 'drag_handle' },
      { label: 'Low', value: 0, color: '#4C2B74', icon: 'keyboard_arrow_down' }
    ])
    : buildPriorityData(spaceSummary?.priority_breakdown, [
      { label: 'High', value: 0, color: '#FF8B00', icon: 'keyboard_arrow_up' },
      { label: 'Medium', value: 0, color: '#DE350B', icon: 'drag_handle' },
      { label: 'Low', value: 0, color: '#4C2B74', icon: 'keyboard_arrow_down' }
    ]);

  const priorityMaxValue = Math.max(...priorityBreakdownData.map((item) => item.value), 1);
  const yAxisTicks = buildYAxisTicks(priorityMaxValue);
  const maxPriorityValue = Math.max(...yAxisTicks, 1);

  const taskTabs = (isAdmin || isPrivilegedSpaceSummary)
    ? ['Worked on', 'Recently viewed', 'Assign History']
    : ['Worked on', 'Recently viewed', 'Assigned to me'];

  const [activeTaskTab, setActiveTaskTab] = useState(taskTabs[0]);

  // Sync tab when role changes
  useEffect(() => {
    setActiveTaskTab(taskTabs[0]);
  }, [isAdmin]);

  const stats = isAdmin
    ? buildAdminStats(superAdminDashboard?.metrics, adminLoadingStats)
    : buildSpaceSummaryStats(spaceSummary?.metrics, summaryStats, spaceMemberCount);
  const currentActivities = isAdmin
    ? ((adminAuditLogResponse?.items || []).map(mapAuditActivity))
    : (spaceSummary?.recent_activities?.map(mapRecentActivityPreview) || []);
  const recentActivityPreview = currentActivities;
  const recentActivityGroups = ["Today", "Yesterday", "In the last week"];
  const recentActivityDateGroups = recentActivityPreview.reduce((groups, activity) => {
    const heading = formatActivityDateHeading(activity.createdAt || activity.time);
    const existingGroup = groups.find((group) => group.heading === heading);
    if (existingGroup) {
      existingGroup.items.push(activity);
    } else {
      groups.push({ heading, items: [activity] });
    }
    return groups;
  }, []);
  const currentWorkedOnTasks = isAdmin
    ? (superAdminBundle?.workedOn?.items?.map((item) => mapRecentActivityTask(item, true)) || [])
    : (spaceSummary?.recent_tasks?.items?.map((item) => mapRecentActivityTask(item, true, { showSpaceContext: false })) || []);
  const currentViewedTasks = isAdmin
    ? (superAdminBundle?.viewed?.items?.map((item) => mapRecentActivityTask(item, false)) || [])
    : (spaceSummary?.viewed_items?.items?.map((item) => mapRecentActivityTask(item, false, { showSpaceContext: false })) || []);
  const currentAssignedTasks = isAdmin
    ? (adminAssignmentHistoryResponse?.items?.map((item) => mapAssignmentHistory(item)) || [])
    : (isPrivilegedSpaceSummary
      ? (spaceSummary?.assignment_history?.items?.map((item) => mapAssignmentHistory(item, { showSpaceContext: false })) || [])
      : (spaceSummary?.assigned_to_me?.items?.map((item) => mapAssignedToMeActivity(item, { showSpaceContext: false })) || []));
  const viewedCount = isAdmin
    ? (activitySpaceFilterApplied ? (activityCounts.viewed ?? superAdminBundle?.viewed?.total ?? currentViewedTasks.length) : 0)
    : (activityCounts.viewed ?? spaceSummary?.viewed_items?.total ?? currentViewedTasks.length);
  const statusData = isAdmin ? buildStatusData(superAdminDashboard?.task_status_overview, []) : buildStatusData(spaceSummary?.task_status_overview, []);
  const statusLegendData = (() => {
    const indexedItems = statusData.map((item, index) => ({ ...item, index }));
    const positiveItems = indexedItems.filter((item) => item.count > 0);
    if (positiveItems.length) return positiveItems;
    return indexedItems.filter((item) => REPRESENTATIVE_STATUS_KEYS.has(item.key));
  })();
  const totalTasksCount = isAdmin ? (superAdminDashboard?.metrics?.total_tasks ?? superAdminDashboard?.task_status_overview?.total ?? 0) : (spaceSummary?.metrics?.total_tasks ?? 0);
  const pageTitle = embedded ? "Space Summary" : "Dashboard";
  const pageDescription = embedded
    ? "Track task progress, members, recent tasks, and activities in this space."
    : "Track system-wide task progress, user accounts, audit logs, and recent activities.";
  const accountOverviewData = isAdmin
    ? buildAccountOverviewData(superAdminDashboard?.user_account_overview, [])
    : (isPrivilegedSpaceSummary ? buildAccountOverviewData(spaceSummary?.user_account_overview, []) : []);
  const accountOverviewTitle = embedded ? "Space User Overview" : "User Account Overview";
  const accountOverviewDescription = embedded
    ? "Monitor member status and health inside this space."
    : "Monitor the current status and health of user accounts across the system.";
  const renderPriorityBreakdown = (compact = false) => (
    <div className={`glass-card p-8 rounded-2xl flex flex-col w-full ${compact ? 'h-full' : ''}`}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h4 className="text-lg font-bold text-[#170338]">Priority breakdown</h4>
          <p className="text-[#5e636e] text-sm mt-1">Get a holistic view of how work is being prioritized.</p>
        </div>
      </div>

      <div className="relative flex-1 mt-6">
        <div className={`${compact ? 'h-56' : 'h-64'} flex relative`}>
          <div className="flex flex-col justify-between text-[11px] font-bold text-[#5e636e]/60 pr-6 pb-8 border-r border-[#170338]/10 h-full">
            {yAxisTicks.map((tick, i) => (
              <span key={i} className={i === yAxisTicks.length - 1 ? "mb-[-2px]" : ""}>{tick}</span>
            ))}
          </div>

          <div className="flex-1 relative ml-1 h-full">
            <div className="absolute inset-0 bottom-8 border-b border-[#170338]/40">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`w-full border-t border-[#170338]/5`}></div>
                ))}
              </div>

              <div className="absolute inset-x-0 bottom-0 h-full flex items-end justify-around px-2">
                {priorityBreakdownData.map((item, idx) => (
                  <div
                    key={idx}
                    className="group relative flex flex-col items-center w-full h-full justify-end"
                    onMouseEnter={() => setHoveredPriority(item)}
                    onMouseLeave={() => setHoveredPriority(null)}
                  >
                    <div
                      className={`w-14 sm:w-16 transition-all duration-300 rounded-t-sm shadow-sm cursor-pointer bg-[#888995] relative ${hoveredPriority?.label === item.label ? 'scale-x-105 bg-[#4C2B74]' : 'opacity-80 hover:opacity-100'
                        }`}
                      style={{
                        height: `${(item.value / maxPriorityValue) * 100}%`,
                      }}
                    >
                      {hoveredPriority?.label === item.label && item.value > 0 && (
                        <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in zoom-in slide-in-from-bottom-1 duration-200 pointer-events-none">
                          <div className="bg-white border border-gray-100 rounded-xl shadow-2xl p-3 min-w-[90px] flex flex-col items-center gap-1 relative">
                            <span className="text-[9px] font-bold text-[#5e636e] uppercase tracking-wider">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: item.color }}></div>
                              <span className="text-lg font-black text-[#170338]">{item.value}</span>
                            </div>
                            <div className="absolute top-[99%] left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-white"></div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="absolute top-full mt-2 w-0.5 h-3 bg-[#170338]/10"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-around pl-14 mt-6">
          {priorityBreakdownData.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-[#5e636e] group cursor-pointer hover:text-[#170338] transition-colors">
              <span className="material-symbols-outlined text-[16px] font-bold" style={{ color: item.color }}>{item.icon}</span>
              <span className="text-[11px] font-bold">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  const renderUserOverview = (compact = false) => (
    <div className={`glass-card p-8 rounded-2xl flex flex-col w-full ${compact ? 'h-full' : ''}`}>
      <div className="mb-8">
        <h4 className="text-lg font-bold text-[#1a1c1e]">{accountOverviewTitle}</h4>
        <p className="text-sm text-[#5e636e] mt-1 font-medium">
          {accountOverviewDescription}
        </p>
      </div>

      <div className="space-y-6">
        <div className={`${compact ? 'grid grid-cols-[1fr,1.8fr]' : 'grid grid-cols-[1.5fr,2.5fr]'} gap-4 px-2`}>
          <span className="text-[11px] font-black text-[#5e636e] uppercase tracking-widest">Account Status</span>
          <span className="text-[11px] font-black text-[#5e636e] uppercase tracking-widest">User Distribution</span>
        </div>

        <div className="space-y-4">
          {accountOverviewData.map((item, idx) => (
            <div
              key={idx}
              className={`${compact ? 'grid grid-cols-[1fr,1.8fr]' : 'grid grid-cols-[1.5fr,2.5fr]'} gap-4 items-center group cursor-pointer relative`}
              onMouseEnter={() => setHoveredAccount(idx)}
              onMouseLeave={() => setHoveredAccount(null)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm shrink-0 border-2 border-white ring-1 ring-gray-100 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: item.color }}
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                </div>
                <span className="text-sm font-bold text-[#1a1c1e] group-hover:text-[#4C2B74] transition-colors truncate">
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-4 relative">
                <div className="flex-1 h-9 bg-gray-50 rounded-lg overflow-hidden relative shadow-inner border border-gray-100/50">
                  <div
                    className="absolute h-full transition-all duration-1000 ease-out flex items-center justify-end px-3 shadow-lg"
                    style={{
                      width: `${item.percentage}%`,
                      background: item.gradient,
                      boxShadow: `4px 0 12px ${item.glow}`
                    }}
                  >
                    {item.count > 0 && <span className="text-[11px] font-black text-white drop-shadow-sm">{item.count}</span>}
                  </div>
                </div>

                {hoveredAccount === idx && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-[100] animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200 pointer-events-none">
                    <div className="bg-[#1a1c1e] text-white text-[11px] font-bold px-3 py-2 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2 border border-white/10">
                      <span className="text-white/70">{item.percentage}%</span>
                      <span className="w-1 h-1 rounded-full bg-white/30"></span>
                      <span>({item.count}/{item.total} users)</span>
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#1a1c1e]"></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Filtering logic for Admin section
  const getFilteredData = (data) => {
    if (!isAdmin) return data;
    if (!activitySpaceFilterApplied) return [];
    return data.filter(item => {
      const matchSpace = !selectedActivitySpaceId || item.space_id === selectedActivitySpaceId;

      // Filter by Status dropdown
      const matchStatus = selectedStatus === "All Status" || item.status?.replace('_', ' ').toLowerCase() === selectedStatus.toLowerCase();

      // Filter by Date dropdown
      const matchDate = selectedDate === "All Dates" || item.group?.toLowerCase() === selectedDate.toLowerCase();

      return matchStatus && matchDate && matchSpace;
    });
  };

  const filteredWorkedOn = getFilteredData(currentWorkedOnTasks);
  const filteredViewed = getFilteredData(currentViewedTasks);
  const filteredAssigned = getFilteredData(currentAssignedTasks);

  // Custom Audit Logs Filtering & Sorting Logic
  const auditLogRows = isAdmin
    ? ((adminAuditLogResponse?.items || []).map(mapAuditLog))
    : [];
  const auditEventOptions = AUDIT_EVENT_OPTIONS;
  const auditLabelOptions = AUDIT_LABEL_OPTIONS;

  const modalAuditRows = isAdmin
    ? ((modalAuditLogResponse?.items || []).map(mapAuditLog))
    : [];
  const totalAuditLogs = Number(modalAuditLogResponse?.total ?? 0);
  const maxAuditPages = Math.max(1, Math.ceil(totalAuditLogs / modalRowsPerPage));
  const currentAuditPage = Math.min(modalPage, maxAuditPages);
  const auditStartIndex = (currentAuditPage - 1) * modalRowsPerPage;
  const auditEndIndex = totalAuditLogs === 0 ? 0 : Math.min(auditStartIndex + modalAuditRows.length, totalAuditLogs);
  const paginatedAuditLogs = modalAuditLoading ? [] : modalAuditRows;

  return (
    <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 md:px-8 md:pt-5 md:pb-8 space-y-6 custom-scrollbar bg-[#FAFBFF]">
      {/* CSS Styles extracted from the snippet */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;900&display=swap');

        .dashboard-container {
        }

        .glass-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7));
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.03);
          transition: all 0.3s ease;
        }

        .glass-card:hover {
          box-shadow: 0 8px 30px -4px rgba(0, 0, 0, 0.06);
          transform: translateY(-2px);
        }

        .interactive-card {
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          cursor: pointer;
        }

        .interactive-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 30px -5px rgba(0, 0, 0, 0.1);
        }

        .interactive-card:active {
          transform: scale(0.96);
        }

        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .animate-card {
          animation: fadeInScale 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        .donut-segment {
          transition: stroke-width 0.3s ease, opacity 0.3s ease;
          cursor: pointer;
        }

        .donut-segment:hover {
          stroke-width: 6;
          opacity: 0.8;
        }

        .status-pill {
          transition: all 0.2s ease;
          cursor: pointer;
          letter-spacing: 0.02em;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cdd5deff;
          border-radius: 10px;
        }

        .gradient-purple { background: linear-gradient(135deg, #f3ebf7 0%, #ffffff 100%); }
        .gradient-blue { background: linear-gradient(135deg, #e3f2fd 0%, #ffffff 100%); }
        .gradient-green { background: linear-gradient(135deg, #e8f5e9 0%, #ffffff 100%); }
        .gradient-red { background: linear-gradient(135deg, #ffebee 0%, #ffffff 100%); }
        .gradient-indigo { background: linear-gradient(135deg, #e8eaf6 0%, #ffffff 100%); }
        .gradient-amber { background: linear-gradient(135deg, #fff8e1 0%, #ffffff 100%); }

        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /* Audit Log Styles */
        .mb-stack-lg { margin-bottom: 1.5rem; }
        .py-stack-lg { padding-top: 1.5rem; padding-bottom: 1.5rem; }
        .gap-stack-lg { gap: 1.5rem; }
        .px-margin-page { padding-left: 2rem; padding-right: 2rem; }
        .max-w-container-max { max-width: 1440px; }
        
        /* Font styles */
        .font-headline-md { font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 600; line-height: 32px; letter-spacing: -0.01em; }
        .font-body-md { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; }
        .font-body-sm { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 400; line-height: 18px; }
        .font-label-sm { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; letter-spacing: 0.05em; }
        .font-label-md { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; line-height: 20px; }
        
        /* Border and Colors */
        .border-outline-variant { border: 1px solid #c7c4d8; }
        .border-r-outline-variant { border-right: 1px solid #c7c4d8; }
        .border-b-outline-variant { border-bottom: 1px solid #c7c4d8; }
        .bg-surface-container-low { background-color: #f5f2ff; }
        .bg-surface-container-lowest { background-color: #ffffff; }
        .text-on-surface-variant { color: #464555; }
        
        .divide-outline-variant\/30 > :not([hidden]) ~ :not([hidden]) {
          border-color: rgba(199, 196, 216, 0.3);
        }
        
        th.border-r, td.border-r {
          border-right-width: 1px;
          border-right-color: #c7c4d8;
        }

        .table-row-hover:hover {
          background-color: rgba(245, 242, 255, 0.4);
        }
      `}</style>

      {/* Activity Modal / Audit Log Table */}
      {isActivityModalOpen && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden p-4 sm:p-6 bg-[#170338]/40 backdrop-blur-sm animate-in fade-in duration-300">
          {isAdmin ? (
            <div className="bg-white w-full max-w-[1240px] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 relative">
              {/* TOP CLOSE BUTTON */}
              <div className="absolute top-6 right-6 z-50">
                <button
                  type="button"
                  onClick={() => setIsActivityModalOpen(false)}
                  className="w-10 h-10 rounded-xl hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[24px]">close</span>
                </button>
              </div>

              {/* MAIN CONTENT */}
              <div className="flex-1 flex flex-col overflow-hidden p-5 lg:p-6">
                {/* Header & Description */}
                <div className="mb-4 pr-12">
                  <h2 className="font-headline-md text-on-surface font-bold text-[30px] text-black">Audit Logs</h2>
                  <p className="font-body-md text-on-surface-variant mt-1">Stay up to date with what's happening across the space.</p>
                </div>

                {/* Filter & Search Section */}
                <section className="border border-outline-variant rounded-xl p-4 mb-4 shadow-sm bg-slate-100 lg:p-5">
                  <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end justify-between">
                    {/* Search Bar */}
                    <div className="w-full flex flex-col gap-1 flex-grow">
                      <label className="font-label-sm px-1 text-black font-bold">Search Logs</label>
                      <div className="relative group">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline transition-colors group-focus-within:text-[#0052CC]">search</span>
                        <input
                          value={modalSearch}
                          onChange={(e) => { setModalSearch(e.target.value); setModalPage(1); }}
                          type="text"
                          placeholder="Search by User, Action, or Log ID..."
                          className="w-full pl-10 pr-4 py-2 bg-white border border-outline-variant rounded-lg focus:border-slate-600 focus:ring-0 transition-all font-body-md"
                        />
                      </div>
                    </div>
                    {/* Refresh Button */}
                    <button
                      type="button"
                      onClick={handleDashboardRefresh}
                      className="flex min-w-[128px] items-center justify-center gap-2 whitespace-nowrap px-5 py-2 text-white rounded-lg active:scale-[0.98] transition-all font-label-md shadow-sm w-full lg:w-auto bg-[#2D1B4E] hover:bg-[#2D1B4E]/90 cursor-pointer"
                    >
                      <span className={`material-symbols-outlined text-[20px] ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
                      Refresh
                    </button>
                  </div>

                  {/* Secondary Filters */}
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-4">
                    {/* Date Range Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm px-1 text-black font-bold">Date Range</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">calendar_today</span>
                        <select
                          value={modalTimeRange}
                          onChange={(e) => { setModalTimeRange(e.target.value); setModalPage(1); }}
                          className="w-full appearance-none bg-white border border-outline-variant rounded-lg py-2 pl-10 pr-10 font-body-md focus:border-slate-600 focus:ring-0 transition-all cursor-pointer hover:bg-slate-100"
                        >
                          {AUDIT_DATE_RANGE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">expand_more</span>
                      </div>
                    </div>
                    {/* Event Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm px-1 text-black font-bold">Event Type</label>
                      <div className="relative">
                        <select
                          value={modalEventType}
                          onChange={(e) => { setModalEventType(e.target.value); setModalPage(1); }}
                          className="w-full appearance-none bg-white border border-outline-variant rounded-lg py-2 pl-4 pr-10 font-body-md focus:border-slate-600 focus:ring-0 transition-all cursor-pointer hover:bg-slate-100"
                        >
                          {auditEventOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">expand_more</span>
                      </div>
                    </div>
                    {/* Entity Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm px-1 text-black font-bold">Label Title</label>
                      <div className="relative">
                        <select
                          value={modalLabelTitle}
                          onChange={(e) => { setModalLabelTitle(e.target.value); setModalPage(1); }}
                          className="w-full appearance-none bg-white border border-outline-variant rounded-lg py-2 pl-4 pr-10 font-body-md focus:border-slate-600 focus:ring-0 transition-all cursor-pointer hover:bg-slate-100"
                        >
                          {auditLabelOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">expand_more</span>
                      </div>
                    </div>
                    {/* Sort Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm px-1 text-black font-bold">Sort Order</label>
                      <div className="relative">
                        <select
                          value={modalSortOrder}
                          onChange={(e) => { setModalSortOrder(e.target.value); setModalPage(1); }}
                          className="w-full appearance-none bg-white border border-outline-variant rounded-lg py-2 pl-4 pr-10 font-body-md focus:border-slate-600 focus:ring-0 transition-all cursor-pointer hover:bg-slate-100"
                        >
                          <option value="Newest First">Newest First</option>
                          <option value="Oldest First">Oldest First</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">expand_more</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Audit Table Section */}
                <section className="border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col bg-white flex-1 min-h-0">
                  <div className="flex-1 overflow-auto relative custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead className="border-b border-outline-variant sticky top-0 z-20 bg-slate-200">
                        <tr>
                          <th className="px-6 py-2 pb-2.5 font-label-sm tracking-wider uppercase whitespace-nowrap text-black font-bold border-r text-center">ID</th>
                          <th className="px-6 py-2 pb-2.5 font-label-sm tracking-wider uppercase whitespace-nowrap text-black font-bold border-r text-center">User</th>
                          <th className="px-6 py-2 pb-2.5 font-label-sm tracking-wider uppercase whitespace-nowrap text-black font-bold border-r text-center">Role</th>
                          <th className="px-6 py-2 pb-2.5 font-label-sm tracking-wider uppercase whitespace-nowrap text-black font-bold border-r text-center">Event</th>
                          <th className="px-6 py-2 pb-2.5 font-label-sm tracking-wider uppercase whitespace-nowrap text-black font-bold border-r text-center">Label Title</th>
                          <th className="px-6 py-2 pb-2.5 font-label-sm tracking-wider uppercase whitespace-nowrap text-black font-bold border-r text-center">CREATED AT</th>
                          <th className="px-6 py-2 pb-2.5 font-label-sm tracking-wider uppercase whitespace-nowrap text-black font-bold text-center">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/30">
                        {paginatedAuditLogs.length === 0 && (
                          <tr>
                            <td className="px-6 py-10 text-center text-sm font-semibold text-[#5e636e]" colSpan={7}>
                              {modalAuditLoading ? 'Loading audit logs...' : modalAuditError || 'No audit logs found.'}
                            </td>
                          </tr>
                        )}
                        {paginatedAuditLogs.map((log) => {
                          const isExpanded = expandedLogId === log.id;
                          const detailLog = auditLogDetails[log.id] || log;
                          const isDetailLoading = auditLogDetailLoadingId === log.id;
                          return (
                            <React.Fragment key={log.id}>
                              <tr className="table-row-hover transition-colors group border-b-0">
                                <td className="px-6 font-mono text-body-sm whitespace-nowrap py-2 border-r text-black">{log.id}</td>
                                <td className="px-6 whitespace-nowrap py-2 border-r">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs overflow-hidden" style={{ backgroundColor: log.avatarBg }}>
                                      {log.avatarUrl ? (
                                        <img src={log.avatarUrl} alt={log.user} className="h-full w-full object-cover" />
                                      ) : (
                                        log.initials
                                      )}
                                    </div>
                                    <div className="font-body-md font-semibold text-black">{log.user}</div>
                                  </div>
                                </td>
                                <td className="px-6 font-body-sm whitespace-nowrap py-2 border-r text-black">{log.role}</td>
                                <td className="px-6 font-body-md text-on-surface font-medium whitespace-nowrap py-2 border-r">
                                  <span className="text-[#3525cd] font-semibold">{log.event}</span>
                                </td>
                                <td className="px-6 whitespace-nowrap py-2 border-r">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-tight ${log.labelTitle === 'User' ? 'bg-blue-100 text-blue-700' :
                                    log.labelTitle === 'Task' ? 'bg-teal-100 text-teal-700' :
                                      log.labelTitle === 'Token' ? 'bg-slate-200 text-slate-700' :
                                        log.labelTitle === 'Attachment' ? 'bg-blue-100 text-blue-700' :
                                          'bg-slate-200 text-slate-700'
                                    }`}>
                                    {log.labelTitle}
                                  </span>
                                </td>
                                <td className="px-6 font-mono text-body-sm whitespace-nowrap py-2 border-r text-black">{log.createdAt}</td>
                                <td className="px-6 text-center whitespace-nowrap py-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAuditLogToggle(log.id)}
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded bg-surface-container-low border border-outline-variant text-[#3525cd] font-label-sm transition-colors hover:bg-slate-200 cursor-pointer"
                                  >
                                    <span className={`material-symbols-outlined text-[18px] ${isDetailLoading ? 'animate-spin' : ''}`}>
                                      {isExpanded ? 'visibility_off' : 'visibility'}
                                    </span>
                                    {isDetailLoading ? 'Loading' : isExpanded ? 'Hide' : 'View'}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-surface-container-lowest">
                                  <td className="px-6 py-4" colSpan={7}>
                                    <div className="rounded-lg border border-outline-variant bg-slate-100 p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-label-md text-black font-semibold">Log Payload</h4>
                                        <span className="text-[11px] font-mono text-on-surface-variant">{log.id}</span>
                                      </div>
                                      <pre className="font-mono text-xs text-on-surface-variant bg-white p-4 rounded border border-outline-variant overflow-x-auto leading-relaxed shadow-sm">
                                        {isDetailLoading
                                          ? 'Loading audit log detail...'
                                          : auditLogDetailError
                                            ? auditLogDetailError
                                            : JSON.stringify(detailLog.payload, null, 2)}
                                      </pre>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer / Pagination */}
                  <div className="px-6 py-4 border-t border-outline-variant flex flex-col md:flex-row items-center gap-6 bg-white md:justify-end">
                    <div className="flex items-center gap-6 text-black">
                      <div className="flex items-center gap-3">
                        <span className="font-label-md text-on-surface-variant text-sm font-medium">Rows per page</span>
                        <div className="relative">
                          <select
                            value={modalRowsPerPage}
                            onChange={(e) => {
                              setModalRowsPerPage(parseInt(e.target.value));
                              setModalPage(1);
                            }}
                            className="bg-surface-container-lowest border border-[#c7c4d8] rounded-lg py-1 pl-2 pr-4 font-body-sm text-on-surface focus:border-slate-600 focus:ring-0 transition-all cursor-pointer hover:bg-slate-100 text-sm"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 border-l border-[#c7c4d8]/40 pl-6">
                        <span className="font-label-md text-on-surface-variant text-sm font-medium">Page</span>
                        <input
                          type="number"
                          min={1}
                          max={maxAuditPages}
                          value={currentAuditPage}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val >= 1 && val <= maxAuditPages) {
                              setModalPage(val);
                            }
                          }}
                          className="w-12 text-center bg-surface-container-lowest border border-[#c7c4d8] rounded-lg py-1 px-1.5 font-body-sm text-on-surface focus:border-slate-600 focus:ring-0 transition-all appearance-none"
                        />
                        <span className="font-label-md text-on-surface-variant text-sm font-medium">of {maxAuditPages}</span>
                      </div>
                      <span className="font-body-sm text-on-surface-variant border-l border-[#c7c4d8]/40 pl-6 text-sm">
                        Showing <span className="font-semibold text-on-surface">{totalAuditLogs === 0 ? 0 : auditStartIndex + 1}-{auditEndIndex}</span> of <span className="font-semibold text-on-surface">{totalAuditLogs}</span> logs
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="bg-white w-full max-w-[760px] max-h-[82vh] rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
              <div className="px-6 pt-6 pb-3 flex items-start justify-between bg-white shrink-0">
                <div>
                  <h3 className="text-base font-bold text-[#2f3136] tracking-tight">
                    Recent activity</h3>
                  <p className="text-sm text-[#4b5563] mt-0.5">
                    Stay up to date with what's happening across the space.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActivityModalOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-[#5e636e] transition-colors"
                >
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar px-6 pb-7 pt-2">
                <div className="space-y-5">
                  {recentActivityPreview.length === 0 && (
                    <div className="rounded-lg border border-gray-100 bg-white/70 p-5 text-sm font-semibold text-[#5e636e]">
                      {dashboardLoading ? 'Loading recent activity...' : 'No recent activity found.'}
                    </div>
                  )}
                  {recentActivityDateGroups.map((group) => {
                    return (
                      <div key={group.heading} className="space-y-2">
                        <p className="text-[12px] font-bold text-[#2f3136]">{group.heading}</p>
                        <div className="space-y-1">
                          {group.items.map((activity, idx) => (
                            <RecentActivityTimelineItem key={`${group.heading}-${activity.targetId || activity.target || 'activity'}-${idx}`} activity={activity} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      <div className={`dashboard-container ${embedded ? 'space-y-4' : 'space-y-6'}`}>
        {/* Page Title & KPI Banner */}
        <div className={embedded ? 'space-y-3' : 'space-y-4'}>
          {!embedded && (
          <div>
            <h2 className="text-2xl font-bold text-[#4C2B74]">{pageTitle}</h2>
            <p className="text-sm text-gray-500">{pageDescription}</p>
          </div>
          )}

          {(dashboardError || (dashboardLoading && (isAdmin ? !superAdminBundle : !spaceSummaryDashboard))) && (
            <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${dashboardError ? 'border-red-100 bg-red-50 text-red-700' : 'border-purple-100 bg-purple-50 text-[#4C2B74]'}`}>
              {dashboardError || (isAdmin ? 'Loading dashboard data...' : 'Loading space summary data...')}
            </div>
          )}

          {/* KPI Cards */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${stats.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} ${embedded ? 'gap-4' : 'gap-6'} ${embedded && stats.length < 5 ? 'xl:max-w-6xl xl:mx-auto' : ''}`}>
            {stats.map((kpi, idx) => (
              <StatCard key={idx} {...kpi} compact={embedded} />
            ))}
          </div>
        </div>

        {/* 2x2 Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Overview (Top Left) */}
          <div className={`glass-card rounded-2xl flex flex-col ${isEmbeddedSummary ? 'p-6 min-h-[340px]' : 'p-8 h-full'}`}>
            <div className={isEmbeddedSummary ? 'mb-4' : 'mb-6'}>
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-[#170338]">Status Overview</h4>
                <Link to={`/dashboard/spaces${getLayoutQueryString(location.search)}`} className="text-[#170338] text-xs font-bold hover:underline">View all</Link>
              </div>
              <p className="text-[#5e636e] text-sm mt-1">Snapshot of your work item statuses.</p>
            </div>
            <div className={`flex flex-col lg:flex-row items-center justify-around flex-1 ${isEmbeddedSummary ? 'gap-4 py-1' : 'gap-6 py-4'}`}>
              <div className={`relative cursor-pointer ${isEmbeddedSummary ? 'w-44 h-44' : 'w-56 h-56'}`}>
                {/* Tooltip Overlay - Absolute to this container */}
                {hoveredSegment !== null && (
                  <div
                    className="absolute z-[100] bg-white border border-gray-200 shadow-[0_8px_24px_rgba(0,0,0,0.12)] rounded-[4px] px-3 py-2 flex items-center gap-2.5 whitespace-nowrap pointer-events-none"
                    style={{
                      left: statusData[hoveredSegment].tPos.left,
                      top: statusData[hoveredSegment].tPos.top,
                      transform: 'translate(-50%, -100%)'
                    }}
                  >
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: statusData[hoveredSegment].color }}></div>
                    <span className="text-sm font-semibold text-[#42526E]">{statusData[hoveredSegment].label} &nbsp; {statusData[hoveredSegment].count}</span>
                  </div>
                )}

                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 36 36"
                >
                  <circle cx="18" cy="18" fill="transparent" r="15.915" stroke="#F1F5F9" strokeWidth="4"></circle>
                  {statusData.map((item, index) => (
                    <circle
                      key={index}
                      className={`donut-segment cursor-pointer transition-all duration-300 ${hoveredSegment === index ? 'opacity-100 scale-[1.02]' : (hoveredSegment !== null ? 'opacity-30' : 'opacity-100')}`}
                      cx="18"
                      cy="18"
                      fill="transparent"
                      r="15.915"
                      stroke={item.color}
                      strokeDasharray={`${item.dash} 100`}
                      strokeDashoffset={item.offset}
                      strokeLinecap="butt"
                      strokeWidth="4.5"
                      onMouseEnter={() => setHoveredSegment(index)}
                      onMouseLeave={() => setHoveredSegment(null)}
                      style={{ transformOrigin: 'center' }}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className={`${isEmbeddedSummary ? 'text-3xl' : 'text-4xl'} text-[#1a1c1e] font-bold tracking-tight`}>{totalTasksCount}</span>
                  <p className="text-[11px] text-[#5e636e] font-bold mt-1 text-center leading-tight">Total tasks</p>
                </div>
              </div>
              <div className="space-y-3">
                {statusLegendData.map((item) => (
                  <div
                    key={item.key || item.index}
                    className={`flex items-center gap-3 cursor-pointer p-1.5 rounded-lg transition-all ${hoveredSegment === item.index ? 'bg-gray-50 translate-x-1' : ''}`}
                    onMouseEnter={() => setHoveredSegment(item.index)}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    <div className="w-3 h-3 rounded-full transition-transform shadow-sm" style={{ backgroundColor: item.color, transform: hoveredSegment === item.index ? 'scale(1.25)' : 'scale(1)' }}></div>
                    <span className={`text-xs font-bold transition-colors ${hoveredSegment === item.index ? 'text-[#4C2B74]' : 'text-[#5e636e]'}`}>
                      {item.label}: {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Audit Logs (SUPER ADMIN) */}
          <div className={`glass-card rounded-2xl flex flex-col ${isEmbeddedSummary ? 'p-6 min-h-0' : 'p-8 h-full'}`}>
            <div className={`${isEmbeddedSummary ? 'mb-3' : 'mb-6'} flex justify-between items-start`}>
              <div>
                <h4 className="text-lg font-bold text-[#170338]">{isAdmin ? "Audit Logs" : "Recent Activity"}</h4>
                <p className="text-[#5e636e] text-sm mt-1">
                  {isAdmin ? "Track user actions, security events, and system changes." : "Stay up to date with what's happening across the space."}
                </p>
              </div>
              <button
                onClick={() => setIsActivityModalOpen(true)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-[#5e636e] transition-colors"
              >
                <span className="material-symbols-outlined text-lg">open_in_full</span>
              </button>
            </div>
            <div className={`relative ${isEmbeddedSummary ? 'min-h-0' : 'flex-1 min-h-0'}`}>
              <div className={`overflow-y-auto custom-scrollbar pr-1 ${isEmbeddedSummary ? 'space-y-3 max-h-[265px] pb-1' : 'space-y-4 max-h-[400px]'}`}>
              {recentActivityPreview.length === 0 && (
                <div className="rounded-xl border border-gray-100 bg-white/70 p-6 text-sm font-semibold text-[#5e636e]">
                  {dashboardLoading ? (isAdmin ? 'Loading audit logs...' : 'Loading recent activity...') : (isAdmin ? 'No audit logs found.' : 'No recent activity found.')}
                </div>
              )}
              {recentActivityGroups.map((group) => {
                const groupActivities = recentActivityPreview.filter(a => a.group === group);
                if (groupActivities.length === 0) return null;
                return (
                  <div key={group} className={isEmbeddedSummary ? 'space-y-3' : 'space-y-2'}>
                    <p className="px-3 text-[10px] font-black text-[#5e636e] uppercase tracking-widest">{group}</p>
                    {groupActivities.map((activity, idx) => (
                      isAdmin ? (
                        <AuditLogPreviewItem key={idx} activity={activity} />
                      ) : (
                        <ActivityItem key={idx} activity={activity} isCompact={true} />
                      )
                    ))}
                  </div>
                );
              })}
              </div>
              {isEmbeddedSummary && recentActivityPreview.length > 4 && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
              )}
            </div>
          </div>
        </div>

        {isPrivilegedSpaceSummary && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {renderPriorityBreakdown(true)}
            {renderUserOverview(true)}
          </div>
        )}

        {/* Priority Breakdown */}
        <div className={`glass-card rounded-2xl flex flex-col w-full ${embedded ? 'p-6' : 'p-8'} ${isPrivilegedSpaceSummary ? 'hidden' : ''}`}>
          <div className={`${embedded ? 'mb-4' : 'mb-6'} flex items-center justify-between`}>
            <div>
              <h4 className="text-lg font-bold text-[#170338]">Priority breakdown</h4>
              <p className="text-[#5e636e] text-sm mt-1">Get a holistic view of how work is being prioritized.</p>
            </div>
          </div>

          <div className={`relative flex-1 ${embedded ? 'mt-3' : 'mt-6'}`}>
            <div className={`flex ${embedded ? 'h-44' : 'h-64'} relative`}>
              {/* Y-Axis */}
              <div className="flex flex-col justify-between text-[11px] font-bold text-[#5e636e]/60 pr-6 pb-8 border-r border-[#170338]/10 h-full">
                {yAxisTicks.map((tick, i) => (
                  <span key={i} className={i === yAxisTicks.length - 1 ? "mb-[-2px]" : ""}>{tick}</span>
                ))}
              </div>

              <div className="flex-1 relative ml-1 h-full">
                {/* 1. Vùng lưới và trục ngang (Plot Area) */}
                <div className="absolute inset-0 bottom-8 border-b border-[#170338]/40">
                  {/* Các đường kẻ ngang */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className={`w-full border-t border-[#170338]/5`}></div>
                    ))}
                  </div>

                  {/* 2. Container chứa các cột ('HIGH','MEDIUM','LOW')*/}
                  <div className="absolute inset-x-0 bottom-0 h-full flex items-end justify-around px-2">
                    {priorityBreakdownData.map((item, idx) => (
                      <div
                        key={idx}
                        className="group relative flex flex-col items-center w-full h-full justify-end"
                        onMouseEnter={() => setHoveredPriority(item)}
                        onMouseLeave={() => setHoveredPriority(null)}
                      >
                        {/* Cột dữ liệu - Bây giờ chứa Tooltip để căn chỉnh chuẩn xác */}
                        <div
                          className={`w-14 sm:w-16 transition-all duration-300 rounded-t-sm shadow-sm cursor-pointer bg-[#888995] relative ${hoveredPriority?.label === item.label ? 'scale-x-105 bg-[#4C2B74]' : 'opacity-80 hover:opacity-100'
                            }`}
                          style={{
                            height: `${(item.value / maxPriorityValue) * 100}%`,
                          }}
                        >
                          {/* Popover khi hover - Gắn trực tiếp vào đầu cột */}
                          {hoveredPriority?.label === item.label && item.value > 0 && (
                            <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in zoom-in slide-in-from-bottom-1 duration-200 pointer-events-none">
                              <div className="bg-white border border-gray-100 rounded-xl shadow-2xl p-3 min-w-[90px] flex flex-col items-center gap-1 relative">
                                <span className="text-[9px] font-bold text-[#5e636e] uppercase tracking-wider">{item.label}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: item.color }}></div>
                                  <span className="text-lg font-black text-[#170338]">{item.value}</span>
                                </div>
                                <div className="absolute top-[99%] left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-white"></div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Vạch nhỏ dưới chân cột */}
                        <div className="absolute top-full mt-2 w-0.5 h-3 bg-[#170338]/10"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Legend / X-Axis Labels ('HIGH','MEDIUM','LOW')*/}
            <div className={`flex justify-around pl-14 ${embedded ? 'mt-4' : 'mt-6'}`}>
              {priorityBreakdownData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-[#5e636e] group cursor-pointer hover:text-[#170338] transition-colors">
                  <span className="material-symbols-outlined text-[16px] font-bold" style={{ color: item.color }}>{item.icon}</span>
                  <span className="text-[11px] font-bold">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Conditionally render User Account Overview */}
        {isAdmin && (
          <div className="glass-card p-8 rounded-2xl flex flex-col w-full">
            {/* User Account Overview (SUPER ADMIN ONLY) */}
            <div className="mb-8">
              <h4 className="text-lg font-bold text-[#1a1c1e]">User Account Overview</h4>
              <p className="text-sm text-[#5e636e] mt-1 font-medium">
                Monitor the current status and health of user accounts across the system.
              </p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-[1.5fr,2.5fr] gap-4 px-2">
                <span className="text-[11px] font-black text-[#5e636e] uppercase tracking-widest">Account Status</span>
                <span className="text-[11px] font-black text-[#5e636e] uppercase tracking-widest">User Distribution</span>
              </div>

              <div className="space-y-4">
                {accountOverviewData.length === 0 && (
                  <div className="rounded-xl border border-gray-100 bg-white/70 p-6 text-sm font-semibold text-[#5e636e]">
                    {dashboardLoading ? 'Loading user account data...' : 'No user account data found.'}
                  </div>
                )}
                {accountOverviewData.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1.5fr,2.5fr] gap-4 items-center group cursor-pointer relative"
                    onMouseEnter={() => setHoveredAccount(idx)}
                    onMouseLeave={() => setHoveredAccount(null)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm shrink-0 border-2 border-white ring-1 ring-gray-100 group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: item.color }}
                      >
                        <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                      </div>
                      <span className="text-sm font-bold text-[#1a1c1e] group-hover:text-[#4C2B74] transition-colors truncate">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 relative">
                      <div className="flex-1 h-9 bg-gray-50 rounded-lg overflow-hidden relative shadow-inner border border-gray-100/50">
                        <div
                          className="absolute h-full transition-all duration-1000 ease-out flex items-center justify-end px-3 shadow-lg"
                          style={{
                            width: `${item.percentage}%`,
                            background: item.gradient,
                            boxShadow: `4px 0 12px ${item.glow}`
                          }}
                        >
                          <span className="text-[11px] font-black text-white drop-shadow-sm">{item.count}</span>
                        </div>
                      </div>


                      {/* Account Tooltip */}
                      {hoveredAccount === idx && (
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-[100] animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200 pointer-events-none">
                          <div className="bg-[#1a1c1e] text-white text-[11px] font-bold px-3 py-2 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2 border border-white/10">
                            <span className="text-white/70">{item.percentage}%</span>
                            <span className="w-1 h-1 rounded-full bg-white/30"></span>
                            <span>({item.count}/{item.total} users)</span>
                          </div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#1a1c1e]"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}



        <div className={`glass-card rounded-2xl flex flex-col w-full ${isAdmin ? 'min-h-[520px] overflow-visible' : 'overflow-hidden'}`}>
          <div className={`flex-1 ${isAdmin ? 'overflow-visible' : 'overflow-y-auto custom-scrollbar'}`}>
            {isAdmin ? (
              <div className="p-8 pb-4 border-b border-gray-100 bg-white sticky top-0 z-20">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <h3 className="text-lg font-bold text-[#170338] pb-2 lg:pb-3">Recent Activities</h3>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:justify-end">
                    {/* Space Filter */}
                    <div className="relative w-full sm:w-[320px] lg:w-[360px]">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-[#5e636e] mb-2">Space</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">workspaces</span>
                        <input
                          value={activitySpaceSearch}
                          onChange={(e) => {
                            setActivitySpaceSearch(e.target.value);
                            setShowActivitySpaceOptions(true);
                          }}
                          onFocus={() => {
                            setShowActivitySpaceOptions(true);
                            setShowStatusFilter(false);
                            setShowDateFilter(false);
                          }}
                          onBlur={handleActivitySpaceFilterBlur}
                          onKeyDown={handleActivitySpaceFilterKeyDown}
                          disabled={dashboardLoading && activitySpaces.length === 0}
                          placeholder={dashboardLoading && activitySpaces.length === 0 ? "Loading spaces..." : "Filter by space name..."}
                          className={`w-full h-12 rounded-xl border bg-white pl-12 pr-12 text-sm font-bold outline-none transition-all disabled:cursor-wait disabled:bg-gray-50 ${selectedActivitySpaceId
                            ? "border-[#4C2B74] text-[#4C2B74] bg-purple-50"
                            : "border-gray-200 text-[#5e636e] hover:border-[#4C2B74] hover:text-[#4C2B74] hover:bg-purple-50/10 focus:border-gray-300 focus:text-[#170338]"
                            }`}
                        />
                        {activitySpaceFilterApplied ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedActivitySpaceId("");
                              setActivitySpaceFilterApplied(false);
                              setActivitySpaceSearch("");
                              setShowActivitySpaceOptions(false);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg text-gray-400 transition-colors hover:bg-purple-50 hover:text-[#4C2B74]"
                            title="Clear space filter"
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        ) : (
                          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-[20px] pointer-events-none">expand_more</span>
                        )}
                        {showActivitySpaceOptions && !(dashboardLoading && activitySpaces.length === 0) && (
                          <div className="absolute left-0 right-0 top-full mt-2 z-[120] max-h-72 overflow-y-auto rounded-xl border border-gray-100 bg-white p-2 shadow-xl">
                            {visibleActivitySpaceOptions.length === 0 ? (
                              <div className="px-3 py-4 text-sm font-semibold text-[#5e636e]">No spaces found.</div>
                            ) : (
                              visibleActivitySpaceOptions.map((space) => (
                                <button
                                  key={space.id || "all-spaces"}
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    selectActivitySpace(space);
                                  }}
                                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${selectedActivitySpaceId === space.id ? "bg-gray-50 text-[#170338]" : "text-[#170338] hover:bg-gray-50"}`}
                                >
                                  <span className="block truncate text-sm font-black">{space.label}</span>
                                  <span className="block truncate text-[11px] font-semibold text-[#5e636e]">{space.sub}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Dropdown */}
                    <div className="relative">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-[#5e636e] mb-2">Status</label>
                        <button
                          onClick={() => {
                            setShowStatusFilter(!showStatusFilter);
                            setShowDateFilter(false);
                            setShowActivitySpaceOptions(false);
                          }}
                          className={`flex h-12 items-center justify-between gap-2 min-w-[140px] px-4 rounded-xl border transition-all text-sm font-bold ${selectedStatus !== "All Status"
                            ? "border-[#4C2B74] text-[#4C2B74] bg-purple-50"
                            : "border-gray-200 text-[#5e636e] hover:border-[#4C2B74] hover:text-[#4C2B74] hover:bg-purple-50/10 bg-white"
                            }`}
                        >
                          <span className="truncate">{selectedStatus}</span>
                          <span className={`material-symbols-outlined text-gray-400 transition-transform ${showStatusFilter ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>
                        {showStatusFilter && (
                          <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl z-[100] p-2 animate-in fade-in zoom-in-95 duration-200">
                            {['All Status', 'New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done', 'Cancelled'].map(st => (
                              <button
                                key={st}
                                onClick={() => { setSelectedStatus(st); setShowStatusFilter(false); }}
                                className="flex items-center gap-3 w-full p-2.5 hover:bg-gray-50 rounded-xl text-sm font-bold text-[#5e636e] transition-colors"
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>

                    {/* Date Dropdown */}
                    <div className="relative">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-[#5e636e] mb-2">Date</label>
                        <button
                          onClick={() => {
                            setShowDateFilter(!showDateFilter);
                            setShowStatusFilter(false);
                            setShowActivitySpaceOptions(false);
                          }}
                          className={`flex h-12 items-center justify-between gap-2 min-w-[150px] px-4 rounded-xl border transition-all text-sm font-bold ${selectedDate !== "All Dates"
                            ? "border-[#4C2B74] text-[#4C2B74] bg-purple-50"
                            : "border-gray-200 text-[#5e636e] hover:border-[#4C2B74] hover:text-[#4C2B74] hover:bg-purple-50/10 bg-white"
                            }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="material-symbols-outlined text-gray-400 text-lg">calendar_today</span>
                            {selectedDate}
                          </div>
                          <span className={`material-symbols-outlined text-gray-400 transition-transform ${showDateFilter ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>
                        {showDateFilter && (
                          <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl z-[100] p-2 animate-in fade-in zoom-in-95 duration-200">
                            {['All Dates', 'Today', 'Yesterday', 'In the last week'].map(d => (
                              <button
                                key={d}
                                onClick={() => { setSelectedDate(d); setShowDateFilter(false); }}
                                className="flex items-center gap-3 w-full p-2.5 hover:bg-gray-50 rounded-xl text-sm font-bold text-[#5e636e] transition-colors"
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="px-8 py-5 border-b border-gray-100 bg-white sticky top-0 z-20">
                  <h3 className="text-lg font-bold text-[#170338]">Recent Tasks</h3>
                </div>

              </>
            )}

            {/* Role-based Interactive Tabs */}
            <div className={`px-8 border-b border-gray-100 flex gap-6 bg-white sticky ${embedded ? 'top-0' : 'top-[72px]'} z-10 overflow-x-auto no-scrollbar`}>
              {taskTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTaskTab(tab)}
                  className={`py-4 text-[13px] transition-all relative whitespace-nowrap ${activeTaskTab === tab
                    ? 'font-bold text-[#4C2B74]'
                    : 'font-medium text-[#5e636e] hover:text-[#2d1b4e]'
                    }`}
                >
                  {tab}
                  {(() => {
                    const assignedToMeCount = activityCounts.assigned_to_me ?? spaceSummary?.assigned_to_me?.total ?? currentAssignedTasks.length;
                    const tabCount = tab === 'Recently viewed' ? viewedCount : tab === 'Assign History' ? assignHistoryCount : tab === 'Assigned to me' ? assignedToMeCount : 0;
                    return tabCount > 0 ? (
                      <span className="ml-1.5 bg-gray-100/80 text-gray-400 text-[10px] px-1.5 py-0.5 rounded-full font-black">
                        {tabCount}
                      </span>
                    ) : null;
                  })()}
                  {activeTaskTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#4C2B74] rounded-t-full shadow-[0_-2px_8px_rgba(76,43,116,0.15)] animate-in fade-in slide-in-from-bottom-2 duration-300"></div>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content Body */}
            <div className="min-h-[140px]">
              {/* 1. Worked On Tab */}
              {activeTaskTab === 'Worked on' && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                  {filteredWorkedOn.length === 0 && (
                    <div className="px-8 py-10 text-sm font-semibold text-[#5e636e]">
                      {isAdmin && !activitySpaceFilterApplied ? 'Select a space or All Spaces to view worked on activities.' : dashboardLoading ? 'Loading worked on activities...' : 'No worked on activities found.'}
                    </div>
                  )}
                  {["TODAY", "YESTERDAY", "IN THE LAST WEEK"].map(group => {
                    const groupTasks = filteredWorkedOn.filter(t => t.group === group);
                    if (groupTasks.length === 0) return null;
                    return (
                      <div key={group}>
                        <div className="px-8 py-3 bg-gray-50/50 border-b border-gray-50/50">
                          <p className="text-[10px] font-black text-[#5e636e] uppercase tracking-widest">{group}</p>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {groupTasks.map((task, idx) => (
                            <div key={idx} className="px-8 py-6 flex items-center justify-between hover:bg-[#f9f1fc]/40 transition-all cursor-pointer group/item">
                              <div className="flex items-center gap-4">
                                <div className="w-7 h-7 rounded-lg bg-[#eef2ff] border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm group-hover/item:scale-110 transition-transform">
                                  <span className="material-symbols-outlined text-[18px] font-bold">check_box</span>
                                </div>
                                <div className="min-w-0 pr-4">
                                  <h5 className="font-bold text-[#170338] text-[14px] group-hover/item:text-[#4C2B74] transition-colors line-clamp-1">{task.title}</h5>
                                  <p className="text-[11px] text-[#5e636e] mt-1 font-medium">{task.subtitle}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-8 shrink-0">
                                <div className="text-right whitespace-nowrap">
                                  <p className="text-[10px] text-[#5e636e] font-medium">Updated</p>
                                  <p className="text-[10px] font-black text-[#170338] uppercase tracking-tight">{task.time || ""}</p>
                                </div>
                                <div className="flex items-center">
                                  {(isAdmin || isPrivilegedSpaceSummary) && task.assignees ? (
                                    <div className="flex -space-x-3 hover:space-x-1 transition-all duration-300">
                                      {task.assignees.map((assignee, aIdx) => (
                                        <UserAvatar
                                          key={aIdx}
                                          user={assignee}
                                          className="transition-transform hover:scale-110 hover:z-10"
                                        />
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. Recently viewed Tab */}
              {activeTaskTab === 'Recently viewed' && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                  {filteredViewed.length === 0 && (
                    <div className="px-8 py-10 text-sm font-semibold text-[#5e636e]">
                      {isAdmin && !activitySpaceFilterApplied ? 'Select a space or All Spaces to view recently viewed items.' : dashboardLoading ? 'Loading recently viewed items...' : 'No recently viewed items found.'}
                    </div>
                  )}
                  {["Today", "Yesterday", "In the last week"].map(group => {
                    const groupTasks = filteredViewed.filter(t => t.group === group);
                    if (groupTasks.length === 0) return null;
                    return (
                      <div key={group}>
                        <div className="px-8 py-3 bg-gray-50/50 border-b border-gray-50">
                          <p className="text-[10px] font-black text-[#5e636e] uppercase tracking-widest">{group}</p>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {groupTasks.map((task, idx) => (
                            <div key={idx} className="px-8 py-5 flex items-center gap-4 hover:bg-[#f9f1fc]/40 transition-all cursor-pointer group">
                              <div className="w-6 h-6 rounded-md bg-[#eef2ff] border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-[16px] font-bold">{task.icon}</span>
                              </div>
                              <div>
                                <h5 className="font-bold text-[#170338] text-[13.5px] group-hover:text-[#4C2B74] transition-colors">{task.title}</h5>
                                <p className="text-[11px] text-[#5e636e] mt-0.5 font-medium">{task.subtitle}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3. Assign History */}
              {(activeTaskTab === 'Assigned to me' || activeTaskTab === 'Assign History') && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                  {(isAdmin || isPrivilegedSpaceSummary) ? (
                    <div>
                      <div className="hidden xl:block px-8 py-3 bg-gradient-to-r from-[#faf7ff] via-white to-[#f8fafc] border-y border-[#ede7f6] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                        <div className={`grid ${isAdmin ? 'grid-cols-[minmax(260px,1.4fr),minmax(260px,1.2fr),minmax(180px,0.8fr),120px]' : 'grid-cols-[280px_minmax(360px,1fr)_260px_90px]'} gap-6 items-center`}>
                          {[
                            { label: "Task", icon: "assignment" },
                            { label: "Assignee Change", icon: "compare_arrows" },
                            { label: "Changed By", icon: "manage_accounts" },
                            { label: "Status", icon: "verified", align: "justify-end" },
                          ].map(column => (
                            <div key={column.label} className={`flex items-center gap-2 ${column.align || ""}`}>
                              <span className="w-6 h-6 rounded-lg bg-white border border-[#e9ddf5] text-[#4C2B74] shadow-sm flex items-center justify-center material-symbols-outlined text-[15px]">
                                {column.icon}
                              </span>
                              <span className="text-[10px] font-black text-[#4C2B74] uppercase tracking-[0.16em]">
                                {column.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="divide-y divide-gray-50">
                        {filteredAssigned.length === 0 && (
                          <div className="px-8 py-10 text-sm font-semibold text-[#5e636e]">
                            {isAdmin && !activitySpaceFilterApplied ? 'Select a space or All Spaces to view assignment history.' : dashboardLoading ? 'Loading assignment history...' : 'No assignment history found.'}
                          </div>
                        )}
                        {filteredAssigned.map((task, idx) => {
                          const statusClass = assignmentStatusStyles[task.status] || "bg-gray-100 text-gray-700 border-gray-200";
                          const isScopedAdminActivity = isAdmin && Boolean(selectedActivitySpaceId);
                          return (
                            <div key={task.assignment_history_id || idx} className="px-8 py-5 hover:bg-[#f9f1fc]/40 transition-all cursor-pointer group">
                              <div className={`grid grid-cols-1 ${isAdmin ? 'xl:grid-cols-[minmax(260px,1.4fr),minmax(260px,1.2fr),minmax(180px,0.8fr),120px]' : 'xl:grid-cols-[280px_minmax(360px,1fr)_260px_90px]'} gap-5 xl:gap-6 items-start xl:items-center`}>
                                <div className={`flex items-start min-w-0 ${isAdmin ? 'gap-4' : 'gap-0'}`}>
                                  {isAdmin && (
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-sm group-hover:scale-105 transition-transform bg-amber-50 text-amber-600 border-amber-100">
                                      <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <h5 className="font-bold text-[#170338] text-[13.5px] group-hover:text-[#4C2B74] transition-colors truncate">
                                        {task.task_title || task.title}
                                      </h5>
                                    </div>
                                    {task.space_name && !isScopedAdminActivity && (
                                      <p className="text-[11px] text-[#5e636e] mt-1 font-semibold truncate">{task.space_name}</p>
                                    )}
                                    {(task.assignment_history_id || task.task_id) && (
                                      <p className="mt-1 text-[10px] font-black tracking-wide text-[#8c8c8c]">
                                        {task.assignment_history_id && <span>{task.assignment_history_id}</span>}
                                        {task.assignment_history_id && task.task_id && <span className="mx-1.5 text-[#c7bfd0]">/</span>}
                                        {task.task_id && <span>{task.task_id}</span>}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-3 min-w-0">
                                    {[task.previous_assignee, task.new_assignee].map((person, personIdx) => (
                                      <React.Fragment key={`${task.assignment_history_id}-${personIdx}`}>
                                        <div className="flex items-center gap-2 min-w-0">
                                          <UserAvatar user={person} sizeClass="w-8 h-8" textClass="text-[10px]" className="shadow-sm" />
                                          <span className="text-[12px] font-bold text-[#170338] truncate">{person?.full_name || "Unassigned"}</span>
                                        </div>
                                        {personIdx === 0 && (
                                          <span className="material-symbols-outlined text-[18px] text-[#5e636e] shrink-0">arrow_forward</span>
                                        )}
                                      </React.Fragment>
                                    ))}
                                  </div>
                                  {task.reason && (
                                    <p className="text-[11px] text-[#5e636e] mt-2 line-clamp-1">{task.reason}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 min-w-0">
                                  <UserAvatar user={task.changed_by} sizeClass="w-8 h-8" textClass="text-[10px]" className="shadow-sm" />
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-bold text-[#170338] truncate">{task.changed_by?.full_name || "Unknown"}</p>
                                    <p className="text-[10px] text-[#5e636e] font-semibold truncate">{task.changed_at}</p>
                                  </div>
                                </div>

                                <div className="flex xl:justify-end">
                                  <span className={`px-2.5 py-1 rounded-md text-[9px] font-black border uppercase whitespace-nowrap ${statusClass}`}>
                                    {formatAssignmentStatus(task.status)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
                      {filteredAssigned.length === 0 && (
                        <div className="px-8 py-10 text-sm font-semibold text-[#5e636e]">
                          {dashboardLoading ? 'Loading assigned tasks...' : 'No assigned tasks found.'}
                        </div>
                      )}
                      {["IN PROGRESS", "IN REVIEW", "TO DO"].map(group => {
                        const groupTasks = filteredAssigned.filter(t => t.group === group);
                        if (groupTasks.length === 0) return null;
                        return (
                          <div key={group}>
                            <div className="px-8 py-3 bg-gray-50/50 border-b border-gray-50/50">
                              <p className="text-[10px] font-black text-[#5e636e] uppercase tracking-widest">{group}</p>
                            </div>
                            <div className="divide-y divide-gray-50">
                              {groupTasks.map((task, idx) => (
                                <div key={idx} className="px-8 py-5 flex items-center justify-between hover:bg-[#f9f1fc]/40 transition-all cursor-pointer group/item">
                                  <div className="flex items-center gap-4">
                                    <div className="w-6 h-6 rounded-md bg-[#eef2ff] border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm group-hover/item:scale-110 transition-transform">
                                      <span className="material-symbols-outlined text-[16px] font-bold">check_box</span>
                                    </div>
                                    <div className="min-w-0 pr-4">
                                      <h5 className="font-bold text-[#170338] text-[13.5px] group-hover/item:text-[#4C2B74] transition-colors line-clamp-1">{task.title}</h5>
                                      <p className="text-[11px] text-[#5e636e] mt-1 font-medium">{task.subtitle}</p>
                                    </div>
                                  </div>
                                  <span className="text-[12px] font-medium text-[#5e636e] shrink-0">{task.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div> </div>
  );
};
export default Dashboard;
