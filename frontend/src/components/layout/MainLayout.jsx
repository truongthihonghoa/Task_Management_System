import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell,
  CheckSquare,
  ChevronDown,
  Circle,
  ClipboardList,
  FolderKanban,
  HelpCircle,
  LayoutGrid,
  Menu,
  Plus,
  Search,
  SearchX,
  Settings,
  Users,
} from 'lucide-react';
import taskflowLogo from '../../assets/taskflow-logo.png';
import CreateTaskModal from '../tasks/CreateTaskModal';
import NotificationsModal from '../notifications/NotificationsModal';
import NotificationDropdown from '../notifications/NotificationDropdown';
import AvatarDropdown from '../auth/AvatarDropdown';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../api/axiosClient';
import {
  deleteNotification,
  getNotificationDetail,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
} from '../../api/notificationsApi';
import { deleteSearchRecent, globalSearch, recordSearchRecent } from '../../api/searchApi';

import { isNotificationWithinDisplayWindow } from '../../utils/notificationRetention';
import {
  getPrimaryNavigationItems,
  getSupportNavigationItems,
} from '../../utils/mainLayoutConfig';

const LAYOUT_QUERY_KEYS = ['role', 'spaceRole', 'user'];
const NOTIFICATION_POLL_INTERVAL_MS = 25000;
const SEARCH_DEBOUNCE_MS = 120;
const RECENT_SEARCH_DEBOUNCE_MS = 0;
const EMPTY_SEARCH_RESULTS = { spaces: [], tasks: [], users: [] };
const LAYOUT_ICON_COMPONENTS = {
  'layout-grid': LayoutGrid,
  'clipboard-list': ClipboardList,
  users: Users,
  'help-circle': HelpCircle,
  settings: Settings,
};

const copyLayoutQueryParams = (search) => {
  const currentParams = new URLSearchParams(search);
  const nextParams = new URLSearchParams();

  LAYOUT_QUERY_KEYS.forEach((key) => {
    const value = currentParams.get(key);
    if (value) {
      nextParams.set(key, value);
    }
  });

  return nextParams;
};

const getLayoutSearch = (search) => {
  const query = copyLayoutQueryParams(search).toString();
  return query ? `?${query}` : '';
};

import usFlag from "../../assets/us.png";
import vnFlag from "../../assets/vn.png";

function formatNotificationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const time = new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (left, right) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  if (sameDay(date, today) || sameDay(date, yesterday)) return time;

  const day = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
  return `${day} ${time}`;
}

function formatNotificationFullTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const time = new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (left, right) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  if (sameDay(date, today)) return `Today, ${time}`;
  if (sameDay(date, yesterday)) return `Yesterday, ${time}`;

  const day = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
  return `${day} ${time}`;
}

function notificationGroup(value) {
  if (!value) return 'Earlier';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Earlier';

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (left, right) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return 'Earlier';
}

function mapNotification(notification) {
  const metadata = notification.metadata || {};
  const actorName = notification.actor?.full_name || metadata.triggered_by_name || '';
  const targetUser = metadata.target_user || metadata.target_user_name || '';
  const taskName = metadata.task_name || metadata.task_title || notification.task?.title || '';
  const spaceName = metadata.space_name || metadata.name_space || metadata.space || '';
  const sprintName = metadata.sprint_name || metadata.name_sprint || metadata.sprint || notification.task?.sprint_name || '';

  return {
    NOTI_id: notification.notification_id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    task_id: notification.task_id,
    space_id: notification.space_id,
    target_user_id: metadata.user_id || metadata.target_user_id,
    audit_log_id: metadata.log_id || metadata.audit_log_id,
    task_name: taskName,
    sprint_name: sprintName,
    space_name: spaceName,
    target_user: targetUser,
    triggered_by_name: actorName,
    triggered_by_avatar: Boolean(actorName),
    triggered_by_initials: getInitials(actorName),
    is_read: notification.is_read,
    created_at: formatNotificationTime(notification.created_at),
    created_at_full: formatNotificationFullTime(notification.created_at),
    created_at_raw: notification.created_at,
    group: notificationGroup(notification.created_at),
    audience: notification.audience,
    role: notification.audience === 'SUPER_ADMIN' ? 'ADMIN' : 'USER',
    task_status: metadata.task_status,
    new_status: metadata.new_status,
    new_priority: metadata.new_priority || metadata.priority,
  };
}

