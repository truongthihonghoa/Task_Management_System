import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useOutletContext, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import SprintInfoPopover from '../components/tasks/SprintInfoPopover';
import CompleteSprintModal from '../components/tasks/CompleteSprintModal';
import EditSprintModal from '../components/tasks/EditSprintModal';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import DeleteTaskModal from '../components/tasks/DeleteTaskModal';
import Dashboard from './Dashboard';
import { DEMO_SPACES } from './SpaceManagement';
import axiosClient, { API_BASE_URL } from '../api/axiosClient';

const availableAssignees = [
  { name: 'Unassigned', initials: '', color: '#8e8f90', icon: 'person', textColor: '#FFFFFF' },
  { name: 'Pham Tien', initials: 'PT', color: '#2f3650', textColor: '#FFFFFF' },
  { name: 'Hoang Hoa', initials: 'HH', color: '#F97316', textColor: '#FFFFFF' },
  { name: 'Trong Nghia', initials: 'TN', color: '#14B8A6', textColor: '#FFFFFF' },
  { name: 'Trang Nguyen', initials: 'TN', color: '#7C3AED', textColor: '#FFFFFF' }
];

const projectPeopleDirectory = [
  { id: 'pham-tien', name: 'Pham Tien', email: 'pham.tien@example.com', initials: 'PT', color: '#2f3650', textColor: '#FFFFFF' },
  { id: 'hoang-hoa', name: 'Hoang Hoa', email: 'hoanghoa@example.com', initials: 'HH', color: '#F97316', textColor: '#FFFFFF' },
  { id: 'trong-nghia', name: 'Trong Nghia', email: 'trongnghia@example.com', initials: 'TN', color: '#14B8A6', textColor: '#FFFFFF' },
  { id: 'trang-nguyen', name: 'Trang Nguyen', email: 'trangnguyen@example.com', initials: 'TN', color: '#7C3AED', textColor: '#FFFFFF' }
];

const getApiBaseUrl = () => (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const getAccessToken = () => {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('access_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('token')
  );
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

const parseNonNegativeStoryPoints = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const points = Number(value);
  return Number.isFinite(points) && points >= 0 ? points : null;
};

const addPeopleRequest = async (spaceId, person) => {
  const token = getAccessToken();
  const response = await fetch(`${getApiBaseUrl()}/api/v1/spaces/${spaceId}/people`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      email: person.email,
      name: person.name,
    }),
  });

  if (!response.ok) {
    let message = 'Unable to add this person.';
    try {
      const body = await response.json();
      message = body.message || body.detail || message;
    } catch {
      // Keep fallback for non-JSON errors.
    }
    throw new Error(message);
  }

  return response.json();
};

const assigneeProfiles = {
  'Pham Tien': { initials: 'PT', color: '#2f3650', textColor: '#FFFFFF' },
  'Hoang Hoa': { initials: 'HH', color: '#F97316', textColor: '#FFFFFF' },
  'Trong Nghia': { initials: 'TN', color: '#14B8A6', textColor: '#FFFFFF' },
  'Trang Nguyen': { initials: 'TN', color: '#7C3AED', textColor: '#FFFFFF' },
  'Unassigned': { initials: 'UN', color: '#8e8f90', textColor: '#FFFFFF' }
};

const getInitials = (name) => {
  if (!name) return 'UN';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return 'UN';
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
};

const getAssigneeProfile = (assignee) => {
  if (!assignee) return assigneeProfiles['Unassigned'];
  return assigneeProfiles[assignee] || {
    initials: getInitials(assignee),
    color: '#9CA3AF',
    textColor: '#FFFFFF'
  };
};

const AssigneeAvatar = ({ user = {}, sizeClass = 'w-6 h-6', textClass = 'text-[10px]', className = '' }) => {
  const avatarUrl = user.avatarUrl || user.avatar_url || '';
  const name = user.name || user.full_name || 'Unassigned';
  return (
    <span
      className={`${sizeClass} ${className} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ${textClass}`}
      style={{ backgroundColor: user.color || '#9CA3AF', color: user.textColor || '#FFFFFF' }}
      title={name}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        user.initials || getInitials(name)
      )}
    </span>
  );
};

const getInitialProjectPeople = (space) => {
  const assignedPeople = availableAssignees
    .slice(1)
    .map(assignee => projectPeopleDirectory.find(person => person.name === assignee.name))
    .filter(Boolean);

  if (!space) return assignedPeople;

  const spacePeopleIds = [space.ownerId, ...(space.memberIds || [])].filter(Boolean);
  const spacePeople = spacePeopleIds
    .map(id => projectPeopleDirectory.find(person => person.id === id))
    .filter(Boolean);

  return [...spacePeople, ...assignedPeople].filter((person, index, people) =>
    people.findIndex(item => item.id === person.id) === index
  );
};

const getNextTaskId = (tasks) => {
  const maxTaskNumber = tasks.reduce((max, task) => {
    const match = /^TM-(\d+)$/.exec(task.id || '');
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `TM-${maxTaskNumber + 1}`;
};

const formatTaskDate = (dateValue) => {
  const date = dateValue ? new Date(dateValue) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

const isCompletedTaskStatus = (status) => {
  const normalizedStatus = String(status || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  return ['done', 'cancelled'].includes(normalizedStatus);
};

const isTaskOverdue = (dateValue, status, apiOverdue = undefined) => {
  if (!dateValue || isCompletedTaskStatus(status)) return false;
  if (typeof apiOverdue === 'boolean') return apiOverdue;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  const dueDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return dueDate < todayDate;
};

const isTaskDueToday = (dateValue, status, apiDueToday = undefined) => {
  if (!dateValue || isCompletedTaskStatus(status)) return false;
  if (typeof apiDueToday === 'boolean') return apiDueToday;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  const dueDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return dueDate.getTime() === todayDate.getTime();
};

const DUE_TODAY_TEXT_CLASS = 'text-[#92400E]';
const DUE_TODAY_BADGE_CLASS = 'bg-[#FEF3C7] text-[#92400E]';
const DUE_TODAY_BORDER_CLASS = 'border-[#FCD34D]';
const OVERDUE_TEXT_CLASS = 'text-[#BA1A1A]';
const OVERDUE_BADGE_CLASS = 'bg-[#FFF0F0] text-[#BA1A1A]';
const OVERDUE_BORDER_CLASS = 'border-[#FCA5A5]';

const SPRINT_NAME_PREFIX = 'SCRUM Sprint';

const TASK_STATUS_TO_API = {
  New: 'new',
  'In Progress': 'in_progress',
  'In Testing': 'in_testing',
  'Pending Review': 'pending_review',
  'Need Revision': 'need_revision',
  Done: 'done',
  Cancelled: 'cancelled',
};

const TASK_STATUS_FROM_API = Object.fromEntries(
  Object.entries(TASK_STATUS_TO_API).map(([label, value]) => [value, label])
);

const TASK_PRIORITY_TO_API = {
  High: 'HIGH',
  Medium: 'MEDIUM',
  Low: 'LOW',
};

const TASK_PRIORITY_FROM_API = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

const ASSIGNEE_COLORS = ['#2f3650', '#F97316', '#14B8A6', '#7C3AED', '#2563EB', '#059669', '#DB2777'];

const getErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail || error?.response?.data?.message;
  if (Array.isArray(detail)) {
    return detail.map(item => item?.msg || String(item)).join(', ') || fallback;
  }
  return detail || error?.message || fallback;
};

const formatSprintDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) return '';
  const format = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  return [format(startDate), format(endDate)].filter(Boolean).join(' - ');
};

const mapApiSprint = (sprint) => ({
  id: sprint.sprint_id,
  name: sprint.name || 'SCRUM Sprint',
  dateRange: formatSprintDateRange(sprint.start_date, sprint.end_date),
  startDate: sprint.start_date || '',
  endDate: sprint.end_date || '',
  duration: sprint.duration_weeks || 2,
  goal: sprint.goal || '',
  autoStart: Boolean(sprint.auto_start),
  autoComplete: Boolean(sprint.auto_complete),
  status: sprint.status || 'Planned',
  tasks: [],
  raw: sprint,
});

const mapApiUserSummary = (user, index = 0) => {
  const name = user?.full_name || user?.name || user?.email || 'Unknown User';
  const avatarUrl = normalizeAvatarUrl(user?.avatar_url || user?.avatarUrl || user?.avatar || '');
  return {
    id: user?.user_id || user?.id || '',
    user_id: user?.user_id || user?.id || '',
    name,
    email: user?.email || '',
    initials: user?.initials || getInitials(name),
    color: user?.color || ASSIGNEE_COLORS[index % ASSIGNEE_COLORS.length],
    textColor: user?.textColor || '#FFFFFF',
    avatar_url: avatarUrl,
    avatarUrl,
    icon: user?.icon,
  };
};

const mapApiSpaceMember = (member, index = 0) => ({
  ...mapApiUserSummary(member.user || { user_id: member.user_id }, index),
  role: member.role,
  memberStatus: member.status,
  spaceMemberId: member.space_member_id,
});

const mapApiTaskAssignee = (entry, index = 0) => {
  const assigneeId = entry.assignee_id || entry.assigneeId || '';
  return {
    entryId: entry.assignee_entry_id || entry.entryId,
    assignee_entry_id: entry.assignee_entry_id || entry.entryId,
    taskId: entry.task_id || entry.taskId,
    assigneeId,
    assignee_id: assigneeId,
    assignedAt: entry.assignee_at || entry.assignedAt,
    assignee_at: entry.assignee_at || entry.assignedAt,
    user: mapApiUserSummary(entry.assignee || entry.user || { user_id: assigneeId }, index),
    raw: entry.raw || entry,
  };
};

const buildTaskAssigneeUpdates = (assigneeEntries = []) => {
  const assignees = assigneeEntries.map(mapApiTaskAssignee);
  const primaryAssignee = assignees[0] || null;
  const assigneeNames = assignees
    .map(entry => entry.user?.name)
    .filter(Boolean);

  return {
    assignees,
    assignee: assigneeNames.join(', '),
    assigneeId: primaryAssignee?.assigneeId || '',
  };
};

const getTaskAssigneeUsers = (task = {}) => {
  const users = (task.assignees || [])
    .map(entry => entry.user)
    .filter(user => user?.user_id || user?.id || user?.name);

  if (users.length > 0) return users;
  if (task.assignee || task.assigneeId) {
    return [{
      id: task.assigneeId || '',
      user_id: task.assigneeId || '',
      name: task.assignee || '',
      initials: getInitials(task.assignee),
      ...getAssigneeProfile(task.assignee),
    }];
  }
  return [];
};

const getCompactAssigneeName = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Unassigned';
  return parts[parts.length - 1];
};

const formatAssigneeSummary = (users = [], visibleCount = 2) => {
  if (!users.length) {
    return {
      shortText: 'Unassigned',
      fullText: 'Unassigned',
    };
  }

  const names = users.map(user => user.name).filter(Boolean);
  if (names.length <= 1) {
    return {
      shortText: names[0] || 'Unassigned',
      fullText: names[0] || 'Unassigned',
    };
  }

  const shownNames = names.slice(0, visibleCount).map(getCompactAssigneeName);
  const remainingCount = Math.max(names.length - visibleCount, 0);
  return {
    shortText: `${shownNames.join(', ')}${remainingCount > 0 ? ` +${remainingCount}` : ''}`,
    fullText: names.join(', '),
  };
};

const taskHasAssigneeName = (task, assigneeName) =>
  getTaskAssigneeUsers(task).some(user => user.name === assigneeName);

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (/^(blob:|data:|https?:\/\/)/i.test(url)) return url;
  if (!url.startsWith('/media/')) return url;

  if (/^https?:\/\//i.test(API_BASE_URL)) {
    try {
      return `${new URL(API_BASE_URL).origin}${url}`;
    } catch {
      return url;
    }
  }

  return url;
};

const mapApiAttachment = (attachment) => ({
  ...attachment,
  url: resolveMediaUrl(attachment.url || attachment.storage_url || ''),
  previewUrl: resolveMediaUrl(attachment.previewUrl || attachment.url || attachment.storage_url || ''),
});

const mapApiTask = (task) => {
  const assigneeUpdates = buildTaskAssigneeUpdates(
    task.primary_assignee && !(task.assignees || []).length
      ? [task.primary_assignee]
      : (task.assignees || [])
  );

  return {
    id: task.task_id,
    taskId: task.task_id,
    spaceId: task.space_id,
    sprintId: task.sprint_id,
    sprint: task.sprint?.name || task.sprint_name || '',
    title: task.title || 'Untitled task',
    assignee: assigneeUpdates.assignee,
    assigneeId: assigneeUpdates.assigneeId,
    assignees: assigneeUpdates.assignees,
    pts: Number(task.story_points) || 0,
    status: TASK_STATUS_FROM_API[task.task_status] || task.task_status || 'New',
    priority: TASK_PRIORITY_FROM_API[task.priority] || task.priority || 'Medium',
    completed_at: task.completed_at || '',
    date: formatTaskDate(task.completed_at || task.created_at),
    createdAt: formatTaskDate(task.created_at),
    created_at: task.created_at,
    updated_at: task.updated_at,
    description: task.description || '',
    is_overdue: Boolean(task.is_overdue),
    is_due_today: Boolean(task.is_due_today),
    attachments: (task.attachments || []).map(mapApiAttachment),
    comments: task.comments || [],
    assignmentHistory: task.assignment_history || [],
    creatorId: task.creator_id,
    creator: task.creator_name || task.creator?.full_name || '',
    raw: task,
  };
};

const formatScopedTaskId = (sequence) => `TSK${String(sequence).padStart(8, '0')}`;