function getInitials(value = '') {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return 'U';

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

function getBackendOrigin() {
  try {
    const url = new URL(API_BASE_URL);
    return url.origin;
  } catch {
    return ''; // relative URL — same origin, proxy handles it
  }
}

function normalizeAvatarUrl(avatarUrl) {
  if (!avatarUrl) return '';
  if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) return avatarUrl;
  const path = avatarUrl.startsWith('media/') ? `/${avatarUrl}` : avatarUrl;
  if (path.startsWith('/media/')) return `${getBackendOrigin()}${path}`;
  return avatarUrl;
}

function mapSearchSpace(space) {
  const ownerName = space.owner?.full_name || '';
  return {
    id: space.space_id,
    taskId: space.space_id,
    title: space.name,
    description: space.description || '',
    owner: ownerName,
    ownerInitials: space.owner?.initials || getInitials(ownerName),
    memberCount: space.member_count || 0,
    status: space.status || '',
  };
}

function mapSearchTask(task) {
  const assigneeNames = (task.assignees || [])
    .map((assignee) => assignee.full_name)
    .filter(Boolean);

  return {
    id: task.task_id,
    spaceId: task.space_id,
    title: task.title,
    status: task.status || '',
    priority: task.priority || '',
    assignee: assigneeNames.join(', ') || 'Unassigned',
  };
}

function mapSearchUser(user) {
  return {
    id: user.user_id,
    name: user.full_name,
    email: user.email,
    role: user.display_role || user.system_role || 'User',
    status: user.status || '',
    initials: user.initials || getInitials(user.full_name),
    space: user.space_name || (user.system_role === 'SUPER_ADMIN' ? 'System' : ''),
  };
}

function mapGlobalSearchResponse(response, isSuperAdmin) {
  return {
    spaces: (response.spaces || []).map(mapSearchSpace),
    tasks: (response.tasks || []).map(mapSearchTask),
    users: isSuperAdmin ? (response.users || []).map(mapSearchUser) : [],
  };
}

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tasksForModal, setTasksForModal] = useState([]);
  const [createTaskHandler, setCreateTaskHandler] = useState(null);
  const [createTaskInitialSprint, setCreateTaskInitialSprint] = useState('');
  const [assigneesForModal, setAssigneesForModal] = useState([]);
  const [currentSpaceNameForModal, setCurrentSpaceNameForModal] = useState('Task Management');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState({ spaces: [], tasks: [], users: [] });
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  const avatarRef = useRef(null);
  const avatarDropdownRef = useRef(null);
  const [showApps, setShowApps] = useState(false);
  const { language, setLanguage } = useLanguage();
  const { user: authUser, logout } = useAuth();

  const appsRef = useRef(null);
  const appsDropdownRef = useRef(null);
  // Refs hỗ trợ đóng dropdown khi click ra ngoài
  const dropdownRef = useRef(null);
  const bellRef = useRef(null);
  const settingsRef = useRef(null);
  const settingsDropdownRef = useRef(null);
  const searchRef = useRef(null);
  const recentSearchCacheRef = useRef(new Map());
  const activeSearchRequestIdRef = useRef(0);

  const authRole = authUser?.role || 'USER';
  const isSuperAdmin = authRole === 'SUPER_ADMIN';
  const recentSearchCacheKey = `${authUser?.user_id || 'anonymous'}:${isSuperAdmin ? 'admin' : 'user'}`;
  const currentRole = isSuperAdmin ? 'ADMIN' : 'USER';
  const currentSpaceRole = searchParams.get('spaceRole')?.toUpperCase() === 'OWNER' ? 'OWNER' : 'USER';
  const currentUserName = authUser?.full_name || authUser?.email || 'User';

  const currentUser = {
    id: authUser?.user_id || '',
    name: currentUserName,
    email: authUser?.email || '',
    initials: getInitials(currentUserName),
    avatarUrl: normalizeAvatarUrl(authUser?.avatar_url || ''),
    role: authRole,
    displayRole: isSuperAdmin
      ? 'Super Admin'
      : currentSpaceRole === 'OWNER'
        ? 'Owner in this space'
        : 'User',
  };

  const primaryNavigationItems = useMemo(
    () => getPrimaryNavigationItems({ isSuperAdmin }),
    [isSuperAdmin]
  );

  const supportNavigationItems = useMemo(
    () => getSupportNavigationItems(),
    []
  );

  const [allNotifications, setAllNotifications] = useState([]);
  const [serverUnreadCount, setServerUnreadCount] = useState(0);

  const filteredNotifications = allNotifications.filter(n => {
    if (!isNotificationWithinDisplayWindow(n)) {
      return false;
    }
    if (isSuperAdmin) {
      return n.audience === 'SUPER_ADMIN' || n.role === 'ADMIN';
    }
    return n.audience === 'USER' || n.audience === 'OWNER' || n.audience === 'MEMBER' || n.role === 'USER';
  });
  const unreadCount = serverUnreadCount;

  useEffect(() => {
    let isMounted = true;
    let isLoadingNotifications = false;
    let pollTimerId;

    async function loadNotifications() {
      if (isLoadingNotifications || document.visibilityState === 'hidden') return;
      isLoadingNotifications = true;

      try {
        const [response, unreadResponse] = await Promise.all([
          getNotifications({ page: 1, page_size: 50 }),
          getUnreadNotificationCount(),
        ]);
        if (!isMounted) return;
        setAllNotifications((response.items || []).map(mapNotification));
        setServerUnreadCount(unreadResponse.unread_count || 0);
      } catch (error) {
        if (error?.response?.status !== 401) {
          console.error('Unable to load notifications', error);
        }
      } finally {
        isLoadingNotifications = false;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        loadNotifications();
      }
    }

    if (authUser?.user_id) {
      loadNotifications();
      pollTimerId = window.setInterval(loadNotifications, NOTIFICATION_POLL_INTERVAL_MS);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    } else {
      setAllNotifications([]);
      setServerUnreadCount(0);
    }

    return () => {
      isMounted = false;
      if (pollTimerId) {
        window.clearInterval(pollTimerId);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authUser?.user_id]);

  const handleMarkAllRead = async () => {
    const visibleIds = new Set(filteredNotifications.map((item) => item.NOTI_id));
    setAllNotifications(prev => prev.map(n =>
      visibleIds.has(n.NOTI_id) ? { ...n, is_read: true } : n
    ));
    setServerUnreadCount(0);

    try {
      await markNotificationsRead({ target: 'all' });
    } catch (error) {
      console.error('Unable to mark notifications as read', error);
    }
  };

  const handleUpdateNotifications = async (nextNotifications) => {
    const readIds = nextNotifications
      .filter((nextNotification) => {
        const previous = allNotifications.find((item) => item.NOTI_id === nextNotification.NOTI_id);
        return previous && !previous.is_read && nextNotification.is_read;
      })
      .map((notification) => notification.NOTI_id);

    setAllNotifications(nextNotifications);
    setServerUnreadCount(nextNotifications.filter(item => !item.is_read).length);

    if (!readIds.length) return;

    try {
      await markNotificationsRead({ target: 'selected', notificationIds: readIds });
    } catch (error) {
      console.error('Unable to update notification read state', error);
    }
  };

  const handleNotificationRead = async (notification) => {
    if (!notification || notification.is_read) return;

    setAllNotifications(prev => prev.map(item =>
      item.NOTI_id === notification.NOTI_id ? { ...item, is_read: true } : item
    ));
    setServerUnreadCount(count => Math.max(0, count - 1));

    try {
      await getNotificationDetail(notification.NOTI_id);
    } catch (error) {
      console.error('Unable to mark notification as read', error);
    }
  };

  const handleDeleteNotification = async (notification) => {
    if (!notification?.NOTI_id) return;
    setAllNotifications(prev => prev.filter(item => item.NOTI_id !== notification.NOTI_id));
    if (!notification.is_read) {
      setServerUnreadCount(count => Math.max(0, count - 1));
    }

    try {
      await deleteNotification(notification.NOTI_id);
    } catch (error) {
      console.error('Unable to delete notification', error);
    }
  };

  const [sprintsForModal, setSprintsForModal] = useState([
    { id: 'sprint-1', name: 'SCRUM Sprint 1' }
  ]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        bellRef.current && !bellRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
      if (
        settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target) &&
        settingsRef.current && !settingsRef.current.contains(event.target)
      ) {
        setShowSettings(false);
      }
      if (
        avatarDropdownRef.current && !avatarDropdownRef.current.contains(event.target) &&
        avatarRef.current && !avatarRef.current.contains(event.target)
      ) {
        setShowAvatarDropdown(false);
      }
      if (
              searchRef.current &&
              !searchRef.current.contains(event.target)
            ) {
              setShowSearchDropdown(false);
            }

            // Language dropdown
       if (
          appsDropdownRef.current &&
          !appsDropdownRef.current.contains(event.target) &&
          appsRef.current &&
          !appsRef.current.contains(event.target)
         ) {
              setShowApps(false);
            }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Tự động kích hoạt Lucide Icons từ CDN khi component mount hoặc đổi route
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [location.pathname, showNotifications, showSettings, showAvatarDropdown, showSearchDropdown,showApps]);

  // Redirect non-admin users away from admin-only routes
  useEffect(() => {
    if (!isSuperAdmin) {
      // If on Dashboard (index) redirect to Space Management
      if (location.pathname === '/dashboard' || location.pathname === '/dashboard/') {
        navigate('/dashboard/spaces' + getLayoutSearch(location.search));
      }
      // If trying to access Users page, redirect to Space Management
      if (location.pathname.startsWith('/dashboard/users')) {
        navigate('/dashboard/spaces' + getLayoutSearch(location.search));
      }
    }
  }, [isSuperAdmin, location.pathname, location.search, navigate]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  useEffect(() => {
    if (!authUser?.user_id || !showSearchDropdown) return;

    const queryText = searchQuery.trim();
    const isRecentRequest = !queryText;
    const cachedRecentResults = isRecentRequest ? recentSearchCacheRef.current.get(recentSearchCacheKey) : null;
    if (cachedRecentResults) {
      setSearchResults(cachedRecentResults);
      setIsSearchLoading(false);
    }

    const requestId = activeSearchRequestIdRef.current + 1;
    activeSearchRequestIdRef.current = requestId;
    const controller = new AbortController();
    const timerId = window.setTimeout(async () => {
      if (!cachedRecentResults) {
        setIsSearchLoading(true);
      }
      try {
        const response = await globalSearch({
          q: queryText || undefined,
          types: isSuperAdmin ? undefined : 'spaces,tasks',
          limitPerType: 5,
          includeRecent: true,
          signal: controller.signal,
        });
        if (activeSearchRequestIdRef.current !== requestId) return;
        const mappedResults = mapGlobalSearchResponse(response, isSuperAdmin);
        if (isRecentRequest) {
          recentSearchCacheRef.current.set(recentSearchCacheKey, mappedResults);
        }
        setSearchResults(mappedResults);
      } catch (error) {
        if (error?.code === 'ERR_CANCELED') return;
        if (activeSearchRequestIdRef.current === requestId && error?.response?.status !== 401) {
          console.error('Unable to load global search results', error);
        }
        if (activeSearchRequestIdRef.current === requestId) {
          setSearchResults(EMPTY_SEARCH_RESULTS);
        }
      } finally {
        if (activeSearchRequestIdRef.current === requestId) {
          setIsSearchLoading(false);
        }
      }
    }, isRecentRequest ? RECENT_SEARCH_DEBOUNCE_MS : SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [authUser?.user_id, isSuperAdmin, recentSearchCacheKey, searchQuery, showSearchDropdown]);

  const visibleSpaces = useMemo(() => searchResults.spaces, [searchResults.spaces]);
  const visibleTasks = useMemo(() => searchResults.tasks, [searchResults.tasks]);
  const visibleUsers = useMemo(() => (isSuperAdmin ? searchResults.users : []), [isSuperAdmin, searchResults.users]);

  const isRecentSearchMode = !normalizedSearchQuery;
  const hasSearchResults = visibleSpaces.length > 0 || visibleTasks.length > 0 || visibleUsers.length > 0;

  const buildSearchParams = (updates = {}, { preservePageParams = false } = {}) => {
    const params = preservePageParams ? new URLSearchParams(location.search) : copyLayoutQueryParams(location.search);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const query = params.toString();
    return query ? `?${query}` : '';
  };

  const dashboardPath = (path, updates = {}) => `${path}${buildSearchParams(updates)}`;
  const openDashboardPath = (path, updates = {}) => {
    const targetPath = dashboardPath(path, updates);
    const isLeavingTaskPage = location.pathname.startsWith('/dashboard/tasks') && !path.startsWith('/dashboard/tasks');

    if (isLeavingTaskPage && typeof window !== 'undefined') {
      window.location.assign(targetPath);
      return;
    }

    navigate(targetPath);
  };

  const handleDashboardLinkClick = (event, path, updates = {}) => {
    const isLeavingTaskPage = location.pathname.startsWith('/dashboard/tasks') && !path.startsWith('/dashboard/tasks');
    if (!isLeavingTaskPage) return;

    event.preventDefault();
    openDashboardPath(path, updates);
  };

  const rememberSearchItem = async (entityType, entityId) => {
    if (!entityType || !entityId) return;
    recentSearchCacheRef.current.delete(recentSearchCacheKey);
    try {
      await recordSearchRecent({ entityType, entityId });
    } catch (error) {
      if (error?.response?.status !== 401) {
        console.error('Unable to record recent search item', error);
      }
    }
  };

  const removeRecentSearchItem = async (event, entityType, entityId) => {
    event.stopPropagation();
    recentSearchCacheRef.current.delete(recentSearchCacheKey);
    setSearchResults(prev => {
      const collectionKey = `${entityType}s`;
      return {
        ...prev,
        [collectionKey]: (prev[collectionKey] || []).filter(item => item.id !== entityId),
      };
    });
    try {
      await deleteSearchRecent({ entityType, entityId });
    } catch (error) {
      if (error?.response?.status !== 401) {
        console.error('Unable to delete recent search item', error);
      }
    }
  };

  const handleSearchSpaceClick = async (space) => {
    if (!space?.id) return;
    rememberSearchItem('space', space.id);
    openDashboardPath(`/dashboard/spaces/${space.id}`);
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  const handleSearchTaskClick = async (task) => {
    if (!task?.spaceId) return;
    rememberSearchItem('task', task.id);
    navigate(`/dashboard/tasks/${task.spaceId}${buildSearchParams({ taskId: task.id })}`);
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  const handleSearchUserClick = async (user) => {
    if (!isSuperAdmin || !user?.id) return;
    rememberSearchItem('user', user.id);
    openDashboardPath('/dashboard/users', { userId: user.id, mode: 'edit' });
    setSearchQuery('');
    setShowSearchDropdown(false);
  };
  // Handlers for AvatarDropdown actions
  const handleProfileClick = () => {
    openDashboardPath('/dashboard/profile');
    setShowAvatarDropdown(false); // Close dropdown after navigation
  };

  const handleSettingsClick = () => {
    openDashboardPath('/dashboard/notification-settings');
    setShowAvatarDropdown(false); // Close dropdown after navigation
  };

  const handleNotificationClick = () => {
    openDashboardPath('/dashboard/notification-settings');
    setShowAvatarDropdown(false); // Close dropdown after navigation
  };

  const handleLogoutClick = async () => {
    await logout();
    navigate('/', { replace: true });
    setShowAvatarDropdown(false); // Close dropdown after logout
  };
  const handleChangeLanguage = (lang) => {
    setLanguage(lang);
    setShowApps(false);
  };

  const layoutContext = {
    setShowCreateModal,
    setTasksForModal,
    setCreateTaskHandler,
    setSprintsForModal,
    setCreateTaskInitialSprint,
    setAssigneesForModal,
    setCurrentSpaceNameForModal,
    currentRole,
    currentUser,
    currentSpaceRole,
    isSuperAdmin
  };

  return (
    <div className="h-screen flex overflow-hidden font-['Inter'] bg-[#F5F7FA]">

      {/* Cấu trúc Style nội bộ để giữ nguyên các hiệu ứng CSS cũ */}
      <style>{`
        .sidebar-active-indicator {
          width: 4px;
          height: 38px;
          background-color: #2D1B4E;
          border-radius: 0 4px 4px 0;
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
        }
      `}</style>

      {/* BEGIN: LeftSidebar */}
      <aside className={`bg-[#F6F7FF] border-r border-gray-200 flex flex-col h-full z-20 transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'w-64' : 'w-0 border-r-0'}`} data-purpose="main-navigation">
        {/* Logo Section */}
        <div className="p-6 flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#2D1B4E] rounded-lg flex items-center justify-center border-[3px] border-[#2D1B4E] overflow-hidden">
            <img alt="TaskFlow Logo" className="w-[50px] h-[50px] max-w-none object-contain scale-[1.35]" src={taskflowLogo} />
          </div>
          <div>
            <h1 className="text-[#2D1B4E] font-bold text-sm leading-tight">TaskFlow</h1>
            <p className="text-[#6B7280] text-[10px]">Productivity Pro</p>
          </div>
        </div>

<nav className="flex-1 px-3 space-y-1 mt-4">
  {primaryNavigationItems.map((item) => {
    const isActive = item.match(location.pathname);
    const NavigationIcon = LAYOUT_ICON_COMPONENTS[item.icon] || Circle;

    const linkContent = (
      <>
        <div className="flex items-center min-w-0">
          <NavigationIcon
            className={`w-5 h-5 mr-3 shrink-0 ${
              isActive ? 'text-[#2D1B4E]' : ''
            }`}
          />

          <span
            className={`text-sm ${
              isActive ? 'font-bold' : 'font-medium'
            }`}
          >
            {item.label}
          </span>
        </div>

        {item.badge !== undefined && (
          <span className="bg-[#EADFF9] text-[#2D1B4E] text-[10px] font-bold px-2 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
      </>
    );

    return isActive ? (
      <div className="relative flex items-center" key={item.key}>
        <div className="sidebar-active-indicator"></div>

        <Link
          className={`flex items-center flex-1 px-4 py-3 bg-[#E0E8FF] text-[#2D1B4E] rounded-xl transition-colors ml-2 ${
            item.badge !== undefined ? 'justify-between' : ''
          }`}
          to={dashboardPath(item.path)}
          onClick={(event) =>
            handleDashboardLinkClick(event, item.path)
          }
        >
          {linkContent}
        </Link>
      </div>
    ) : (
      <Link
        className={`flex items-center px-4 py-3 text-[#6B7280] hover:bg-gray-50 rounded-xl transition-colors ${
          item.badge !== undefined ? 'justify-between' : ''
        }`}
        key={item.key}
        to={dashboardPath(item.path)}
        onClick={(event) =>
          handleDashboardLinkClick(event, item.path)
        }
      >
        {linkContent}
      </Link>
    );
  })}
</nav>
        {/* Bottom Navigation */}
<div
  className={`px-3 py-6 border-t border-gray-100 space-y-1 relative transition-transform duration-300 ${
    showSettings ? '-translate-y-[100px]' : ''
  }`}
>
  {supportNavigationItems.map((item) => {
    const isActive = item.match(location.pathname);
    const NavigationIcon = LAYOUT_ICON_COMPONENTS[item.icon] || Circle;

    return isActive ? (
      <div
        className="relative flex items-center"
        key={item.key}
        ref={item.key === 'settings' ? settingsRef : undefined}
      >
        <div className="sidebar-active-indicator"></div>

        <Link
          className="flex items-center flex-1 px-4 py-3 bg-[#E0E8FF] text-[#2D1B4E] rounded-xl transition-colors ml-2"
          to={dashboardPath(item.path)}
          onClick={(event) =>
            handleDashboardLinkClick(event, item.path)
          }
        >
          <NavigationIcon
            className="w-5 h-5 mr-3 text-[#2D1B4E]"
          />

          <span className="text-sm font-bold">
            {item.label}
          </span>
        </Link>
      </div>
    ) : (
      <Link
        className="flex items-center px-4 py-3 text-[#6B7280] hover:bg-gray-50 rounded-xl transition-colors"
        key={item.key}
        ref={item.key === 'settings' ? settingsRef : undefined}
        to={dashboardPath(item.path)}
        onClick={(event) =>
          handleDashboardLinkClick(event, item.path)
        }
      >
        <NavigationIcon
          className="w-5 h-5 mr-3"
        />

        <span className="text-sm font-medium">
          {item.label}
        </span>
      </Link>
    );
  })}
</div>
      </aside>
      {/* END: LeftSidebar */}

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* BEGIN: MainHeader */}
        <header className="relative h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-20" data-purpose="top-header">

          {/* Cụm Tìm kiếm & Menu 3 gạch mở rộng */}
          <div className="flex items-center flex-1 mr-8">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 mr-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              title={isSidebarOpen ? "Thu gọn menu" : "Mở rộng menu"}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="relative w-full" ref={searchRef}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300"
                placeholder={isSuperAdmin ? "Search spaces, users, or tasks..." : "Search spaces or tasks..."}
                type="text"
                value={searchQuery}
                onFocus={() => setShowSearchDropdown(true)}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setShowSearchDropdown(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    setShowSearchDropdown(true);
                  }
                }}
              />

              {showSearchDropdown && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-xl shadow-[0_18px_45px_rgba(17,24,39,0.14)] z-[9999] overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-[#4C2B74] uppercase tracking-wide">
                        {normalizedSearchQuery ? 'Search results' : 'Recently viewed'}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {isSuperAdmin ? 'Quickly open spaces, users, or tasks.' : 'Quickly open spaces or tasks.'}
                      </p>
                    </div>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto custom-scrollbar py-2">
                    {isSearchLoading && (
                      <div className="px-4 py-3 text-xs font-semibold text-gray-400">
                        Loading...
                      </div>
                    )}

                    {visibleSpaces.length > 0 && (
                      <div>
                        <div className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                          Spaces
                        </div>
                        {visibleSpaces.map((space) => (
                          <div
                            key={space.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSearchSpaceClick(space)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') handleSearchSpaceClick(space);
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#FAF8FF] transition-colors cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-lg bg-[#F0EDFF] border border-purple-100 flex items-center justify-center shrink-0">
                              <FolderKanban className="w-4 h-4 text-[#4C2B74]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[11px] font-black text-gray-400 shrink-0">{space.id}</span>
                                <span className="text-sm font-bold text-gray-800 truncate">{space.title}</span>
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400 font-semibold">
                                <span>{space.status}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                <span>{space.memberCount} members</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                <span className="truncate">Owner: {space.owner}</span>
                              </div>
                            </div>
                            {isRecentSearchMode && (
                              <button
                                type="button"
                                aria-label="Remove recent search"
                                onClick={(event) => removeRecentSearchItem(event, 'space', space.id)}
                                className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                              >
                                X
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {visibleTasks.length > 0 && (
                      <div className={visibleSpaces.length > 0 ? "border-t border-gray-50 mt-2 pt-2" : ""}>
                        <div className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                          Tasks
                        </div>
                        {visibleTasks.map((task) => (
                          <div
                            key={task.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSearchTaskClick(task)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') handleSearchTaskClick(task);
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#FAF8FF] transition-colors cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-lg bg-[#EEF2FF] border border-blue-100 flex items-center justify-center shrink-0">
                              <CheckSquare className="w-4 h-4 text-[#4C2B74]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[11px] font-black text-gray-400 shrink-0">{task.id}</span>
                                <span className="text-sm font-bold text-gray-800 truncate">{task.title}</span>
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400 font-semibold">
                                <span>{task.status}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                <span>{task.priority}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                <span>{task.assignee}</span>
                              </div>
                            </div>
                            {isRecentSearchMode && (
                              <button
                                type="button"
                                aria-label="Remove recent search"
                                onClick={(event) => removeRecentSearchItem(event, 'task', task.id)}
                                className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                              >
                                X
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {visibleUsers.length > 0 && (
                      <div className="border-t border-gray-50 mt-2 pt-2">
                        <div className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                          Users
                        </div>
                        {visibleUsers.map((user) => (
                          <div
                            key={user.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSearchUserClick(user)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') handleSearchUserClick(user);
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#FAF8FF] transition-colors cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-full bg-[#EADFF9] text-[#4C2B74] flex items-center justify-center text-xs font-black shrink-0">
                              {user.initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-800 truncate">{user.name}</span>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">{user.role}</span>
                              </div>
                              <p className="text-[11px] text-gray-400 font-semibold truncate mt-1">
                                {user.email} - {user.space}
                              </p>
                            </div>
                            {isRecentSearchMode && (
                              <button
                                type="button"
                                aria-label="Remove recent search"
                                onClick={(event) => removeRecentSearchItem(event, 'user', user.id)}
                                className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                              >
                                X
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!isSearchLoading && !hasSearchResults && (
                      <div className="px-6 py-10 text-center">
                        <div className="w-12 h-12 mx-auto rounded-full bg-gray-50 flex items-center justify-center mb-3">
                          <SearchX className="w-5 h-5 text-gray-300" />
                        </div>
                        <p className="text-sm font-bold text-gray-700">No results found</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {isSuperAdmin ? 'Try a space name, user name, or task title.' : 'Try a space name, task ID, or task title.'}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      openDashboardPath('/dashboard/spaces');
                      setShowSearchDropdown(false);
                    }}
                    className="w-full px-4 py-3 border-t border-gray-100 text-left text-xs font-bold text-[#4C2B74] hover:bg-[#FAF8FF] transition-colors"
                  >
                    View all spaces
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-6 flex-shrink-0">
            {/* Create Button */}
            {!isSuperAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#2D1B4E] text-white px-4 py-2 rounded-lg flex items-center text-sm font-semibold hover:bg-opacity-90 transition-all font-['Inter']"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </button>
            )}
            
            <div className="relative" ref={appsRef}>
            <button
                onClick={() => setShowApps(!showApps)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
                <img
                    src={language === "en" ? usFlag : vnFlag}
                    alt="Language"
                    className="w-7 h-5 rounded-sm"
                />

                <span className="text-sm font-medium">
                    {language === "en" ? "EN" : "VI"}
                </span>

                <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
            {showApps && (
              <div
                ref={appsDropdownRef}
                className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl border border-gray-200 shadow-lg py-2 z-[9999]"
              >
                <button
                  onClick={() => handleChangeLanguage("en")}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50"
                >
                  <img
                    src={usFlag}
                    alt="English"
                    className="w-5 h-5 rounded-sm"
                  />
                  <span className="text-sm">English</span>
                </button>

                <button
                  onClick={() => handleChangeLanguage("vi")}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50"
                >
                  <img
                    src={vnFlag}
                    alt="Tiếng Việt"
                    className="w-5 h-5 rounded-sm"
                  />
                  <span className="text-sm">Tiếng Việt</span>
                </button>
              </div>
            )}
          </div>
            {/* Notification Bell Dropdown */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                title="View notifications"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#EF4444] rounded-full border-2 border-white"></span>
                )}
              </button>

              {/* 🟢 ĐÂY CHÍNH LÀ NƠI HIỂN THỊ DANH SÁCH THÔNG BÁO TRÊN HEADER */}
              {showNotifications && (
                <div ref={dropdownRef} className="absolute right-0 z-50">
                  <NotificationDropdown
                    notifications={filteredNotifications}
                    onMarkAllRead={handleMarkAllRead}
                    onNotificationClick={handleNotificationRead}
                    onDeleteNotification={handleDeleteNotification}
                    onViewAll={() => {
                      setShowNotifications(false);
                      setShowNotificationsModal(true);
                    }}
                    onClose={() => setShowNotifications(false)}
                  />
                </div>
              )}
            </div>


            {/* User Profile */}
            <div className="relative" ref={avatarRef}>
              <button
                onClick={() => setShowAvatarDropdown(prev => !prev)}
                className="flex items-center space-x-3 border-l pl-6 border-gray-200 font-['Inter']">
                <div className="w-10 h-10 rounded-full bg-purple-100 border border-[#2D1B4E] flex items-center justify-center overflow-hidden shrink-0">
                  {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-purple-200 to-indigo-100 flex items-center justify-center">
                      <span className="text-[#2D1B4E] text-xs font-bold">
                        {currentUser.initials}
                      </span>
                    </div>
                  )}
                </div>

                {/* Name Section - flex-1 để đẩy icon sang phải */}
                <span className="text-sm font-semibold text-gray-800 flex-1 text-left">
                  {currentUser.name}
                </span>
              </button>

              {showAvatarDropdown && (
                <div
                  ref={avatarDropdownRef}
                  className="absolute right-0 top-full mt-2.5 z-[9999]"
                >
                    <AvatarDropdown
                        currentRole={currentRole}
                        currentUser={currentUser}
                        onClose={() => setShowAvatarDropdown(false)}
                        onProfileClick={handleProfileClick}
                        onNotificationClick={handleNotificationClick}
                        onSettingsClick={handleSettingsClick}
                        onLogoutClick={handleLogoutClick}
                    />
                </div>
              )}
            </div>
          </div>
        </header>
        {/* END: MainHeader */}

        {/* BEGIN: MainContentArea */}
        <main className="flex-1 bg-[#F5F7FA] overflow-y-auto relative" data-purpose="main-display">
          <Outlet key={`${location.pathname}${location.search}`} context={layoutContext} />
        </main>
        {/* END: MainContentArea */}

      </div>

      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setCreateTaskInitialSprint(''); }}
        tasks={tasksForModal}
        sprints={sprintsForModal}
        assignees={assigneesForModal}
        initialSprint={createTaskInitialSprint}
        currentSpaceName={currentSpaceNameForModal}
        onCreateTask={createTaskHandler}
        currentRole={currentRole}
        currentSpaceRole={currentSpaceRole}
        currentUser={currentUser}
      />

      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        currentRole={currentRole}
        currentSpaceRole={currentSpaceRole}
        isSuperAdmin={isSuperAdmin}
        notifications={allNotifications}
        onUpdateNotifications={handleUpdateNotifications}
        onDeleteNotification={handleDeleteNotification}
      />
    </div>
  );
}