const getTaskSequenceTime = (task) => {
  const timestamp = Date.parse(task.created_at || task.createdAt || task.date || '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const assignScopedTaskDisplayIds = (tasks) => {
  const groups = new Map();

  tasks.forEach((task, originalIndex) => {
    const key = task.spaceId || 'default';
    const groupTasks = groups.get(key) || [];
    groupTasks.push({ task, originalIndex });
    groups.set(key, groupTasks);
  });

  const displayIdsByIndex = new Map();
  groups.forEach((groupTasks) => {
    [...groupTasks]
      .sort((a, b) => {
        const createdDiff = getTaskSequenceTime(a.task) - getTaskSequenceTime(b.task);
        if (createdDiff !== 0) return createdDiff;
        return String(a.task.id || '').localeCompare(String(b.task.id || ''));
      })
      .forEach((entry, index) => {
        displayIdsByIndex.set(entry.originalIndex, formatScopedTaskId(index + 1));
      });
  });

  return tasks.map((task, index) => ({
    ...task,
    displayId: displayIdsByIndex.get(index) || task.displayId || task.id,
    rawTaskId: task.rawTaskId || task.id,
  }));
};

const getSprintNumber = (sprintName) => {
  const match = new RegExp(`^${SPRINT_NAME_PREFIX}\\s+(\\d+)$`, 'i').exec(sprintName || '');
  return match ? Number(match[1]) : 0;
};

const getNextSprintNumber = (sprints) => {
  const maxSprintNumber = sprints.reduce((max, sprint) => {
    return Math.max(max, getSprintNumber(sprint.name));
  }, 0);

  return maxSprintNumber + 1;
};

export default function TaskManagement({ routeContext = null, spaceIdOverride = null } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { spaceId: routeSpaceId } = useParams();
  const [taskSearchParams, setTaskSearchParams] = useSearchParams();
  const routeTaskId = taskSearchParams.get('taskId');

  const outletContext = useOutletContext() || {};
  const {
    setShowCreateModal,
    setTasksForModal,
    setCreateTaskHandler,
    setSprintsForModal,
    setCreateTaskInitialSprint,
    setAssigneesForModal,
    setCurrentSpaceNameForModal,
    currentRole = 'ADMIN',
    currentUser,
    currentSpaceRole = 'USER'
  } = routeContext || outletContext;

  const spaceId = spaceIdOverride || routeSpaceId;
  const isAdmin = currentRole === 'ADMIN';
  const selectedSpace = DEMO_SPACES.find(space => space.id === spaceId);
  const [apiSpace, setApiSpace] = useState(null);
  const projectOwnerId = selectedSpace?.ownerId;
  const pageTitle = apiSpace?.title || selectedSpace?.title || 'Task Management';
  const [view, setView] = useState('list');
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [showToolbarStatusMenu, setShowToolbarStatusMenu] = useState(false);
  const [isSprintExpanded, setIsSprintExpanded] = useState(true);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);

  // Sprint popover and complete modal states
  const [isSprintInfoOpen, setIsSprintInfoOpen] = useState(false);
  const [isCompleteSprintOpen, setIsCompleteSprintOpen] = useState(false);
  const [completeSprintTarget, setCompleteSprintTarget] = useState(null);
  const sprintInfoAnchorRef = useRef(null);
  const boardScrollRef = useRef(null);
  const boardAutoScrollFrameRef = useRef(null);
  const dragPointerXRef = useRef(null);
  const isBoardDraggingRef = useRef(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(5); // June
  const [viewYear, setViewYear] = useState(2026);
  const dateFilterRef = useRef(null);

  const getDaysInMonth = (year, month) => {
    const days = [];
    const startDay = new Date(year, month, 1).getDay();
    const numDays = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= numDays; d++) days.push(d);
    return days;
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Dynamic sprints are scoped by space so each space starts from SCRUM Sprint 1.
  const sprintSpaceKey = spaceId || 'default-space';
  const [extraSprintsBySpace, setExtraSprintsBySpace] = useState({});
  const extraSprints = extraSprintsBySpace[sprintSpaceKey] || [];
  const setExtraSprints = useCallback((updater) => {
    setExtraSprintsBySpace(prev => {
      const currentSprints = prev[sprintSpaceKey] || [];
      const nextSprints = typeof updater === 'function' ? updater(currentSprints) : updater;
      return { ...prev, [sprintSpaceKey]: nextSprints };
    });
  }, [sprintSpaceKey]);
  const [expandedSprints, setExpandedSprints] = useState({});
  // Which sprint's ... menu is open (null = none, 'sprint-1' = Sprint 1, sprint.id = extra sprint)
  const [openSprintMenuId, setOpenSprintMenuId] = useState(null);

  // Sprint 1 data (editable)
  const [sprint1Data, setSprint1Data] = useState({
    id: 'sprint-1',
    name: 'SCRUM Sprint 1',
    dateRange: '18 Jun – 2 Jul',
    startDate: '2026-06-18T00:00',
    duration: 2,
    goal: '',
    autoStart: false,
    autoComplete: false,
  });

  // Edit Sprint modal states
  const [isEditSprintOpen, setIsEditSprintOpen] = useState(false);
  const [sprintToEdit, setSprintToEdit] = useState(null);

  // Delete Sprint confirm states
  const [deleteSprintConfirmId, setDeleteSprintConfirmId] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState('');
  const [taskSearchQuery, setTaskSearchQuery] = useState('');

  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState('All');
  const [openAssigneeFilterMenu, setOpenAssigneeFilterMenu] = useState(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('All');
  const [sortOption, setSortOption] = useState('created-newest');
  const [projectPeople, setProjectPeople] = useState(() => getInitialProjectPeople(selectedSpace));
  const [pendingPeopleEmails, setPendingPeopleEmails] = useState([]);
  const [addPeopleFeedback, setAddPeopleFeedback] = useState('');
  const [addingPeopleEmail, setAddingPeopleEmail] = useState('');
  const [isAddPeopleOpen, setIsAddPeopleOpen] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState('');
  const addPeopleButtonRef = useRef(null);
  const addPeoplePanelRef = useRef(null);
  const summaryAssigneeFilterRef = useRef(null);
  const toolbarAssigneeFilterRef = useRef(null);
  const isSpaceOwner = currentSpaceRole === 'OWNER';
  const isSpaceMember = currentSpaceRole === 'USER';
  const canModifyTasks = !isAdmin;
  const canManageTasks = isSpaceOwner;
  const canManagePeople = isSpaceOwner || isSpaceMember;
  const canSelectTasks = canModifyTasks || canManageTasks;
  const canDirectAddPeople = isSpaceOwner;
  const projectAssigneeOptions = React.useMemo(() => [
    { ...availableAssignees[0], id: '', user_id: '' },
    ...projectPeople.map(person => ({
      id: person.id || person.user_id,
      user_id: person.user_id || person.id,
      name: person.name,
      initials: person.initials || getInitials(person.name),
      color: person.color || '#5E4DB2',
      textColor: person.textColor || '#FFFFFF',
      avatar_url: person.avatar_url || person.avatarUrl || '',
      avatarUrl: person.avatarUrl || person.avatar_url || '',
    })),
  ], [projectPeople]);

  useEffect(() => {
    if (!openAssigneeFilterMenu) return;

    const handleClickOutside = (event) => {
      const clickedSummaryFilter = summaryAssigneeFilterRef.current?.contains(event.target);
      const clickedToolbarFilter = toolbarAssigneeFilterRef.current?.contains(event.target);
      if (clickedSummaryFilter || clickedToolbarFilter) return;
      setOpenAssigneeFilterMenu(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openAssigneeFilterMenu]);

  const handleSelectAssigneeFilter = (filterValue) => {
    setSelectedAssigneeFilter(filterValue);
    setOpenAssigneeFilterMenu(null);
  };

  useEffect(() => {
    if (setCurrentSpaceNameForModal) {
      setCurrentSpaceNameForModal(pageTitle);
    }
  }, [pageTitle, setCurrentSpaceNameForModal]);

  const loadTaskData = useCallback(async () => {
    if (!spaceId) {
      setTasks([]);
      setApiSpace(null);
      return;
    }

    setIsLoadingTasks(true);
    setTasksError('');

    try {
      const [spaceResponse, sprintResponse, taskResponse, memberResponse] = await Promise.all([
        axiosClient.get(`/spaces/${spaceId}`),
        axiosClient.get(`/spaces/${spaceId}/sprints`),
        axiosClient.get(`/spaces/${spaceId}/tasks`, {
          params: {
            page: 1,
            page_size: 100,
            active_sprint_only: false,
          },
        }),
        axiosClient.get(`/spaces/${spaceId}/members`),
      ]);

      const nextSpace = spaceResponse.data;
      const nextSprints = (sprintResponse.data || []).map(mapApiSprint);
      const orderedSprints = nextSprints.filter(sprint => sprint.status !== 'Deleted');
      const firstSprint = orderedSprints[0] || null;
      const remainingSprints = firstSprint
        ? orderedSprints.slice(1)
        : [];
      const nextTasks = assignScopedTaskDisplayIds((taskResponse.data?.items || []).map(mapApiTask));
      const nextMembers = (memberResponse.data || [])
        .filter(member => member.status === 'Active')
        .map(mapApiSpaceMember);

      setApiSpace({
        id: nextSpace.space_id,
        title: nextSpace.name_space || 'Task Management',
        ownerId: nextSpace.owner_id,
        status: nextSpace.status_space,
      });
      setProjectPeople(nextMembers);
      setTasks(nextTasks);
      setSelectedTasks([]);

      if (firstSprint) {
        setSprint1Data({
          ...firstSprint,
          dateRange: firstSprint.dateRange || 'No dates set',
        });
        setIsSprintExpanded(firstSprint.status !== 'Completed');
      } else {
        setSprint1Data(prev => ({
          ...prev,
          id: '',
          name: 'No sprint available',
          dateRange: 'Create a sprint before adding tasks',
          status: 'Planned',
        }));
        setIsSprintExpanded(true);
      }
      setExtraSprints(remainingSprints.map(sprint => ({
        ...sprint,
        tasks: nextTasks.filter(task => task.sprintId === sprint.id),
      })));
      setExpandedSprints(Object.fromEntries(remainingSprints.map(sprint => [
        sprint.id,
        sprint.status !== 'Completed',
      ])));
    } catch (error) {
      setTasks([]);
      setApiSpace(null);
      setTasksError(getErrorMessage(error, 'Unable to load tasks for this space.'));
    } finally {
      setIsLoadingTasks(false);
    }
  }, [spaceId, setExtraSprints]);

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData]);

  const updateTaskRequest = useCallback(async (taskId, updates) => {
    const response = await axiosClient.patch(`/tasks/${taskId}`, updates);
    const updatedTask = mapApiTask(response.data);
    setTasks(prev => assignScopedTaskDisplayIds(prev.map(task => task.id === taskId ? updatedTask : task)));
    setSelectedTaskDetail(prev => prev?.id === taskId ? updatedTask : prev);
    return updatedTask;
  }, []);

  useEffect(() => {
    if (!selectedTaskDetail?.id) return;
    const latestTask = tasks.find(task => task.id === selectedTaskDetail.id);
    if (latestTask) {
      setSelectedTaskDetail(prev => (prev?.id === latestTask.id ? { ...prev, ...latestTask } : prev));
    }
  }, [selectedTaskDetail?.id, tasks]);

  const applyTaskAssignees = useCallback((taskId, assigneeEntries = []) => {
    const updates = buildTaskAssigneeUpdates(assigneeEntries);

    setTasks(prev => prev.map(task => (
      task.id === taskId ? { ...task, ...updates } : task
    )));
    setSelectedTaskDetail(prev => (
      prev?.id === taskId ? { ...prev, ...updates } : prev
    ));
    return updates;
  }, []);

  const refreshTaskAssignmentState = useCallback(async (taskId) => {
    const [assigneeResponse, historyResponse] = await Promise.all([
      axiosClient.get(`/tasks/${taskId}/assignees`),
      axiosClient.get(`/tasks/${taskId}/assignment-history`),
    ]);
    const assigneeUpdates = applyTaskAssignees(taskId, assigneeResponse.data?.assignees || []);
    const assignmentHistory = historyResponse.data?.history || [];
    setTasks(prev => prev.map(task => (
      task.id === taskId ? { ...task, ...assigneeUpdates, assignmentHistory } : task
    )));
    setSelectedTaskDetail(prev => (
      prev?.id === taskId ? { ...prev, ...assigneeUpdates, assignmentHistory } : prev
    ));
    return { ...assigneeUpdates, assignmentHistory };
  }, [applyTaskAssignees]);

  const syncTaskAssigneeRequest = useCallback(async (taskId, assigneeUserId) => {
    const currentTask = tasks.find(task => task.id === taskId) || selectedTaskDetail;
    const currentAssignees = currentTask?.assignees || [];
    const currentPrimary = currentAssignees[0] || null;

    if (!assigneeUserId) {
      await Promise.all(currentAssignees.map(entry =>
        axiosClient.delete(`/tasks/${taskId}/assignees/${entry.assigneeId}`, {
          data: { reason: 'Updated from task board' },
        })
      ));
      return applyTaskAssignees(taskId, []);
    }

    if (currentPrimary?.assigneeId === assigneeUserId) {
      return {
        assignees: currentAssignees,
        assignee: currentPrimary.user?.name || '',
        assigneeId: currentPrimary.assigneeId,
      };
    }

    const response = currentPrimary
      ? await axiosClient.put(`/tasks/${taskId}/assignees`, {
        previous_assignee_id: currentPrimary.assigneeId,
        new_assignee_id: assigneeUserId,
        reason: 'Updated from task board',
      })
      : await axiosClient.post(`/tasks/${taskId}/assignees`, {
        assignee_ids: [assigneeUserId],
        reason: 'Assigned from task board',
      });

    return applyTaskAssignees(taskId, response.data?.assignees || []);
  }, [applyTaskAssignees, selectedTaskDetail, tasks]);

  const addTaskAssigneeRequest = useCallback(async (taskId, assigneeUserId) => {
    if (!assigneeUserId) return refreshTaskAssignmentState(taskId);
    const currentTask = tasks.find(task => task.id === taskId) || selectedTaskDetail;
    const alreadyAssigned = (currentTask?.assignees || []).some(entry => entry.assigneeId === assigneeUserId);
    if (alreadyAssigned) return refreshTaskAssignmentState(taskId);

    await axiosClient.post(`/tasks/${taskId}/assignees`, {
      assignee_ids: [assigneeUserId],
      reason: 'Assigned from task board',
    });
    return refreshTaskAssignmentState(taskId);
  }, [refreshTaskAssignmentState, selectedTaskDetail, tasks]);

  const removeTaskAssigneeRequest = useCallback(async (taskId, assigneeUserId) => {
    if (!assigneeUserId) return;
    await axiosClient.delete(`/tasks/${taskId}/assignees/${assigneeUserId}`, {
      data: { reason: 'Removed from task board' },
    });
    return refreshTaskAssignmentState(taskId);
  }, [refreshTaskAssignmentState]);

  const filteredPeopleDirectory = projectPeopleDirectory.filter(person => {
    const normalizedSearch = peopleSearch.trim().toLowerCase();
    if (!normalizedSearch) return true;
    return person.name.toLowerCase().includes(normalizedSearch) ||
      person.email.toLowerCase().includes(normalizedSearch);
  });
  const trimmedPeopleSearch = peopleSearch.trim();
  const canAddEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedPeopleSearch);

  const handleAddProjectPerson = async (person) => {
    if (!person?.email || addingPeopleEmail) return;

    const normalizedEmail = person.email.toLowerCase();
    setAddPeopleFeedback('');
    setAddingPeopleEmail(normalizedEmail);

    try {
      if (spaceId && String(spaceId).startsWith('SPC')) {
        const result = await addPeopleRequest(spaceId, person);
        if (result.status === 'APPROVED') {
          setProjectPeople(prev => {
            if (prev.some(member => member.email?.toLowerCase() === normalizedEmail || member.id === person.id)) return prev;
            return [...prev, person];
          });
        } else {
          setPendingPeopleEmails(prev => prev.includes(normalizedEmail) ? prev : [...prev, normalizedEmail]);
        }
        setAddPeopleFeedback(result.message || 'Request created.');
      } else {
        setPendingPeopleEmails(prev => prev.includes(normalizedEmail) ? prev : [...prev, normalizedEmail]);
        setAddPeopleFeedback(
          canDirectAddPeople
            ? `Invitation email sent to ${person.email}. Waiting for them to accept.`
            : `Approval request sent to the owner for ${person.email}.`
        );
      }
      setPeopleSearch('');
    } catch (error) {
      setAddPeopleFeedback(error.message || 'Unable to add this person.');
    } finally {
      setAddingPeopleEmail('');
    }
  };

  const handleAddEmailPerson = async () => {
    if (!canAddEmail) return;

    const email = trimmedPeopleSearch.toLowerCase();
    const nameFromEmail = email.split('@')[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || email;
    const person = {
      id: `email-${email.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
      name: nameFromEmail,
      email,
      initials: getInitials(nameFromEmail),
      color: '#5E4DB2',
      textColor: '#FFFFFF'
    };

    await handleAddProjectPerson(person);
  };

  useEffect(() => {
    setProjectPeople(getInitialProjectPeople(selectedSpace));
    setPendingPeopleEmails([]);
    setAddPeopleFeedback('');
    setSelectedAssigneeFilter('All');
  }, [selectedSpace?.id]);

  useEffect(() => {
    if (!isAddPeopleOpen) return;
    const handleClickOutside = (event) => {
      if (
        addPeoplePanelRef.current &&
        !addPeoplePanelRef.current.contains(event.target) &&
        addPeopleButtonRef.current &&
        !addPeopleButtonRef.current.contains(event.target)
      ) {
        setIsAddPeopleOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddPeopleOpen]);

  useEffect(() => {
    if (!isDateDropdownOpen) return;
    const handleClickOutside = (event) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target)) {
        setIsDateDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDateDropdownOpen]);

  // Sync tasks with MainLayout context for the CreateTaskModal's RichTextEditor
  useEffect(() => {
    if (setTasksForModal) {
      setTasksForModal(tasks);
    }
  }, [tasks, setTasksForModal]);

  // Sync sprints with MainLayout for CreateTaskModal
  useEffect(() => {
    if (setSprintsForModal) {
      setSprintsForModal([sprint1Data, ...extraSprints]
        .filter(sprint => sprint.id && sprint.status !== 'Completed')
        .map(sprint => ({ id: sprint.id, name: sprint.name })));
    }
  }, [sprint1Data, extraSprints, setSprintsForModal]);

  useEffect(() => {
    if (setAssigneesForModal) {
      setAssigneesForModal(projectAssigneeOptions);
    }
  }, [projectAssigneeOptions, setAssigneesForModal]);

  const handleCreateTask = useCallback(async (taskData) => {
    if (!canModifyTasks || !spaceId) return;
    if (!spaceId) {
      throw new Error('Open a space before creating a task.');
    }
    setTasksError('');

    const sprintOptions = [sprint1Data, ...extraSprints].filter(sprint => sprint.id);
    const createableSprintOptions = sprintOptions.filter(sprint => sprint.status !== 'Completed');
    const defaultSprint = createableSprintOptions.find(sprint => sprint.status === 'Active')
      || createableSprintOptions[0];
    const selectedSprint = createableSprintOptions.find(sprint => sprint.name === taskData.sprint)
      || defaultSprint;
    if (!selectedSprint?.id) {
      throw new Error('Start or create an available sprint before adding tasks.');
    }

    const selectedAssigneeIds = Array.from(new Set(
  (taskData.assigneeIds || [])
    .concat(taskData.assigneeId ? [taskData.assigneeId] : [])
    .map(String)
    .map(id => id.trim())
    .filter(Boolean)
));

const storyPoints = parseNonNegativeStoryPoints(taskData.storyPoints);
if (storyPoints === null) {
  throw new Error('Story points must be 0 or greater.');
}
    const formData = new FormData();
    formData.append('title', taskData.summary.trim());
    formData.append('sprint_id', selectedSprint.id);
    formData.append('priority', TASK_PRIORITY_TO_API[taskData.priority] || 'MEDIUM');
    formData.append('task_status', TASK_STATUS_TO_API[taskData.status] || 'new');
    formData.append('story_points', String(storyPoints));
    if (taskData.description) formData.append('description', taskData.description);
    if (taskData.completed_at) formData.append('completed_at', new Date(taskData.completed_at).toISOString());
    selectedAssigneeIds.forEach(assigneeId => {
      formData.append('assignee_ids', assigneeId);
    });
    (taskData.attachments || []).forEach((attachment) => {
      if (attachment.file instanceof File) {
        formData.append('attachments', attachment.file);
      }
    });

    const response = await axiosClient.post(`/spaces/${spaceId}/tasks`, formData);
    let createdTask = mapApiTask(response.data);
    if (selectedAssigneeIds.length > 0 && createdTask.assignees.length === 0) {
      try {
        const assigneeResponse = await axiosClient.post(`/tasks/${createdTask.id}/assignees`, {
          assignee_ids: selectedAssigneeIds,
          reason: 'Assigned while creating task',
        });
        createdTask = {
          ...createdTask,
          ...buildTaskAssigneeUpdates(assigneeResponse.data?.assignees || []),
        };
      } catch (error) {
        setTasksError(
          `Task was created, but assignee could not be saved: ${getErrorMessage(error, 'Unable to assign this task.')}`
        );
      }
    }
    setTasks(prev => assignScopedTaskDisplayIds([createdTask, ...prev]));

    return createdTask;
  }, [canModifyTasks, extraSprints, projectAssigneeOptions, spaceId, sprint1Data]);

  useEffect(() => {
    if (!setCreateTaskHandler) return undefined;

    setCreateTaskHandler(() => handleCreateTask);
    return () => setCreateTaskHandler(null);
  }, [handleCreateTask, setCreateTaskHandler]);

  const handleOpenTaskDetail = useCallback(async (task) => {
    if (!task?.id) return;
    setSelectedTaskDetail(task);
    setTasksError('');
    try {
      const [response, assigneeResponse, historyResponse] = await Promise.all([
        axiosClient.get(`/tasks/${task.id}`),
        axiosClient.get(`/tasks/${task.id}/assignees`),
        axiosClient.get(`/tasks/${task.id}/assignment-history`),
      ]);
      const detailedTask = {
        ...mapApiTask(response.data),
        ...buildTaskAssigneeUpdates(assigneeResponse.data?.assignees || response.data?.assignees || []),
        assignmentHistory: historyResponse.data?.history || response.data?.assignment_history || [],
      };
      setSelectedTaskDetail(detailedTask);
      setTasks(prev => prev.map(item => item.id === detailedTask.id ? detailedTask : item));
    } catch (error) {
      setTasksError(getErrorMessage(error, 'Unable to load task details.'));
    }
  }, []);

  // Keep selected task detail in sync with the latest task state
  useEffect(() => {
    if (selectedTaskDetail) {
      const current = tasks.find(t => t.id === selectedTaskDetail.id);
      if (current && current !== selectedTaskDetail) {
        setSelectedTaskDetail(current);
      }
    }
  }, [tasks, selectedTaskDetail]);

  useEffect(() => {
    if (!routeTaskId) return;
    const taskFromRoute = tasks.find(task => task.id === routeTaskId);
    if (taskFromRoute && selectedTaskDetail?.id !== taskFromRoute.id) {
      handleOpenTaskDetail(taskFromRoute);
    }
  }, [handleOpenTaskDetail, routeTaskId, selectedTaskDetail?.id, tasks]);

  const handleCloseTaskDetail = () => {
    setSelectedTaskDetail(null);
    if (!routeTaskId) return;

    const nextParams = new URLSearchParams(taskSearchParams);
    nextParams.delete('taskId');
    setTaskSearchParams(nextParams, { replace: true });
  };

  const toggleAll = () => {
    if (!canSelectTasks) return;
    if (selectableTaskIds.length === 0) return;
    if (selectableTaskIds.every(taskId => selectedTasks.includes(taskId))) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(selectableTaskIds);
    }
  };

  const handleDeleteSelectedTasks = async () => {
    if (selectedTasks.length === 0) return;
    if (!canManageTasks) {
      alert('You do not have permission to delete selected tasks.');
      return;
    }
    setTasksError('');
    try {
      const deletableTaskIds = selectedTasks.filter(taskId => {
        const task = tasks.find(item => item.id === taskId);
        return task && !isTaskReadOnly(task);
      });
      if (deletableTaskIds.length === 0) return;
      await Promise.all(deletableTaskIds.map(taskId => axiosClient.delete(`/tasks/${taskId}`)));
      setTasks(prev => prev.filter(t => !deletableTaskIds.includes(t.id)));
      setExtraSprints(prev => prev.map(s => ({
        ...s,
        tasks: s.tasks.filter(t => !deletableTaskIds.includes(t.id))
      })));
      if (selectedTaskDetail && deletableTaskIds.includes(selectedTaskDetail.id)) {
        setSelectedTaskDetail(null);
      }
      setSelectedTasks([]);
    } catch (error) {
      setTasksError(getErrorMessage(error, 'Unable to delete selected tasks.'));
      loadTaskData();
    }
  };

  const toolbarStatuses = isSpaceOwner
    ? ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done', 'Cancelled']
    : ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done'];

  const changeStatusForSelected = async (newStatus) => {
    if (!newStatus) return;
    if (!canModifyTasks) return;
    setTasksError('');
    try {
      const editableTaskIds = selectedTasks.filter(taskId => {
        const task = tasks.find(item => item.id === taskId);
        return task && !isTaskReadOnly(task);
      });
      if (editableTaskIds.length === 0) return;
      await Promise.all(editableTaskIds.map(taskId => updateTaskRequest(taskId, {
        task_status: TASK_STATUS_TO_API[newStatus] || 'new',
      })));
      setShowToolbarStatusMenu(false);
    } catch (error) {
      setTasksError(getErrorMessage(error, 'Unable to update selected tasks.'));
      loadTaskData();
    }
  };

  const toggleTask = (id) => {
    if (!canSelectTasks) return;
    const task = tasks.find(item => item.id === id);
    if (!task || isTaskReadOnly(task)) return;
    setSelectedTasks(prev =>
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    const updatePointerFromMouse = (event) => {
      dragPointerXRef.current = event.clientX;
    };

    const updatePointerFromTouch = (event) => {
      if (event.touches?.[0]) {
        dragPointerXRef.current = event.touches[0].clientX;
      }
    };

    window.addEventListener('mousemove', updatePointerFromMouse, { passive: true });
    window.addEventListener('touchmove', updatePointerFromTouch, { passive: true });

    return () => {
      window.removeEventListener('mousemove', updatePointerFromMouse);
      window.removeEventListener('touchmove', updatePointerFromTouch);
    };
  }, []);

  const stopBoardAutoScroll = useCallback(() => {
    isBoardDraggingRef.current = false;
    if (boardAutoScrollFrameRef.current) {
      cancelAnimationFrame(boardAutoScrollFrameRef.current);
      boardAutoScrollFrameRef.current = null;
    }
  }, []);

  const startBoardAutoScroll = useCallback(() => {
    if (!canModifyTasks) return;

    isBoardDraggingRef.current = true;
    const edgeSize = 140;
    const maxScrollSpeed = 28;

    const scrollBoard = () => {
      const board = boardScrollRef.current;
      const pointerX = dragPointerXRef.current;

      if (!isBoardDraggingRef.current || !board) {
        boardAutoScrollFrameRef.current = null;
        return;
      }

      if (typeof pointerX === 'number') {
        const rect = board.getBoundingClientRect();
        const distanceFromLeft = pointerX - rect.left;
        const distanceFromRight = rect.right - pointerX;
        let scrollDelta = 0;

        if (distanceFromLeft >= 0 && distanceFromLeft < edgeSize) {
          scrollDelta = -Math.ceil(((edgeSize - distanceFromLeft) / edgeSize) * maxScrollSpeed);
        } else if (distanceFromRight >= 0 && distanceFromRight < edgeSize) {
          scrollDelta = Math.ceil(((edgeSize - distanceFromRight) / edgeSize) * maxScrollSpeed);
        }

        if (scrollDelta !== 0) {
          board.scrollLeft += scrollDelta;
        }
      }

      boardAutoScrollFrameRef.current = requestAnimationFrame(scrollBoard);
    };

    stopBoardAutoScroll();
    isBoardDraggingRef.current = true;
    boardAutoScrollFrameRef.current = requestAnimationFrame(scrollBoard);
  }, [canModifyTasks, stopBoardAutoScroll]);

  useEffect(() => stopBoardAutoScroll, [stopBoardAutoScroll]);

  const onDragEnd = async (result) => {
    stopBoardAutoScroll();
    if (!canModifyTasks) return;
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const movingTask = tasks.find(task => task.id === draggableId);
    if (!movingTask || isTaskReadOnly(movingTask)) return;

    const previousTasks = tasks;
    setTasks(prev => prev.map(task => (
      task.id === draggableId ? { ...task, status: destination.droppableId } : task
    )));
    try {
      await updateTaskRequest(draggableId, {
        task_status: TASK_STATUS_TO_API[destination.droppableId] || 'new',
      });
    } catch (error) {
      setTasks(previousTasks);
      setTasksError(getErrorMessage(error, 'Unable to update task status.'));
    }
  };

  const switchView = (newView) => {
    setView(newView);
  };

  const handleDeleteTask = async (taskId) => {
    const task = tasks.find(item => item.id === taskId);
    if (!task || isTaskReadOnly(task)) return;
    setTasksError('');
    try {
      await axiosClient.delete(`/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setTaskToDelete(null);
      if (selectedTaskDetail?.id === taskId) {
        setSelectedTaskDetail(null);
      }
    } catch (error) {
      setTasksError(getErrorMessage(error, 'Unable to delete this task.'));
    }
  };

  const handleCreateSprint = async ({ activate = false } = {}) => {
    if (!canModifyTasks || !spaceId) return;

    const nextNum = getNextSprintNumber([sprint1Data, ...extraSprints]);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + (nextNum - 1) * 14);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 13);

    setTasksError('');
    try {
      const response = await axiosClient.post(`/spaces/${spaceId}/sprints`, {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        duration_weeks: 2,
        status: activate ? 'Active' : 'Planned',
        auto_start: false,
        auto_complete: false,
      });
      const createdSprint = mapApiSprint(response.data);
      setExpandedSprints(prev => ({ ...prev, [createdSprint.id]: true }));
      await loadTaskData();
    } catch (error) {
      setTasksError(getErrorMessage(error, 'Unable to create sprint.'));
    }
  };
  const toggleSprintExpanded = (sprintId) => {
    setExpandedSprints(prev => ({ ...prev, [sprintId]: !prev[sprintId] }));
  };

  const handleDeleteSprint = async (sprintId) => {
    if (!canModifyTasks || !sprintId) return;

    setTasksError('');
    try {
      await axiosClient.delete(`/sprints/${sprintId}`);
      setOpenSprintMenuId(null);
      setDeleteSprintConfirmId(null);
      await loadTaskData();
    } catch (error) {
      setTasksError(getErrorMessage(error, 'Unable to delete sprint.'));
    }
  };

  const handleActivateSprint = async (sprintId) => {
    if (!canModifyTasks || !sprintId) return;

    setTasksError('');
    try {
      await axiosClient.post(`/sprints/${sprintId}/activate`);
      setOpenSprintMenuId(null);
      await loadTaskData();
    } catch (error) {
      setTasksError(getErrorMessage(error, 'Unable to activate sprint.'));
    }
  };

  const handleOpenEditSprint = (sprintData) => {
    setSprintToEdit(sprintData);
    setIsEditSprintOpen(true);
    setOpenSprintMenuId(null);
  };

  const handleUpdateSprint = async (updatedSprint) => {
    if (!canModifyTasks || !updatedSprint?.id) return;

    setTasksError('');
    try {
      await axiosClient.patch(`/sprints/${updatedSprint.id}`, {
        name: updatedSprint.name,
        goal: updatedSprint.goal || null,
        start_date: updatedSprint.startDate ? new Date(updatedSprint.startDate).toISOString() : null,
        end_date: updatedSprint.endDate ? new Date(updatedSprint.endDate).toISOString() : null,
        duration_weeks: Number(updatedSprint.duration) || 2,
        auto_start: Boolean(updatedSprint.autoStart),
        auto_complete: Boolean(updatedSprint.autoComplete),
      });
      setIsEditSprintOpen(false);
      setSprintToEdit(null);
      await loadTaskData();
    } catch (error) {
      setTasksError(getErrorMessage(error, 'Unable to update sprint.'));
    }
  };

  // Close sprint menus when clicking outside
  useEffect(() => {
    if (!openSprintMenuId) return;
    const handler = (e) => {
      if (!e.target.closest('[data-sprint-menu]')) {
        setOpenSprintMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openSprintMenuId]);

  const filteredTasks = tasks.filter(task => {
    const normalizedSearch = taskSearchQuery.trim().toLowerCase();
    if (normalizedSearch) {
      const matchesSearch = String(task.displayId || '').toLowerCase().includes(normalizedSearch) ||
        String(task.id || '').toLowerCase().includes(normalizedSearch) ||
        String(task.title || '').toLowerCase().includes(normalizedSearch);
      if (!matchesSearch) return false;
    }

    if (selectedAssigneeFilter && selectedAssigneeFilter !== 'All') {
      if (selectedAssigneeFilter === 'Unassigned') {
        if (getTaskAssigneeUsers(task).length > 0) return false;
      } else if (!taskHasAssigneeName(task, selectedAssigneeFilter)) {
        return false;
      }
    }

    if (selectedStatusFilter !== 'All' && task.status !== selectedStatusFilter) {
      return false;
    }

    if (selectedPriorityFilter !== 'All' && task.priority !== selectedPriorityFilter) {
      return false;
    }

    if (selectedDate) {
      try {
        const selTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime();
        const taskTime = new Date(task.date).getTime();
        return selTime === taskTime;
      } catch (e) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    switch (sortOption) {
      case 'created-newest':
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      case 'created-oldest':
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      case 'name-az':
        return (a.title || '').localeCompare(b.title || '');
      case 'name-za':
        return (b.title || '').localeCompare(a.title || '');
      case 'custom':
      default:
        return 0;
    }
  });
  const primarySprintTasks = sprint1Data.id
    ? filteredTasks.filter(task => task.sprintId === sprint1Data.id)
    : filteredTasks;
  const displayedSprints = [sprint1Data, ...extraSprints].filter(sprint => sprint.id);
  const hasAvailableSprint = displayedSprints.length > 0;
  const canCreateInitialSprint = canModifyTasks && Boolean(spaceId) && !hasAvailableSprint;
  const completedSprintIds = new Set(
    displayedSprints.filter(sprint => sprint.status === 'Completed').map(sprint => sprint.id)
  );
  const isTaskReadOnly = (task) => Boolean(task?.sprintId && completedSprintIds.has(task.sprintId));
  const selectableTaskIds = filteredTasks
    .filter(task => !isTaskReadOnly(task))
    .map(task => task.id);
  const activeBoardSprint = displayedSprints.find(sprint => sprint.status === 'Active') || null;
  const boardTasks = activeBoardSprint
    ? filteredTasks.filter(task => task.sprintId === activeBoardSprint.id)
    : [];
  const getTasksForSprint = (sprintId) => (
    sprintId ? filteredTasks.filter(task => task.sprintId === sprintId) : filteredTasks
  );
  const isSprintCompleted = (sprint) => {
    return sprint?.status === 'Completed';
  };
  const arePreviousSprintsCompleted = (sprint) => {
    const sprintIndex = displayedSprints.findIndex(item => item.id === sprint.id);
    if (sprintIndex <= 0) return sprintIndex === 0;
    return displayedSprints.slice(0, sprintIndex).every(isSprintCompleted);
  };
  const hasActiveSprintBefore = (sprint) => {
    const sprintIndex = displayedSprints.findIndex(item => item.id === sprint.id);
    if (sprintIndex <= 0) return false;
    return displayedSprints.slice(0, sprintIndex).some(item => item.status === 'Active');
  };
  const shouldShowStartSprint = (sprint) => {
    if (!sprint?.id) return false;
    const sprintIndex = displayedSprints.findIndex(item => item.id === sprint.id);
    return sprintIndex >= 0 && sprint.status === 'Planned';
  };
  const canStartSprint = (sprint) => {
    if (!shouldShowStartSprint(sprint)) return false;
    return arePreviousSprintsCompleted(sprint) && !hasActiveSprintBefore(sprint);
  };
  const completeSprintTasks = completeSprintTarget
    ? getTasksForSprint(completeSprintTarget.id)
    : primarySprintTasks;

  const openCompleteSprint = (sprint) => {
    if (!sprint?.id) return;
    setCompleteSprintTarget(sprint);
    setIsCompleteSprintOpen(true);
  };

  const getSprintAction = (sprint) => {
    if (!sprint?.id || !canModifyTasks) return null;
    if (sprint.status === 'Completed') return null;
    const sprintIndex = displayedSprints.findIndex(item => item.id === sprint.id);
    if (sprint.status === 'Active') {
      return {
        label: 'Complete sprint',
        onClick: () => openCompleteSprint(sprint),
      };
    }
    if (shouldShowStartSprint(sprint)) {
      const startEnabled = canStartSprint(sprint);
      return {
        label: 'Start sprint',
        disabled: !startEnabled,
        title: startEnabled ? undefined : 'Complete the previous sprint before starting this sprint.',
        onClick: () => {
          if (startEnabled) handleActivateSprint(sprint.id);
        },
      };
    }
    return null;
  };
  const boardSprintActionTarget = activeBoardSprint
    || displayedSprints.find(sprint => canStartSprint(sprint))
    || null;
  const boardSprintAction = boardSprintActionTarget
    ? getSprintAction(boardSprintActionTarget)
    : null;
  const sprintInfoTasks = view === 'board' ? boardTasks : primarySprintTasks;
  const selectedTaskDetailReadOnly = selectedTaskDetail ? isTaskReadOnly(selectedTaskDetail) : false;

  const handleCompleteSprint = async () => {
    if (!canModifyTasks || !completeSprintTarget?.id) return;

    setTasksError('');
    try {
      const targetIndex = displayedSprints.findIndex(sprint => sprint.id === completeSprintTarget.id);
      const activeLaterSprint = displayedSprints
        .slice(Math.max(targetIndex + 1, 0))
        .find(sprint => sprint.status === 'Active');
      if (activeLaterSprint) {
        await axiosClient.patch(`/sprints/${activeLaterSprint.id}`, { status: 'Planned' });
      }
      if (completeSprintTarget.status !== 'Active') {
        await axiosClient.post(`/sprints/${completeSprintTarget.id}/activate`);
      }
      await axiosClient.post(`/sprints/${completeSprintTarget.id}/complete`);
      setIsCompleteSprintOpen(false);
      setCompleteSprintTarget(null);
      await loadTaskData();
    } catch (error) {
      setTasksError(getErrorMessage(error, 'Unable to complete sprint.'));
    }
  };

  const visibleStatuses = isSpaceOwner
    ? ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done', 'Cancelled']
    : ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done'];

  const handleUpdateAssignee = async (taskId, user) => {
    if (!canModifyTasks) return;
    setTasksError('');
    const previousTask = tasks.find(task => task.id === taskId) || selectedTaskDetail;
    if (!previousTask || isTaskReadOnly(previousTask)) return;
    const nextAssigneeId = user?.user_id || user?.id || '';
    const currentAssignees = previousTask?.assignees || [];
    if (nextAssigneeId && currentAssignees.some(entry => entry.assigneeId === nextAssigneeId)) {
      return;
    }
    const optimisticAssignee = nextAssigneeId
      ? [
        ...currentAssignees,
        {
        entryId: `optimistic-${taskId}-${nextAssigneeId}`,
        assignee_entry_id: `optimistic-${taskId}-${nextAssigneeId}`,
        taskId,
        assigneeId: nextAssigneeId,
        assignee_id: nextAssigneeId,
        assignedAt: new Date().toISOString(),
        assignee_at: new Date().toISOString(),
        user: mapApiUserSummary(user),
      }]
      : [];
    const optimisticUpdates = buildTaskAssigneeUpdates(optimisticAssignee);

    setTasks(prev => prev.map(task => (
      task.id === taskId
        ? {
          ...task,
          ...optimisticUpdates,
        }
        : task
    )));
    setSelectedTaskDetail(prev => (
      prev?.id === taskId
        ? {
          ...prev,
          ...optimisticUpdates,
        }
        : prev
    ));
    try {
      if (!nextAssigneeId) {
        await syncTaskAssigneeRequest(taskId, '');
      } else {
        await addTaskAssigneeRequest(taskId, nextAssigneeId);
      }
    } catch (error) {
      setTasksError(getErrorMessage(error, 'Unable to update task assignee.'));
      if (previousTask) {
        setTasks(prev => prev.map(task => task.id === taskId ? previousTask : task));
        setSelectedTaskDetail(prev => prev?.id === taskId ? previousTask : prev);
      }
      loadTaskData();
    }
  };

  const handleRemoveTaskAssignee = async (taskId, assigneeUserId) => {
    if (!canModifyTasks || !assigneeUserId) return;
    setTasksError('');
    const previousTask = tasks.find(task => task.id === taskId) || selectedTaskDetail;
    const optimisticAssignees = (previousTask?.assignees || []).filter(entry => entry.assigneeId !== assigneeUserId);
    const optimisticUpdates = buildTaskAssigneeUpdates(optimisticAssignees);

    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, ...optimisticUpdates } : task));
    setSelectedTaskDetail(prev => prev?.id === taskId ? { ...prev, ...optimisticUpdates } : prev);

    try {
      await removeTaskAssigneeRequest(taskId, assigneeUserId);
    } catch (error) {
      setTasksError(getErrorMessage(error, 'Unable to remove task assignee.'));
      if (previousTask) {
        setTasks(prev => prev.map(task => task.id === taskId ? previousTask : task));
        setSelectedTaskDetail(prev => prev?.id === taskId ? previousTask : prev);
      }
      loadTaskData();
    }
  };

  const handleUpdateTask = async (updatedTask) => {
    if (!canModifyTasks) return;
    const currentTask = tasks.find(task => task.id === updatedTask.id) || selectedTaskDetail;
    if (!currentTask) return;
    if (isTaskReadOnly(currentTask)) return;

    const assigneeChanged = (updatedTask.assigneeId || '') !== (currentTask.assigneeId || '') || updatedTask.assignee !== currentTask.assignee;
    if (assigneeChanged) {
      const selectedAssignee = projectAssigneeOptions.find(user =>
        (updatedTask.assigneeId && (user.user_id === updatedTask.assigneeId || user.id === updatedTask.assigneeId)) ||
        user.name === updatedTask.assignee
      );
      await handleUpdateAssignee(updatedTask.id, selectedAssignee || { user_id: '' });
    }

    const updates = {};
    if (updatedTask.title !== currentTask.title) updates.title = updatedTask.title;
    if (updatedTask.description !== currentTask.description) updates.description = updatedTask.description || null;
    if (updatedTask.priority !== currentTask.priority) updates.priority = TASK_PRIORITY_TO_API[updatedTask.priority] || 'MEDIUM';
    if (updatedTask.status !== currentTask.status) updates.task_status = TASK_STATUS_TO_API[updatedTask.status] || 'new';
    const nextStoryPoints = parseNonNegativeStoryPoints(updatedTask.pts);
    if (nextStoryPoints !== null && Number(nextStoryPoints) !== Number(currentTask.pts)) {
      updates.story_points = nextStoryPoints;
    }
    const nextCompletedAt = updatedTask.completed_at || null;
    const currentCompletedAt = currentTask.completed_at || null;
    if (nextCompletedAt !== currentCompletedAt) {
      updates.completed_at = nextCompletedAt ? new Date(nextCompletedAt).toISOString() : null;
    }

    if (Object.keys(updates).length === 0) {
      if (assigneeChanged) return;
      setTasks(prev => assignScopedTaskDisplayIds(prev.map(task => task.id === updatedTask.id ? updatedTask : task)));
      setSelectedTaskDetail(updatedTask);
      return;
    }

    try {
      await updateTaskRequest(updatedTask.id, updates);
    } catch (error) {
      setTasksError(getErrorMessage(error, 'Unable to update this task.'));
      setSelectedTaskDetail(currentTask);
    }
  };

  const handleMoveTaskWithinStatus = (taskId, direction) => {
    if (!canModifyTasks) return;

    const movingTask = tasks.find(task => task.id === taskId);
    if (!movingTask) return;
    if (isTaskReadOnly(movingTask)) return;

    const displayedColumnTaskIds = filteredTasks
      .filter(task => task.status === movingTask.status)
      .map(task => task.id);
    const currentIndex = displayedColumnTaskIds.indexOf(taskId);
    if (currentIndex === -1) return;

    const visibleIdsWithoutMovingTask = displayedColumnTaskIds.filter(id => id !== taskId);
    let referenceTaskId = null;
    let insertPosition = 'before';

    if (direction === 'top' && currentIndex > 0) {
      referenceTaskId = visibleIdsWithoutMovingTask[0];
    } else if (direction === 'up' && currentIndex > 0) {
      referenceTaskId = displayedColumnTaskIds[currentIndex - 1];
    } else if (direction === 'down' && currentIndex < displayedColumnTaskIds.length - 1) {
      referenceTaskId = displayedColumnTaskIds[currentIndex + 1];
      insertPosition = 'after';
    } else if (direction === 'bottom' && currentIndex < displayedColumnTaskIds.length - 1) {
      referenceTaskId = visibleIdsWithoutMovingTask[visibleIdsWithoutMovingTask.length - 1];
      insertPosition = 'after';
    }

    if (!referenceTaskId) return;

    setSortOption('custom');
    setTasks(prev => {
      const movingIndex = prev.findIndex(task => task.id === taskId);
      if (movingIndex === -1) return prev;

      const taskToMove = prev[movingIndex];
      const withoutMovingTask = prev.filter(task => task.id !== taskId);
      const referenceIndex = withoutMovingTask.findIndex(task => task.id === referenceTaskId);
      if (referenceIndex === -1) return prev;

      const nextTasks = [...withoutMovingTask];
      const insertIndex = insertPosition === 'before' ? referenceIndex : referenceIndex + 1;
      nextTasks.splice(insertIndex, 0, taskToMove);
      return nextTasks;
    });
  };

  const summaryRole = isAdmin ? 'SUPER_ADMIN' : (currentSpaceRole === 'OWNER' ? 'OWNER' : 'USER');
  const spaceMemberCount = new Set(
    tasks.flatMap(task => getTaskAssigneeUsers(task).map(user => user.user_id || user.id || user.name)).filter(Boolean)
  ).size;
  const assigneeFilterMembers = projectAssigneeOptions.slice(1);
  const selectedAssigneeFilterMembers = selectedAssigneeFilter === 'All'
    ? assigneeFilterMembers
    : projectAssigneeOptions.filter(user => user.name === selectedAssigneeFilter);
  const assigneeFilterAvatarClass = (user) => {
    const isActive = selectedAssigneeFilter === 'All' || user.name === selectedAssigneeFilter;
    return isActive
      ? 'relative z-10 border-2 border-[#A78BFA] ring-2 ring-[#EDE9FE] shadow-sm'
      : 'border-2 border-white opacity-70';
  };
  const viewTabClass = (targetView) =>
    `flex items-center gap-2 px-2.5 py-1 rounded text-xs font-medium transition-colors ${view === targetView ? 'bg-[#cdddff] text-[#003d9b] shadow-sm' : 'text-gray-500 hover:bg-[#EBF0FF]'}`;
  const summaryMemberFilter = (
    <div ref={summaryAssigneeFilterRef} className="relative">
      <button
        type="button"
        onClick={() => setOpenAssigneeFilterMenu(prev => prev === 'summary' ? null : 'summary')}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-outline-variant rounded-lg hover:bg-surface-container transition-colors shadow-sm"
      >
        <div className="flex -space-x-1">
          {selectedAssigneeFilterMembers.slice(0, 3).map(user => (
            <AssigneeAvatar
              key={user.user_id || user.id || user.name}
              user={user}
              sizeClass="w-5 h-5"
              textClass="text-[9px]"
              className={assigneeFilterAvatarClass(user)}
            />
          ))}
          {selectedAssigneeFilter === 'All' && selectedAssigneeFilterMembers.length > 3 && (
            <span className="w-5 h-5 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-700">
              +{selectedAssigneeFilterMembers.length - 3}
            </span>
          )}
        </div>
        <span className="text-[11px] font-bold text-[#5e4db2]">
          {selectedAssigneeFilter === 'All' ? 'All members' : selectedAssigneeFilter}
        </span>
        <span className="material-symbols-outlined text-[#5e4db2] text-[13px]">expand_more</span>
      </button>
      <div className={`absolute top-full right-0 mt-2 w-56 bg-white border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden transition-all duration-150 ${openAssigneeFilterMenu === 'summary' ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        <div className="py-1">
          <button
            type="button"
            onClick={() => handleSelectAssigneeFilter('All')}
            className="w-full flex items-center gap-3 px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors"
          >
            <span className="material-symbols-outlined flex h-6 w-6 items-center justify-center rounded-full bg-[#F3E8FF] text-[16px] text-[#7E22CE]">
              groups
            </span>
            <span>All members</span>
          </button>
          {projectAssigneeOptions.slice(1).map(user => (
            <button
              key={user.user_id || user.id || user.name}
              type="button"
              onClick={() => handleSelectAssigneeFilter(user.name)}
              className="w-full flex items-center gap-3 px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors"
            >
              <AssigneeAvatar user={user} sizeClass="w-6 h-6" textClass="text-[9px]" />
              <span>{user.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="px-6 pb-6 pt-10 flex flex-col bg-[#F4F6F8] text-on-surface" style={{ height: '100%', overflow: 'hidden', position: 'relative' }} id="app-canvas">
      {/* Header Section */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${view === 'summary' ? 'mb-4' : 'mb-8'}`}>
        <div>
          <div className="flex items-center text-[10px] font-bold uppercase tracking-wider mb-1">
            <span className="cursor-pointer text-gray-500 transition-colors hover:text-[#5e4db2] active:text-[#5e4db2]" onClick={() => navigate(`/dashboard/spaces${location.search}`)}>Tasks</span>
            <i className="w-3 h-3 mx-2 text-gray-400 material-symbols-outlined text-[12px]">chevron_right</i>
            <span className="cursor-pointer text-gray-500 transition-colors hover:text-[#5e4db2] active:text-[#5e4db2]" onClick={() => navigate(`/dashboard/spaces${location.search}`)}>Space Management</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[#4C2B74]">{pageTitle}</h1>
            {canManagePeople && (
              <div className="relative">
                <button
                  ref={addPeopleButtonRef}
                  type="button"
                  onClick={() => setIsAddPeopleOpen(prev => !prev)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded text-[12px] font-semibold text-[#2D1B4E] hover:bg-[#f0edff] hover:border-[#5e4db2] transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  Add people
                </button>
                {isAddPeopleOpen && (
                <div
                  ref={addPeoplePanelRef}
                  className="absolute left-0 top-full mt-2 w-[320px] bg-white border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-3 border-b border-outline-variant">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                      <input
                        type="text"
                        value={peopleSearch}
                        onChange={(event) => setPeopleSearch(event.target.value)}
                        placeholder="Search name or email..."
                        className="w-full pl-9 pr-3 py-2 bg-white border border-outline-variant rounded text-[12px] outline-none focus:ring-2 focus:ring-[#5E4DB2]/30 focus:border-[#5E4DB2]"
                      />
                    </div>
                    {addPeopleFeedback && (
                      <div className="mt-2 rounded-lg bg-[#F7F8FC] px-3 py-2 text-[11px] font-medium text-[#4B5563]">
                        {addPeopleFeedback}
                      </div>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {filteredPeopleDirectory.map(person => {
                      const isAdded = projectPeople.some(member => member.id === person.id);
                      const normalizedEmail = person.email.toLowerCase();
                      const isPending = pendingPeopleEmails.includes(normalizedEmail);
                      const isAddingThisPerson = addingPeopleEmail === normalizedEmail;
                      const isOwner = projectOwnerId === person.id;
                      return (
                        <div key={person.id} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-[#F7F8FC] transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                              style={{ backgroundColor: person.color, color: person.textColor || '#111' }}
                            >
                              {person.initials}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[12px] font-semibold text-[#172B4D] truncate">{person.name}</div>
                              <div className="text-[10px] text-outline truncate">{person.email}</div>
                            </div>
                          </div>
                          {isOwner ? (
                            <span className="px-3 py-1 rounded bg-[#FFF4E5] text-[#9A5B00] text-[11px] font-bold">
                              Owner
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isAdded || isPending || Boolean(addingPeopleEmail)}
                              onClick={() => handleAddProjectPerson(person)}
                              className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${isAdded
                                  ? 'bg-[#E6FFF0] text-[#006D3A] cursor-default'
                                  : isPending
                                    ? 'bg-[#EEF2FF] text-[#003d9b] cursor-default'
                                    : 'bg-[#4C2B74] text-white hover:bg-[#3D225E]'
                                }`}
                            >
                              {isAddingThisPerson ? 'Sending...' : isAdded ? 'Added' : isPending ? 'Pending' : 'Invite'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {filteredPeopleDirectory.length === 0 && trimmedPeopleSearch && (
                      <div className="px-3 py-3">
                        <div className="mb-3 rounded-lg bg-[#F7F8FC] px-3 py-2">
                          <div className="text-[12px] font-semibold text-[#172B4D] truncate">{trimmedPeopleSearch}</div>
                          <div className="text-[10px] text-outline">
                            {canAddEmail ? 'Send an invitation to this email' : 'Enter a valid email address'}
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setPeopleSearch('')}
                            className="px-3 py-1.5 rounded border border-outline-variant bg-white text-[11px] font-bold text-[#4B5563] hover:bg-[#F3F4F6] transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!canAddEmail || Boolean(addingPeopleEmail)}
                            onClick={handleAddEmailPerson}
                            className={`px-4 py-1.5 rounded text-[11px] font-bold transition-colors ${canAddEmail && !addingPeopleEmail
                                ? 'bg-[#4C2B74] text-white hover:bg-[#3D225E]'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                          >
                            {addingPeopleEmail === trimmedPeopleSearch.toLowerCase() ? 'Sending...' : 'Invite'}
                          </button>
                        </div>
                      </div>
                    )}
                    {filteredPeopleDirectory.length === 0 && !trimmedPeopleSearch && (
                      <div className="px-4 py-5 text-center text-[12px] text-outline">Start typing a name or email</div>
                    )}
                  </div>
                </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {view === 'summary' && summaryMemberFilter}
          <div className="flex items-center gap-3 bg-white p-1 rounded-lg border border-outline-variant">
            <button
              className={viewTabClass('summary')}
              onClick={() => switchView('summary')}
            >
              <span className="material-symbols-outlined text-[16px]">space_dashboard</span>
              Summary
            </button>
            <button
              className={viewTabClass('list')}
              onClick={() => switchView('list')}
            >
              List
            </button>
            <button
              className={viewTabClass('board')}
              onClick={() => switchView('board')}
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              Board
            </button>
          </div>
        </div>
      </div>

      {view === 'summary' && (
        <Dashboard embedded forcedRole={summaryRole} spaceMemberCount={spaceMemberCount} />
      )}

      {tasksError && view !== 'summary' && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">
          {tasksError}
        </div>
      )}

      {isLoadingTasks && view !== 'summary' && (
        <div className="mb-4 rounded-lg border border-[#E5E0EF] bg-white px-4 py-3 text-[12px] font-semibold text-[#4C2B74] shadow-sm">
          Loading tasks...
        </div>
      )}

      {/* Filters Section */}
      {view !== 'summary' && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-outline text-[20px]">search</span>
              <input
                className="pl-10 pr-4 py-1.5 bg-white border border-outline-variant rounded text-[11px] w-[220px] focus:ring-2 focus:ring-[#5E4DB2]/30 focus:border-[#5E4DB2] outline-none text-[#32275E]"
                placeholder="Filter by ID or title..."
                type="text"
                value={taskSearchQuery}
                onChange={(event) => setTaskSearchQuery(event.target.value)}
              />
            </div>
            {/* Status Filter */}
            <div className="relative group">
              <button className={`flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded hover:bg-surface-container transition-colors shadow-sm cursor-pointer ${selectedStatusFilter !== 'All' ? 'bg-[#EBF0FF] border-[#5e4db2]' : ''}`}>
                <span className="text-xs font-bold text-[#5e4db2]">{selectedStatusFilter === 'All' ? 'Status' : selectedStatusFilter}</span>
                <span className="material-symbols-outlined text-[#5e4db2] text-[14px]">expand_more</span>
              </button>
              <div className="absolute top-[100%] left-0 pt-1 w-48 hidden group-hover:block z-50">
                <div className="bg-white border border-outline-variant rounded-xl shadow-2xl overflow-hidden py-1">
                  <button
                    type="button"
                    onClick={() => setSelectedStatusFilter('All')}
                    className="w-full text-left px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors cursor-pointer text-on-surface"
                  >
                    All statuses
                  </button>
                  {visibleStatuses.map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setSelectedStatusFilter(status)}
                      className="w-full text-left px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors cursor-pointer text-on-surface"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Priority Filter */}
            <div className="relative group">
              <button className={`flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded hover:bg-surface-container transition-colors shadow-sm cursor-pointer ${selectedPriorityFilter !== 'All' ? 'bg-[#EBF0FF] border-[#5e4db2]' : ''}`}>
                <span className="text-xs font-bold text-[#5e4db2]">{selectedPriorityFilter === 'All' ? 'Priority' : selectedPriorityFilter}</span>
                <span className="material-symbols-outlined text-[#5e4db2] text-[14px]">expand_more</span>
              </button>
              <div className="absolute top-[100%] left-0 pt-1 w-40 hidden group-hover:block z-50">
                <div className="bg-white border border-outline-variant rounded-xl shadow-2xl overflow-hidden py-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPriorityFilter('All')}
                    className="w-full text-left px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors cursor-pointer text-on-surface"
                  >
                    All priorities
                  </button>
                  {['High', 'Medium', 'Low'].map(priority => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => setSelectedPriorityFilter(priority)}
                      className="w-full text-left px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors cursor-pointer text-on-surface"
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Assignee Filter */}
            <div ref={toolbarAssigneeFilterRef} className="relative">
              <button
                type="button"
                onClick={() => setOpenAssigneeFilterMenu(prev => prev === 'toolbar' ? null : 'toolbar')}
                className="flex items-center ml-1 hover:opacity-70 transition-opacity"
              >
                <div className="flex -space-x-1">
                  {assigneeFilterMembers.slice(0, 4).map(user => (
                    <AssigneeAvatar
                      key={user.user_id || user.id || user.name}
                      user={user}
                      sizeClass="w-7 h-7"
                      textClass="text-[11px]"
                      className={assigneeFilterAvatarClass(user)}
                    />
                  ))}
                  {assigneeFilterMembers.length > 4 && (
                    <span className="w-7 h-7 rounded-full border-2 border-gray bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-700">
                      +{assigneeFilterMembers.length - 4}
                    </span>
                  )}
                </div>
              </button>
              <div className={`absolute top-full left-0 mt-2 w-56 bg-white border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden transition-all duration-150 ${openAssigneeFilterMenu === 'toolbar' ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => handleSelectAssigneeFilter('All')}
                    className="w-full flex items-center gap-3 px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors"
                  >
                    <span className="material-symbols-outlined flex h-6 w-6 items-center justify-center rounded-full bg-[#F3E8FF] text-[16px] text-[#7E22CE]">
                      groups
                    </span>
                    <span>All assignees</span>
                  </button>
                  {projectAssigneeOptions.map(user => (
                    <button
                      key={user.user_id || user.id || user.name}
                      type="button"
                      onClick={() => handleSelectAssigneeFilter(user.name)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors"
                    >
                      <AssigneeAvatar user={user} sizeClass="w-6 h-6" textClass="text-[9px]" />
                      <span>{user.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Sort Dropdown */}
            <div className="relative group">
              <button className={`flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded hover:bg-surface-container transition-colors shadow-sm cursor-pointer ${sortOption !== 'created-newest' ? 'bg-[#EBF0FF] border-[#5e4db2]' : ''}`}>
                <span className="material-symbols-outlined text-[#5e4db2] text-[16px]">sort</span>
                <span className="text-xs font-bold text-[#5e4db2]">
                  {sortOption === 'created-newest' ? 'Newest First'
                    : sortOption === 'created-oldest' ? 'Oldest First'
                      : sortOption === 'name-az' ? 'Name A→Z'
                        : sortOption === 'name-za' ? 'Name Z→A'
                          : 'Custom Order'}
                </span>
                <span className="material-symbols-outlined text-[#5e4db2] text-[14px]">expand_more</span>
              </button>
              <div className="absolute top-[100%] right-0 pt-1 w-52 hidden group-hover:block z-50">
                <div className="bg-white border border-outline-variant rounded-xl shadow-2xl overflow-hidden py-1">
                  <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-outline border-b border-outline-variant">Created Time</div>
                  <button
                    type="button"
                    onClick={() => setSortOption('created-newest')}
                    className={`w-full text-left px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors cursor-pointer flex items-center justify-between ${sortOption === 'created-newest' ? 'bg-[#EBF0FF] text-[#003d9b] font-bold' : 'text-on-surface'}`}
                  >
                    <span>Newest First</span>
                    {sortOption === 'created-newest' && <span className="material-symbols-outlined text-[16px] text-[#5e4db2]">check</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOption('created-oldest')}
                    className={`w-full text-left px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors cursor-pointer flex items-center justify-between ${sortOption === 'created-oldest' ? 'bg-[#EBF0FF] text-[#003d9b] font-bold' : 'text-on-surface'}`}
                  >
                    <span>Oldest First</span>
                    {sortOption === 'created-oldest' && <span className="material-symbols-outlined text-[16px] text-[#5e4db2]">check</span>}
                  </button>
                  <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-outline border-b border-t border-outline-variant mt-1">Task Name</div>
                  <button
                    type="button"
                    onClick={() => setSortOption('name-az')}
                    className={`w-full text-left px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors cursor-pointer flex items-center justify-between ${sortOption === 'name-az' ? 'bg-[#EBF0FF] text-[#003d9b] font-bold' : 'text-on-surface'}`}
                  >
                    <span>A → Z</span>
                    {sortOption === 'name-az' && <span className="material-symbols-outlined text-[16px] text-[#5e4db2]">check</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOption('name-za')}
                    className={`w-full text-left px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors cursor-pointer flex items-center justify-between ${sortOption === 'name-za' ? 'bg-[#EBF0FF] text-[#003d9b] font-bold' : 'text-on-surface'}`}
                  >
                    <span>Z → A</span>
                    {sortOption === 'name-za' && <span className="material-symbols-outlined text-[16px] text-[#5e4db2]">check</span>}
                  </button>
                </div>
              </div>
            </div>
            {/* Sprint Actions */}
            {view === 'board' && (
              <div className="flex items-center gap-2">
                {canCreateInitialSprint && (
                  <button
                    type="button"
                    onClick={() => handleCreateSprint({ activate: true })}
                    className="px-4 py-1.5 bg-[#f0edff] text-[#5e4db2] rounded text-[13px] font-semibold transition-colors hover:bg-[#e6e1ff]"
                  >
                    Start sprint
                  </button>
                )}
                {canModifyTasks && boardSprintAction && (
                  <button
                    onClick={boardSprintAction.onClick}
                    disabled={boardSprintAction.disabled}
                    title={boardSprintAction.title}
                    className={`px-4 py-1.5 bg-[#f0edff] text-[#5e4db2] rounded text-[13px] font-semibold transition-colors ${boardSprintAction.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#e6e1ff]'}`}
                  >
                    {boardSprintAction.label}
                  </button>
                )}
                <button
                  ref={sprintInfoAnchorRef}
                  onClick={() => setIsSprintInfoOpen(!isSprintInfoOpen)}
                  className="flex items-center justify-center w-[36px] h-[36px] border border-outline-variant rounded hover:bg-surface-container transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[20px] text-on-surface">insights</span>
                </button>
              </div>
            )}

            {/* Date Filter */}
            <div ref={dateFilterRef} className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsDateDropdownOpen(open => !open);
                }}
                aria-expanded={isDateDropdownOpen}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded hover:bg-surface-container transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[#5e4db2] text-[16px]">calendar_month</span>
                <span className="text-[11px] font-bold text-[#5e4db2]">
                  {selectedDate
                    ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Date'}
                </span>
              </button>

              {/* Calendar Dropdown */}
              {isDateDropdownOpen && (
              <div
                className="absolute top-full right-0 mt-2 w-[280px] bg-white border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[12px] font-bold text-[#5e4db2]">{monthNames[viewMonth]} {viewYear}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewMonth(m => {
                            if (m === 0) {
                              setViewYear(y => y - 1);
                              return 11;
                            }
                            return m - 1;
                          });
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewMonth(m => {
                            if (m === 11) {
                              setViewYear(y => y + 1);
                              return 0;
                            }
                            return m + 1;
                          });
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                      <span key={day} className="text-[10px] font-bold text-outline uppercase">{day}</span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {getDaysInMonth(viewYear, viewMonth).map((day, i) => {
                      if (day === null) {
                        return <div key={`empty-${i}`} className="h-7 w-7" />;
                      }
                      const isSelected = selectedDate &&
                        selectedDate.getDate() === day &&
                        selectedDate.getMonth() === viewMonth &&
                        selectedDate.getFullYear() === viewYear;
                      const isToday = day === 24 && viewMonth === 5 && viewYear === 2026;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSelected) {
                              setSelectedDate(null);
                            } else {
                              setSelectedDate(new Date(viewYear, viewMonth, day));
                            }
                            setIsDateDropdownOpen(false);
                          }}
                          className={`h-7 w-7 flex items-center justify-center rounded-lg text-[10px] transition-colors ${isSelected
                            ? 'bg-[#5e4db2] text-white font-bold'
                            : isToday
                              ? 'border border-[#5e4db2] text-[#5e4db2] font-semibold'
                              : 'hover:bg-surface-container text-on-surface'
                            }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BOARD VIEW */}
      {view === 'board' && (
        <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <DragDropContext onDragStart={startBoardAutoScroll} onDragEnd={onDragEnd}>
            <div ref={boardScrollRef} className="flex gap-4 pb-4 scrollbar-hide" id="board-view-container" style={{ flex: '1 1 0', minHeight: 0, overflowX: 'auto', overflowY: 'hidden', alignItems: 'stretch' }}>
              {visibleStatuses.map(status => (
                <KanbanColumn
                  key={status}
                  title={status}
                  tasks={boardTasks.filter(t => t.status === status)}
                  setTasks={setTasks}
                  onCreateTask={canModifyTasks && hasAvailableSprint && setShowCreateModal ? () => setShowCreateModal(true) : undefined}
                  onOpenDetail={handleOpenTaskDetail}
                  onMoveTask={handleMoveTaskWithinStatus}
                  onPatchTask={updateTaskRequest}
                  onUpdateAssignee={handleUpdateAssignee}
                  onRemoveAssignee={handleRemoveTaskAssignee}
                  color={status === 'Need Revision' ? 'error' : status === 'Done' ? 'green' : status === 'Cancelled' ? 'grey' : 'outline'}
                  currentRole={currentRole}
                  canModifyTasks={canModifyTasks}
                  canUseCancelledStatus={isSpaceOwner}
                  assigneeOptions={projectAssigneeOptions}
                />
              ))}
            </div>
          </DragDropContext>
        </div>
      )}

      {/* LIST VIEW */}
      {view === 'list' && (
        <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingBottom: '16px' }}>
          <div className="bg-white border border-outline-variant rounded-lg flex flex-col overflow-hidden shadow-sm" id="list-view-container">
            <div className="px-6 py-2 border-b border-[#DDE3F0] bg-[#FAFAFF] flex items-center justify-between flex-none">
              <div className="flex items-center gap-3">
                {canSelectTasks && sprint1Data.status !== 'Completed' && (
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded border-outline-variant cursor-pointer accent-primary"
                    checked={selectableTaskIds.length > 0 && selectableTaskIds.every(taskId => selectedTasks.includes(taskId))}
                    onChange={toggleAll}
                  />
                )}
                <span
                  className="material-symbols-outlined text-[18px] text-outline cursor-pointer transition-transform duration-200"
                  style={{ transform: isSprintExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                  onClick={() => setIsSprintExpanded(!isSprintExpanded)}
                >
                  expand_more
                </span>
                <div
                  ref={sprintInfoAnchorRef}
                  onClick={() => setIsSprintInfoOpen(!isSprintInfoOpen)}
                  className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100/80 px-2 py-0.5 rounded transition-all select-none"
                >
                  <span className="text-[12px] font-bold text-on-surface">{sprint1Data.name}</span>
                  <span className="text-[11px] text-outline">{sprint1Data.dateRange}</span>
                  <span className="material-symbols-outlined text-[14px] text-outline">info</span>
                </div>
                <span className="text-[11px] text-outline">({primarySprintTasks.length} work items)</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  <span className="px-1.5 py-0.5 bg-gray-200 text-[10px] font-bold rounded text-outline">
                    {primarySprintTasks.filter(t => t.status === 'New' || (isSpaceOwner && t.status === 'Cancelled')).length}
                  </span>
                  <span className="px-1.5 py-0.5 bg-[#ADC4FF] text-[10px] font-bold rounded text-[#003d9b]">
                    {primarySprintTasks.filter(t => ['In Progress', 'In Testing', 'Pending Review', 'Need Revision'].includes(t.status)).length}
                  </span>
                  <span className="px-1.5 py-0.5 bg-[#C2FFD9] text-[10px] font-bold rounded text-[#006D3A]">
                    {primarySprintTasks.filter(t => t.status === 'Done').length}
                  </span>
                </div>
                {canCreateInitialSprint && (
                  <button
                    type="button"
                    onClick={() => handleCreateSprint({ activate: true })}
                    className="px-3 py-1 bg-[#f0edff] text-[#5e4db2] border border-[#e6e1ff] rounded text-[11px] font-bold transition-colors shadow-sm hover:bg-[#e6e1ff]"
                  >
                    Start sprint
                  </button>
                )}
                {canModifyTasks && (() => {
                  const sprintAction = getSprintAction(sprint1Data);
                  if (!sprintAction) return null;
                  return (
                    <button
                      onClick={sprintAction.onClick}
                      disabled={sprintAction.disabled}
                      title={sprintAction.title}
                      className={`px-3 py-1 bg-[#f0edff] text-[#5e4db2] border border-[#e6e1ff] rounded text-[11px] font-bold transition-colors shadow-sm ${sprintAction.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#e6e1ff]'}`}
                    >
                      {sprintAction.label}
                    </button>
                  );
                })()}
                {/* Sprint 1 ... dropdown menu */}
                {canModifyTasks && sprint1Data.id && sprint1Data.status !== 'Completed' && (
                <div className="relative" data-sprint-menu>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenSprintMenuId(openSprintMenuId === 'sprint-1' ? null : 'sprint-1'); }}
                    className={`p-1 rounded hover:bg-surface-container transition-colors ${openSprintMenuId === 'sprint-1' ? 'bg-surface-container text-on-surface' : 'text-outline'}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                  </button>
                  {openSprintMenuId === 'sprint-1' && (
                    <div className="absolute right-0 top-full mt-1 w-[160px] bg-white border border-outline-variant rounded-lg shadow-2xl py-1 z-[200]">
                      {canStartSprint(sprint1Data) && (
                        <button
                          onClick={() => handleActivateSprint(sprint1Data.id)}
                          className="w-full px-4 py-2.5 text-[13px] text-left text-on-surface hover:bg-[#EBF0FF] hover:text-[#003d9b] transition-colors"
                        >
                          Start sprint
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEditSprint(sprint1Data)}
                        className="w-full px-4 py-2.5 text-[13px] text-left text-on-surface hover:bg-[#EBF0FF] hover:text-[#003d9b] transition-colors"
                      >
                        Edit sprint
                      </button>
                      <button
                        onClick={() => { setOpenSprintMenuId(null); setDeleteSprintConfirmId(sprint1Data.id); }}
                        className="w-full px-4 py-2.5 text-[13px] text-left text-error hover:bg-red-50 transition-colors"
                      >
                        Delete sprint
                      </button>
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>
            {/* selection toolbar moved to bottom-fixed container */}
            {isSprintExpanded && (
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low border-b border-outline-variant sticky top-0 z-10 bg-[#F4F5FF]">
                    <tr className="text-[11px] text-outline uppercase tracking-wider">
                      <th className="px-2 py-3 font-bold text-center">Task ID</th>
                      <th className="px-3 py-3 font-bold text-center">Points</th>
                      <th className="px-6 py-3 font-bold">Title</th>
                      <th className="px-6 py-3 font-bold">Assignee</th>
                      <th className="px-6 py-3 font-bold text-center">Priority</th>
                      <th className="px-6 py-3 font-bold">Status</th>
                      <th className="px-6 py-3 font-bold">Completed</th>
                      {canManageTasks && sprint1Data.status !== 'Completed' && <th className="px-6 py-3 font-bold text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {primarySprintTasks.map(task => (
                      <TaskRow
                        key={task.id}
                        {...task}
                        isAdmin={canManageTasks && sprint1Data.status !== 'Completed'}
                        canSelect={canSelectTasks && sprint1Data.status !== 'Completed'}
                        canModifyTasks={canModifyTasks && sprint1Data.status !== 'Completed'}
                        isSelected={selectedTasks.includes(task.id)}
                        isAnySelected={selectedTasks.length > 0}
                        onToggle={() => toggleTask(task.id)}
                        onOpenDetail={() => handleOpenTaskDetail(task)}
                        onDelete={() => setTaskToDelete(task)}
                        assigneeOptions={projectAssigneeOptions}
                        onUpdateAssignee={(user) => handleUpdateAssignee(task.id, user)}
                        onRemoveAssignee={(assigneeUserId) => handleRemoveTaskAssignee(task.id, assigneeUserId)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* + Create button below Sprint 1 table */}
            {isSprintExpanded && canModifyTasks && sprint1Data.id && sprint1Data.status !== 'Completed' && (
              <div className="px-4 py-2 border-t border-outline-variant/30 bg-white">
                <button
                  onClick={() => {
                    if (setCreateTaskInitialSprint) setCreateTaskInitialSprint(sprint1Data.name);
                    setShowCreateModal && setShowCreateModal(true);
                  }}
                  className="flex items-center gap-1.5 text-outline hover:text-[#5e4db2] transition-colors group"
                >
                  <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">add</span>
                  <span className="text-[12px] font-medium">Create task</span>
                </button>
              </div>
            )}
          </div>

          {/* EXTRA SPRINTS (created dynamically) */}
          {extraSprints.map((sprint) => {
            const extraSprintTasks = filteredTasks.filter(task => task.sprintId === sprint.id);
            return (
            <div key={sprint.id} className="mt-4 bg-white border border-outline-variant rounded-lg overflow-hidden shadow-sm">
              {/* Sprint Header */}
              <div className="px-6 py-2 border-b border-[#DDE3F0] bg-[#FAFAFF] flex items-center justify-between flex-none">
                <div className="flex items-center gap-3">
                  {canSelectTasks && sprint.status !== 'Completed' && <input type="checkbox" className="w-3.5 h-3.5 rounded border-outline-variant cursor-pointer accent-primary" />}
                  <span
                    className="material-symbols-outlined text-[18px] text-outline cursor-pointer transition-transform duration-200"
                    style={{ transform: expandedSprints[sprint.id] ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    onClick={() => toggleSprintExpanded(sprint.id)}
                  >
                    expand_more
                  </span>
                  <div className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100/80 px-2 py-0.5 rounded transition-all select-none">
                    <span className="text-[12px] font-bold text-on-surface">{sprint.name}</span>
                    <span className="text-[11px] text-outline">{sprint.dateRange}</span>
                    <span className="material-symbols-outlined text-[14px] text-outline">info</span>
                  </div>
                  <span className="text-[11px] text-outline">({extraSprintTasks.length} work items)</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 bg-gray-200 text-[10px] font-bold rounded text-outline">
                      {extraSprintTasks.filter(t => t.status === 'New' || (isSpaceOwner && t.status === 'Cancelled')).length}
                    </span>
                    <span className="px-1.5 py-0.5 bg-[#ADC4FF] text-[10px] font-bold rounded text-[#003d9b]">
                      {extraSprintTasks.filter(t => ['In Progress', 'In Testing', 'Pending Review', 'Need Revision'].includes(t.status)).length}
                    </span>
                    <span className="px-1.5 py-0.5 bg-[#C2FFD9] text-[10px] font-bold rounded text-[#006D3A]">
                      {extraSprintTasks.filter(t => t.status === 'Done').length}
                    </span>
                  </div>
                  {canModifyTasks && (() => {
                    const sprintAction = getSprintAction(sprint);
                    if (!sprintAction) return null;
                    return (
                      <button
                        onClick={sprintAction.onClick}
                        disabled={sprintAction.disabled}
                        title={sprintAction.title}
                        className={`px-3 py-1 bg-[#f0edff] text-[#5e4db2] border border-[#e6e1ff] rounded text-[11px] font-bold transition-colors shadow-sm ${sprintAction.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#e6e1ff]'}`}
                      >
                        {sprintAction.label}
                      </button>
                    );
                  })()}
                  {/* Extra sprint ... dropdown menu */}
                  {canModifyTasks && sprint.status !== 'Completed' && (
                  <div className="relative" data-sprint-menu>
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenSprintMenuId(openSprintMenuId === sprint.id ? null : sprint.id); }}
                      className={`p-1 rounded hover:bg-surface-container transition-colors ${openSprintMenuId === sprint.id ? 'bg-surface-container text-on-surface' : 'text-outline'}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                    </button>
                    {openSprintMenuId === sprint.id && (
                      <div className="absolute right-0 top-full mt-1 w-[160px] bg-white border border-outline-variant rounded-lg shadow-2xl py-1 z-[200]">
                        {shouldShowStartSprint(sprint) && (
                          <button
                            disabled={!canStartSprint(sprint)}
                            title={canStartSprint(sprint) ? undefined : 'Complete the previous sprint before starting this sprint.'}
                            onClick={() => {
                              if (canStartSprint(sprint)) handleActivateSprint(sprint.id);
                            }}
                            className={`w-full px-4 py-2.5 text-[13px] text-left transition-colors ${canStartSprint(sprint) ? 'text-on-surface hover:bg-[#EBF0FF] hover:text-[#003d9b]' : 'text-outline opacity-50 cursor-not-allowed'}`}
                          >
                            Start sprint
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditSprint(sprint)}
                          className="w-full px-4 py-2.5 text-[13px] text-left text-on-surface hover:bg-[#EBF0FF] hover:text-[#003d9b] transition-colors"
                        >
                          Edit sprint
                        </button>
                        <button
                          onClick={() => { setOpenSprintMenuId(null); setDeleteSprintConfirmId(sprint.id); }}
                          className="w-full px-4 py-2.5 text-[13px] text-left text-error hover:bg-red-50 transition-colors"
                        >
                          Delete sprint
                        </button>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>

              {/* Sprint Body */}
              {expandedSprints[sprint.id] && extraSprintTasks.length > 0 && (
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-low border-b border-outline-variant sticky top-0 z-10 bg-[#F4F5FF]">
                      <tr className="text-[11px] text-outline uppercase tracking-wider">
                        <th className="px-2 py-3 font-bold text-center">Task ID</th>
                        <th className="px-3 py-3 font-bold text-center">Points</th>
                        <th className="px-6 py-3 font-bold">Title</th>
                        <th className="px-6 py-3 font-bold">Assignee</th>
                        <th className="px-6 py-3 font-bold text-center">Priority</th>
                        <th className="px-6 py-3 font-bold">Status</th>
                        <th className="px-6 py-3 font-bold">Completed</th>
                        {canManageTasks && sprint.status !== 'Completed' && <th className="px-6 py-3 font-bold text-center">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {extraSprintTasks.map(task => (
                        <TaskRow
                          key={task.id}
                          {...task}
                          isAdmin={canManageTasks && sprint.status !== 'Completed'}
                          canSelect={canSelectTasks && sprint.status !== 'Completed'}
                          canModifyTasks={canModifyTasks && sprint.status !== 'Completed'}
                          isSelected={selectedTasks.includes(task.id)}
                          isAnySelected={selectedTasks.length > 0}
                          onToggle={() => toggleTask(task.id)}
                          onOpenDetail={() => handleOpenTaskDetail(task)}
                          onDelete={() => {
                            setTaskToDelete(task);
                          }}
                          assigneeOptions={projectAssigneeOptions}
                          onUpdateAssignee={(user) => handleUpdateAssignee(task.id, user)}
                          onRemoveAssignee={(assigneeUserId) => handleRemoveTaskAssignee(task.id, assigneeUserId)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sprint Body - Empty State */}
              {expandedSprints[sprint.id] && extraSprintTasks.length === 0 && (
                <div className="border-t border-dashed border-outline-variant/60 p-6 flex flex-col items-center justify-center bg-surface-container-lowest min-h-[80px]">
                  <span className="material-symbols-outlined text-[28px] text-outline/50 mb-1">sprint</span>
                  <span className="text-[11px] text-outline italic">No tasks in this sprint yet. Drag tasks here or create new ones.</span>
                </div>
              )}

              {/* + Create button below sprint body */}
              {expandedSprints[sprint.id] && canModifyTasks && sprint.status !== 'Completed' && (
                <div className="px-4 py-2 border-t border-outline-variant/30 bg-white">
                  <button
                    onClick={() => {
                      if (setCreateTaskInitialSprint) setCreateTaskInitialSprint(sprint.name);
                      setShowCreateModal && setShowCreateModal(true);
                    }}
                    className="flex items-center gap-1.5 text-outline hover:text-[#5e4db2] transition-colors group"
                  >
                    <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">add</span>
                    <span className="text-[12px] font-medium">Create task</span>
                  </button>
                </div>
              )}
            </div>
            );
          })}

          {/* CREATE SPRINT BUTTON */}
          {canModifyTasks && <div className="mt-4 flex justify-end" id="backlog-section">
            <button
              onClick={() => handleCreateSprint({ activate: !hasAvailableSprint })}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#f0edff] text-[#5e4db2] border border-[#e6e1ff] rounded-lg text-[12px] font-bold hover:bg-[#e6e1ff] hover:shadow-md transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {hasAvailableSprint ? 'Create Sprint' : 'Start sprint'}
            </button>
          </div>}
        </div>
      )}

      {/* Popovers & Modals */}
      {/* Bottom-fixed selection toolbar */}
      {selectedTasks.length > 0 && canSelectTasks && (
        <div className="fixed left-6 right-6 bottom-4 z-50 flex justify-center pointer-events-none">
          <div className="w-full max-w-[620px] pointer-events-auto rounded-xl border border-[#6B7280] bg-white px-3 py-2 text-[#2D1B4E] shadow-[0_10px_30px_rgba(94,77,178,0.16)] relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-[#F0EDFF] px-2.5 py-1 text-[13px] font-bold text-[#5E4DB2]">{selectedTasks.length} selected</span>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-white hover:bg-[#F0EDFF] text-[#4C2B74] border border-[#D8D1FF] transition shadow-sm"
                >
                  {selectableTaskIds.length > 0 && selectableTaskIds.every(taskId => selectedTasks.includes(taskId)) ? 'Unselect all' : 'Select all'}
                </button>
                {canModifyTasks && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowToolbarStatusMenu(prev => !prev); }}
                      className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-[#5E4DB2] hover:bg-[#4C3A9E] text-white border border-[#5E4DB2] transition shadow-sm"
                    >
                      Change status
                    </button>
                    {showToolbarStatusMenu && (
                      <div className="absolute left-0 bottom-full mb-2 w-40 bg-white border border-outline-variant rounded-lg shadow-2xl py-1 z-50" onClick={(e) => e.stopPropagation()}>
                        {toolbarStatuses.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => changeStatusForSelected(s)}
                            className="w-full px-4 py-2 text-left text-[13px] hover:bg-[#EBF0FF] transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canManageTasks && (
                  <button
                    type="button"
                    onClick={handleDeleteSelectedTasks}
                    className="px-3 py-1 text-[12px] font-semibold rounded-md bg-red-600 hover:bg-red-700 text-white shadow-sm transition"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedTasks([]); }}
                  aria-label="Close selection toolbar"
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-transparent text-[#7A6AA8] hover:bg-[#F0EDFF] hover:text-[#4C2B74] transition"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <SprintInfoPopover
        isOpen={isSprintInfoOpen}
        onClose={() => setIsSprintInfoOpen(false)}
        anchorRef={sprintInfoAnchorRef}
        completedTasksCount={sprintInfoTasks.filter(t => t.status === 'Done').length}
        openTasksCount={sprintInfoTasks.filter(t => t.status !== 'Done').length}
      />

      <CompleteSprintModal
        isOpen={isCompleteSprintOpen}
        onClose={() => { setIsCompleteSprintOpen(false); setCompleteSprintTarget(null); }}
        sprintName={completeSprintTarget?.name || sprint1Data.name}
        completedTasksCount={completeSprintTasks.filter(t => t.status === 'Done').length}
        openTasksCount={completeSprintTasks.filter(t => t.status !== 'Done').length}
        onComplete={handleCompleteSprint}
      />

      <EditSprintModal
        isOpen={isEditSprintOpen}
        onClose={() => { setIsEditSprintOpen(false); setSprintToEdit(null); }}
        sprint={sprintToEdit}
        onUpdate={handleUpdateSprint}
      />

      {/* Delete Sprint Confirmation Popup */}
      {deleteSprintConfirmId && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40"
          onClick={() => setDeleteSprintConfirmId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-[350px] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-orange-600 text-xl">warning</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">Delete Sprint</h2>
                  <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                    Are you sure you want to delete{' '}
                    <strong className="text-[#121c2a]">
                      {[sprint1Data, ...extraSprints].find(s => s.id === deleteSprintConfirmId)?.name || 'this sprint'}
                    </strong>?
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDeleteSprintConfirmId(null)}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteSprint(deleteSprintConfirmId)}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <TaskDetailModal
        task={selectedTaskDetail}
        onClose={handleCloseTaskDetail}
        tasks={tasks}
        assigneeOptions={projectAssigneeOptions}
        currentRole={currentRole}
        currentSpaceRole={currentSpaceRole}
        currentUser={currentUser}
        readOnly={selectedTaskDetailReadOnly}
        onUpdateTask={handleUpdateTask}
        onAddAssignee={(taskId, user) => handleUpdateAssignee(taskId, user)}
        onRemoveAssignee={handleRemoveTaskAssignee}
      />

      <DeleteTaskModal
        isOpen={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleDeleteTask}
        task={taskToDelete}
      />
    </div>
  );
}

function KanbanColumn({ title, tasks, setTasks, onCreateTask, onOpenDetail, onMoveTask, onPatchTask, onUpdateAssignee, onRemoveAssignee, color = 'outline', currentRole, canModifyTasks = true, canUseCancelledStatus = false, assigneeOptions = availableAssignees }) {
  const headerClass = `bg-[#E0E8FF] border-[#ADC4FF] ${title === 'Need Revision' ? 'text-[#BA1A1A]' :
    title === 'Done' ? 'text-[#006D3A]' :
      title === 'Cancelled' ? 'text-[#475467]' :
        'text-[#003d9b]'
    }`;

  return (
    <div className="kanban-column group flex flex-col bg-[#F3F4FC] border border-outline-variant/50 rounded-xl p-2 min-w-[300px]" style={{ height: '100%', maxHeight: '100%', flex: '0 0 300px' }}>
      <div className={`flex justify-between items-center px-4 py-2 rounded-xl border-b-2 ${headerClass} mb-1`}>
        <span className="text-[11px] font-bold uppercase tracking-wider ">{title}</span>
      </div>
      <Droppable droppableId={title}>
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={`space-y-3 px-0.5 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
            style={{ flex: '1 1 0', minHeight: '50px', overflowY: 'auto', overflowX: 'visible', scrollbarWidth: 'thin' }}
          >
            {tasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} totalCount={tasks.length} setTasks={setTasks} onOpenDetail={onOpenDetail} onMoveTask={onMoveTask} onPatchTask={onPatchTask} onUpdateAssignee={onUpdateAssignee} onRemoveAssignee={onRemoveAssignee} currentRole={currentRole} canModifyTasks={canModifyTasks} canUseCancelledStatus={canUseCancelledStatus} assigneeOptions={assigneeOptions} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      {canModifyTasks && (
        <button
          onClick={onCreateTask}
          className="hidden group-hover:flex items-center gap-2 px-3 py-2 mt-2 text-outline hover:text-on-surface transition-all w-full rounded hover:bg-surface-container/50"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span className="text-[13px] tracking-wide">Create</span>
        </button>
      )}
    </div>
  );
}

function TaskCard({ task, index, totalCount, setTasks, onOpenDetail, onMoveTask, onPatchTask, onUpdateAssignee, onRemoveAssignee, currentRole, canModifyTasks = true, canUseCancelledStatus = false, assigneeOptions = availableAssignees }) {
  const { id, title, date, pts, priority, status, attachments = [] } = task;
  const visibleTaskId = task.displayId || id;
  const previewImage = attachments.find(att => att.type === 'image' && att.previewUrl)?.previewUrl;
  const [hasPreviewImageError, setHasPreviewImageError] = React.useState(false);
  const isOverdue = isTaskOverdue(task.completed_at || date, status);
  const isDueToday = !isOverdue && isTaskDueToday(task.completed_at || date, status);
  const displayDate = task.completed_at ? formatTaskDate(task.completed_at) : date;
  const taskCardDateClass = isOverdue
    ? OVERDUE_BADGE_CLASS
    : isDueToday
      ? DUE_TODAY_BADGE_CLASS
      : 'bg-surface-container text-on-surface-variant';
  const taskCardStateClass = isOverdue
    ? 'border-white'
    : isDueToday
      ? DUE_TODAY_BORDER_CLASS
      : '';
  const normalizedPts = Number.isFinite(Number(pts)) ? Number(pts) : 0;
  const [isTitleEditing, setIsTitleEditing] = React.useState(false);
  const [tempTitle, setTempTitle] = React.useState(title || '');
  const [isEditing, setIsEditing] = React.useState(false);
  const [tempPts, setTempPts] = React.useState(normalizedPts);
  const [showMenu, setShowMenu] = React.useState(false);
  const [showAssigneeMenu, setShowAssigneeMenu] = React.useState(false);
  const [showMoveSubMenu, setShowMoveSubMenu] = React.useState(false);
  const [showStatusSubMenu, setShowStatusSubMenu] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const titleInputRef = useRef(null);
  const pointsEditorRef = useRef(null);
  const assigneeBtnRef = useRef(null);
  const assigneeMenuRef = useRef(null);

  const statuses = canUseCancelledStatus
    ? ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done', 'Cancelled']
    : ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done'];
  
  const assignedUsers = getTaskAssigneeUsers(task);
const assigneeSummary = formatAssigneeSummary(assignedUsers, 2);
const unassignedProfile = getAssigneeProfile('');

const savePointsValue = React.useCallback(async (value) => {
  const nextPts = parseNonNegativeStoryPoints(value);
  if (nextPts === null) {
    setTempPts(normalizedPts);
    setIsEditing(false);
    return;
  }
  setTempPts(nextPts);
  try {
    if (nextPts !== normalizedPts) {
      await onPatchTask?.(id, { story_points: nextPts });
    }
  } finally {
    setIsEditing(false);
  }
}, [id, normalizedPts, onPatchTask]);

  useEffect(() => {
    setHasPreviewImageError(false);
  }, [previewImage]);

  useEffect(() => {
    if (!isTitleEditing) {
      setTempTitle(title || '');
    }
  }, [isTitleEditing, title]);

  useEffect(() => {
    if (!isTitleEditing) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isTitleEditing]);

  useEffect(() => {
    if (!isEditing) {
      setTempPts(normalizedPts);
    }
  }, [isEditing, normalizedPts]);

  useEffect(() => {
    if (!isEditing) return;
    const handleClickOutside = (e) => {
      if (pointsEditorRef.current && !pointsEditorRef.current.contains(e.target)) {
        void savePointsValue(tempPts);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, savePointsValue, tempPts]);

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)) {
        setShowMenu(false);
        setShowMoveSubMenu(false);
        setShowStatusSubMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    if (!showAssigneeMenu) return;
    const handleClickOutside = (e) => {
      if (assigneeMenuRef.current && !assigneeMenuRef.current.contains(e.target) &&
        assigneeBtnRef.current && !assigneeBtnRef.current.contains(e.target)) {
        setShowAssigneeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAssigneeMenu]);

  const handleMenuToggle = (e) => {
    e.stopPropagation();
    if (showMenu) {
      setShowMenu(false);
      setShowMoveSubMenu(false);
      setShowStatusSubMenu(false);
      return;
    }
    // Tính toán tọa độ fixed dựa trên vị trí nút ...
    const rect = btnRef.current.getBoundingClientRect();
    // Menu rộng 192px (w-48), ưu tiên mở sang trái nếu không đủ chỗ bên phải
    const menuWidth = 192;
    let left = rect.right - menuWidth;
    if (left < 8) left = rect.left;
    setMenuPos({ top: rect.bottom + 4, left });
    setShowMenu(true);
  };

  const handleMove = (direction) => {
    onMoveTask?.(task.id, direction);
    setShowMenu(false);
    setShowMoveSubMenu(false);
  };

  const handleOpenTitleEditor = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canModifyTasks) return;
    setShowMenu(false);
    setShowAssigneeMenu(false);
    setTempTitle(title || '');
    setIsTitleEditing(true);
  };

  const handleCancelTitleEdit = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    setTempTitle(title || '');
    setIsTitleEditing(false);
  };

  const handleSaveTitleEdit = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    const nextTitle = tempTitle.trim();
    if (!nextTitle) {
      setTempTitle(title || '');
      setIsTitleEditing(false);
      return;
    }

    try {
      if (nextTitle !== title) {
        await onPatchTask?.(id, { title: nextTitle });
      }
    } finally {
      setIsTitleEditing(false);
    }
  };

  const handleOpenPointsEditor = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canModifyTasks) return;
    setShowMenu(false);
    setShowAssigneeMenu(false);
    setTempPts(normalizedPts);
    setIsEditing(true);
  };

  const handleCancelPointsEdit = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setTempPts(normalizedPts);
    setIsEditing(false);
  };

  const handleSavePointsEdit = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await savePointsValue(tempPts);
  };

  return (
    <Draggable draggableId={id} index={index} isDragDisabled={!canModifyTasks}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{ ...provided.draggableProps.style }}
          className={`relative bg-white p-2.5 border border-outline-variant rounded shadow-sm hover:bg-white transition-all group ${taskCardStateClass} ${status === 'Cancelled' ? 'opacity-40' : 'group-hover:text-[#1E40AF]'} ${snapshot.isDragging ? 'shadow-xl ring-2 ring-primary/20 scale-[1.02] z-50' : ''}`}
          onClick={(e) => {
            if (e.defaultPrevented || isTitleEditing || isEditing) return;
            onOpenDetail && onOpenDetail(task);
          }}
        >
          <div className="flex justify-between items-start mb-2 gap-2">
            <div className={`min-w-0 flex-1 text-[11px] leading-snug flex items-center gap-1.5 ${status === 'Cancelled' ? 'font-normal text-outline' : 'font-medium text-[#003d9b] group-hover:text-blue-700 text-on-surface'}`}>
              {isTitleEditing ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={tempTitle}
                  onChange={(event) => setTempTitle(event.target.value)}
                  onBlur={handleSaveTitleEdit}
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleSaveTitleEdit(event);
                    }
                    if (event.key === 'Escape') {
                      handleCancelTitleEdit(event);
                    }
                  }}
                  className="h-7 min-w-0 flex-1 rounded border border-primary bg-white px-2 text-[11px] font-semibold text-[#003d9b] outline-none shadow-sm"
                />
              ) : (
                <>
                  <span className="min-w-0 break-words">{title}</span>
                  {canModifyTasks && (
                    <button
                      type="button"
                      onClick={handleOpenTitleEditor}
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-outline opacity-0 transition-opacity hover:bg-primary/10 hover:text-primary group-hover:opacity-100"
                      aria-label={`Edit title for ${id}`}
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                    </button>
                  )}
                </>
              )}
            </div>
            {canModifyTasks && <div>
              <button
                ref={btnRef}
                onClick={handleMenuToggle}
                className={`p-0.5 hover:bg-surface-container rounded cursor-pointer shrink-0 transition-opacity ${showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              >
                <span className="material-symbols-outlined text-[18px] text-outline">more_horiz</span>
              </button>
            </div>}
          </div>

          {/* Portal Menu - nổi lên trên mọi thứ với position:fixed */}
          {showMenu && createPortal(
            <div
              ref={menuRef}
              style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
              className="bg-white border border-outline-variant shadow-2xl rounded-lg py-2 w-48"
            >
              {/* 1. Move work item */}
              {/* ĐÃ XÓA onMouseEnter VÀ onMouseLeave Ở ĐÂY */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoveSubMenu(!showMoveSubMenu);
                    setShowStatusSubMenu(false); // Bấm cái này thì đóng cái kia
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#E8EAF6] hover:text-[#003d9b] hover:font-bold transition-colors text-[13px] text-left ${showMoveSubMenu ? 'bg-[#E8EAF6] text-[#003d9b] font-bold' : 'text-on-surface'
                    }`}
                >
                  <span>Move work item</span>
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>

                {/* Menu con hiển thị khi showMoveSubMenu = true */}
                {showMoveSubMenu && (
                  <div
                    className="absolute top-0 left-full ml-2 bg-white border border-outline-variant shadow-2xl rounded-lg py-2 w-[160px]"
                    style={{ zIndex: 10000 }}
                  >
                    {index > 0 && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleMove('top'); }} className="w-full px-4 py-2.5 hover:bg-[#E8EAF6] hover:text-[#003d9b] hover:font-semibold transition-colors text-[13px] text-left text-on-surface">To the top</button>
                        <button onClick={(e) => { e.stopPropagation(); handleMove('up'); }} className="w-full px-4 py-2.5 hover:bg-[#E8EAF6] hover:text-[#003d9b] hover:font-semibold transition-colors text-[13px] text-left text-on-surface">Up</button>
                      </>
                    )}
                    {index < totalCount - 1 && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleMove('down'); }} className="w-full px-4 py-2.5 hover:bg-[#E8EAF6] hover:text-[#003d9b] hover:font-semibold transition-colors text-[13px] text-left text-on-surface">Down</button>
                        <button onClick={(e) => { e.stopPropagation(); handleMove('bottom'); }} className="w-full px-4 py-2.5 hover:bg-[#E8EAF6] hover:text-[#003d9b] hover:font-semibold transition-colors text-[13px] text-left text-on-surface">To the bottom</button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Change status */}
              {/* ĐÃ XÓA onMouseEnter VÀ onMouseLeave Ở ĐÂY */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStatusSubMenu(!showStatusSubMenu);
                    setShowMoveSubMenu(false); // Bấm cái này thì đóng cái kia
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#E8EAF6] hover:text-[#003d9b] hover:font-bold transition-colors text-[13px] text-left ${showStatusSubMenu ? 'bg-[#E8EAF6] text-[#003d9b] font-bold' : 'text-on-surface'
                    }`}
                >
                  <span>Change status</span>
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>

                {/* Submenu con hiển thị danh sách status (New, In Progress,...) */}
                {showStatusSubMenu && (
                  <div
                    className="absolute top-0 left-full ml-2 bg-white border border-outline-variant shadow-2xl rounded-lg py-2 w-[160px]"
                    style={{ zIndex: 10000 }}
                  >
                    {statuses.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setTasks(prev => prev.map(t => t.id === id ? { ...t, status: s } : t));
                          try {
                            await onPatchTask?.(id, { task_status: TASK_STATUS_TO_API[s] || 'new' });
                          } catch {
                            setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
                          }
                          setShowMenu(false);
                          setShowStatusSubMenu(false);
                        }}
                        className="w-full px-4 py-2.5 hover:bg-[#E8EAF6] hover:text-[#003d9b] hover:font-semibold transition-colors text-[13px] text-left text-on-surface"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>,
            document.body
          )}


          <div className="flex items-center gap-2 mb-4">
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-sm ${taskCardDateClass}`}>
              <span className="material-symbols-outlined text-[14px]">calendar_month</span>
              <span className="text-[11px] font-semibold">{displayDate}</span>
            </div>
          </div>
          {previewImage && !hasPreviewImageError ? (
            <div className="mb-3 h-28 overflow-hidden rounded-lg bg-surface-container">
              <img
                src={previewImage}
                alt=""
                className="block h-full w-full object-cover"
                onError={() => setHasPreviewImageError(true)}
              />
            </div>
          ) : previewImage ? (
            <div className="mb-3 flex h-16 items-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container px-3 text-[11px] font-semibold text-outline">
              <span className="material-symbols-outlined text-[18px]">image</span>
              <span className="truncate">Image preview unavailable</span>
            </div>
          ) : null}
          <div className="flex justify-between items-center mt-auto">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] text-outline font-bold uppercase ${status === 'Done' ? 'line-through' : ''}`}>{visibleTaskId}</span>
              <div
                ref={pointsEditorRef}
                className="relative flex items-center"
                onMouseDown={(event) => {
                  if (canModifyTasks) event.stopPropagation();
                }}
                onClick={(event) => {
                  if (canModifyTasks) event.stopPropagation();
                }}
              >
                <button
                  type="button"
                  className={`px-1 py-0.5 bg-surface-container rounded-sm text-[9px] font-bold text-outline leading-none ${canModifyTasks ? 'cursor-pointer hover:bg-primary/10 hover:text-primary' : 'cursor-default'}`}
                  onClick={handleOpenPointsEditor}
                  aria-label={`Edit story points for ${id}`}
                  disabled={!canModifyTasks}
                >
                  {normalizedPts} pts
                </button>
                {isEditing && (
                <div
                  className="absolute left-0 top-full z-30 mt-2 flex w-[56px] flex-col rounded-md border border-primary bg-white p-1 shadow-xl"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="h-7 w-full rounded border border-outline-variant px-1.5 text-[11px] outline-none focus:border-primary"
                    value={tempPts}
                    onChange={(e) => setTempPts(e.target.value)}
                    onFocus={(event) => event.target.select()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        handleSavePointsEdit(event);
                      }
                      if (event.key === 'Escape') {
                        handleCancelPointsEdit(event);
                      }
                    }}
                    autoFocus
                  />
                </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 relative">
              {priority === 'High' ? (
                <span className="material-symbols-outlined text-[#BA1A1A] text-[20px] font-bold">keyboard_arrow_up</span>
              ) : priority === 'Medium' ? (
                <span style={{ fontSize: '20px', color: '#F97316', fontWeight: 700 }}>=</span>
              ) : (
                <span className="material-symbols-outlined text-[#4C2B74] text-[20px] font-bold">keyboard_arrow_down</span>
              )}
              <div className="relative flex -space-x-1">
                {assignedUsers.length > 0 ? assignedUsers.slice(0, 2).map(user => {
                  const userId = user.user_id || user.id;
                  return (
                    <div key={userId || user.name} className="relative group/avatar">
                      <button
                        ref={assignedUsers[0] === user ? assigneeBtnRef : undefined}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canModifyTasks) return;
                          setShowAssigneeMenu(prev => !prev);
                        }}
                        className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center overflow-hidden text-[10px] font-bold ${canModifyTasks ? '' : 'cursor-default'}`}
                        style={{ backgroundColor: user.color || '#9CA3AF', color: user.textColor || '#FFFFFF' }}
                      >
                        {(user.avatarUrl || user.avatar_url) ? (
                          <img src={user.avatarUrl || user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
                        ) : (
                          user.initials || getInitials(user.name)
                        )}
                      </button>
                      {canModifyTasks && userId && (
                        <button
                          type="button"
                          onClick={async (event) => {
                            event.stopPropagation();
                            await onRemoveAssignee?.(id, userId);
                          }}
                          className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold leading-none text-slate-500 shadow-sm hover:bg-slate-200 group-hover/avatar:flex"
                          aria-label={`Remove ${user.name}`}
                        >
                          x
                        </button>
                      )}
                    </div>
                  );
                }) : (
                  <button
                    ref={assigneeBtnRef}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!canModifyTasks) return;
                      setShowAssigneeMenu(prev => !prev);
                    }}
                    className={`w-6 h-6 rounded-full border border-outline-variant flex items-center justify-center text-[10px] font-bold ${canModifyTasks ? '' : 'cursor-default'}`}
                    style={{ backgroundColor: unassignedProfile.color, color: unassignedProfile.textColor || '#111' }}
                  >
                    <span className="material-symbols-outlined text-[16px]">person</span>
                  </button>
                )}
                {assignedUsers.length > 2 && (
                  <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-700">
                    +{assignedUsers.length - 2}
                  </div>
                )}
              </div>
              {showAssigneeMenu && (
                <div
                  ref={assigneeMenuRef}
                  className="absolute right-0 top-full mt-2 w-40 bg-white border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {assigneeOptions.map(user => {
                    const userId = user.user_id || user.id || '';
                    const isAssigned = userId && assignedUsers.some(assigned => (assigned.user_id || assigned.id) === userId);
                    return (
                    <button
                      key={user.name}
                      type="button"
                      onClick={async (event) => {
                        event.stopPropagation();
                        setShowAssigneeMenu(false);
                        await onUpdateAssignee?.(id, user);
                      }}
                      disabled={Boolean(isAssigned)}
                      className={`w-full px-3 py-2 flex items-center gap-2 text-[11px] text-left transition-colors ${isAssigned ? 'bg-gray-50 text-gray-400 cursor-default' : 'hover:bg-[#EBF0FF]'}`}
                    >
                      <AssigneeAvatar user={user} sizeClass="w-7 h-7" textClass="text-[10px]" />
                      <span>{user.name}</span>
                      {isAssigned && <span className="ml-auto text-[10px] font-bold">Added</span>}
                    </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

function TaskRow({ id, displayId, title, assignee, pts, status, date, completed_at, is_overdue, is_due_today, priority, isSelected, isAnySelected, onToggle, onOpenDetail, onDelete, onUpdateAssignee, isAdmin = true, canSelect = true, canModifyTasks = true, assigneeOptions = availableAssignees }) {
  const visibleTaskId = displayId || id;
function TaskRow({ id, title, assignee, assignees = [], assigneeId, pts, status, date, completed_at, is_overdue, is_due_today, priority, isSelected, isAnySelected, onToggle, onOpenDetail, onDelete, onUpdateAssignee, onRemoveAssignee, isAdmin = true, canSelect = true, canModifyTasks = true, assigneeOptions = availableAssignees }) {
  const isOverdue = isTaskOverdue(completed_at || date, status);
  const isDueToday = !isOverdue && isTaskDueToday(completed_at || date, status);
  const displayDate = completed_at ? formatTaskDate(completed_at) : date;
  const dateTextClass = isOverdue ? OVERDUE_TEXT_CLASS : isDueToday ? DUE_TODAY_TEXT_CLASS : 'text-outline';
  const statusClass = status === 'Need Revision'
    ? 'bg-[#FFF0F0] text-[#BA1A1A]'
    : status === 'Done'
      ? 'bg-[#E6FFF0] text-[#006D3A]'
      : status === 'Cancelled' || status === 'New'
        ? 'bg-[#F2F4F7] text-[#475467]'
        : 'bg-[#E0E8FF] text-[#003d9b]';

  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const [assigneeMenuPos, setAssigneeMenuPos] = useState({ top: 0, left: 0 });
  const assigneeBtnRef = useRef(null);
  const assigneeMenuRef = useRef(null);
  const assignedUsers = getTaskAssigneeUsers({ assignee, assignees, assigneeId });
  const assigneeSummary = formatAssigneeSummary(assignedUsers, 2);

  const toggleAssigneeMenu = (event) => {
    event.stopPropagation();
    if (!canModifyTasks) return;
    if (showAssigneeMenu) {
      setShowAssigneeMenu(false);
      return;
    }

    const rect = assigneeBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = 176;
      const viewportPadding = 8;
      const left = Math.min(
        Math.max(rect.left, viewportPadding),
        window.innerWidth - menuWidth - viewportPadding
      );
      setAssigneeMenuPos({ top: rect.bottom + 6, left });
    }
    setShowAssigneeMenu(true);
  };

  useEffect(() => {
    if (!showAssigneeMenu) return;
    const handleClickOutside = (e) => {
      if (assigneeMenuRef.current && !assigneeMenuRef.current.contains(e.target) &&
        assigneeBtnRef.current && !assigneeBtnRef.current.contains(e.target)) {
        setShowAssigneeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAssigneeMenu]);

  return (
    <tr
      className={`group hover:bg-surface-container-low/50 transition-colors cursor-pointer ${isSelected ? 'bg-[#e6f0ff]' : ''}`}
      onClick={() => onOpenDetail && onOpenDetail()}
    >
      <td className="px-2 py-2">
        <div className="flex items-center justify-center gap-3">
          {canSelect && (
            <input
              type="checkbox"
              className={`w-3.5 h-3.5 rounded border-outline-variant cursor-pointer accent-primary transition-opacity duration-150 ${isAnySelected ? 'visible opacity-100' : 'invisible opacity-0 group-hover:visible group-hover:opacity-100'}`}
              checked={isSelected}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            />
          )}
          <span className={`text-[11px] font-medium text-outline ${status === 'Done' ? 'line-through text-slate-500' : ''}`}>{visibleTaskId}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-center">
        <span className="inline-flex min-w-8 items-center justify-center rounded bg-surface-container px-2 py-0.5 text-[10px] font-bold text-outline">
          {pts} pts
        </span>
      </td>
      <td className={`px-4 py-2 font-semibold text-[11px] ${isSelected ? 'text-blue-700' : 'text-on-surface'}`}>{title}</td>
      <td className="px-4 py-2">
        <div className="relative inline-flex items-center">
          {(() => {
            const profile = getAssigneeProfile('');
            return (
              <div className="relative">
                <button
                  ref={assigneeBtnRef}
                  type="button"
                  onClick={toggleAssigneeMenu}
                  className={`flex items-center gap-2 rounded-xl bg-white px-2 py-1 text-[11px] transition-colors ${canModifyTasks ? 'hover:bg-[#F4F5F7]' : 'cursor-default'}`}
                >
                  {assignedUsers.length > 0 ? (
                    <>
                      <div className="flex -space-x-1">
                        {assignedUsers.slice(0, 4).map(user => {
                          const userId = user.user_id || user.id;
                          return (
                            <span
                              key={userId || user.name}
                              className="relative group/avatar inline-flex h-5 w-5 items-center justify-center overflow-visible"
                              title={user.name}
                            >
                              <span
                                className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border-2 border-white text-[9px] font-bold"
                                style={{ backgroundColor: user.color || '#9CA3AF', color: user.textColor || '#FFFFFF' }}
                              >
                                {(user.avatarUrl || user.avatar_url) ? (
                                  <img src={user.avatarUrl || user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
                                ) : (
                                  user.initials || getInitials(user.name)
                                )}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                      <span className="inline-flex max-w-[180px]">
                        <span className="truncate">{assigneeSummary.shortText}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: profile.color, color: profile.textColor || '#111' }}
                      >
                        {profile.initials}
                      </div>
                      <span>Unassigned</span>
                    </>
                  )}
                </button>
                {showAssigneeMenu && canModifyTasks && createPortal(
                  <div
                    ref={assigneeMenuRef}
                    style={{ position: 'fixed', top: assigneeMenuPos.top, left: assigneeMenuPos.left, zIndex: 10000 }}
                    className="w-44 bg-white border border-outline-variant rounded-xl shadow-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {assigneeOptions.map(user => {
                      const userId = user.user_id || user.id || '';
                      const isAssigned = userId && assignedUsers.some(assigned => (assigned.user_id || assigned.id) === userId);
                      return (
                      <button
                        key={user.name}
                      type="button"
                        onClick={async (event) => {
                          event.stopPropagation();
                          setShowAssigneeMenu(false);
                          await onUpdateAssignee?.(user);
                        }}
                        disabled={Boolean(isAssigned)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors ${isAssigned ? 'bg-gray-50 text-gray-400 cursor-default' : 'hover:bg-[#EBF0FF]'}`}
                      >
                        <AssigneeAvatar user={user} sizeClass="w-6 h-6" textClass="text-[10px]" />
                        <span>{user.name}</span>
                        {isAssigned && <span className="ml-auto text-[10px] font-bold">Added</span>}
                      </button>
                      );
                    })}
                  </div>,
                  document.body
                )}
              </div>
            );
          })()}
        </div>
      </td>
      <td className="px-4 py-2 text-center">
        {priority === 'High' ? (
          <span className="material-symbols-outlined text-[#BA1A1A] font-bold text-[16px]">keyboard_arrow_up</span>
        ) : priority === 'Medium' ? (
          <span style={{ fontSize: '16px', color: '#F97316', fontWeight: 700 }}>=</span>
        ) : (
          <span className="material-symbols-outlined text-[#4C2B74] font-bold text-[16px]">keyboard_arrow_down</span>
        )}
      </td>
      <td className="px-4 py-2">
        <span className={`px-3 py-1 rounded-full ${statusClass} text-[9px] font-bold uppercase`}>{status}</span>
      </td>
      <td className={`px-4 py-2 text-[11px] font-semibold ${dateTextClass}`}>{displayDate}</td>
      {isAdmin && (
        <td className="px-4 py-2 text-center">
          <span
            onClick={(e) => {
              e.stopPropagation();
              onDelete && onDelete();
            }}
            className="material-symbols-outlined text-outline hover:text-error cursor-pointer text-[16px]"
          >
            delete
          </span>
        </td>
      )}
    </tr>
  );
}

