import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import taskflowLogo from '../../assets/taskflow-logo.png';
import CreateTaskModal from '../tasks/CreateTaskModal';
import NotificationsModal from '../notifications/NotificationsModal';
import NotificationDropdown from '../notifications/NotificationDropdown';
import SettingsDropdown from '../settings/SettingsDropdown';
import AvatarDropdown from '../auth/AvatarDropdown';
import HelpCenter from '../../pages/HelpCenter';
import { globalNotifications, updateGlobalNotifications } from '../notifications/notificationsState';
const SEARCH_TASKS = [
  { id: 'TM-1', title: 'Infrastructure setup', status: 'New', priority: 'High', assignee: 'Pham Tien' },
  { id: 'TM-2', title: 'API Documentation update', status: 'In Progress', priority: 'Medium', assignee: 'Hoang Hoa' },
  { id: 'TM-3', title: 'Checkout flow mobile fix', status: 'In Testing', priority: 'High', assignee: 'Trong Nghia' },
  { id: 'TM-4', title: 'Security Protocols Audit', status: 'Done', priority: 'High', assignee: 'Pham Tien' },
  { id: 'TM-5', title: 'SSO Authentication implementation', status: 'In Progress', priority: 'Medium', assignee: 'Hoang Hoa' },
  { id: 'TM-8', title: 'Database Migration Script', status: 'New', priority: 'High', assignee: 'Hoang Hoa' },
  { id: 'TM-9', title: 'Dashboard Charts optimization', status: 'In Testing', priority: 'Medium', assignee: 'Trong Nghia' },
  { id: 'TM-11', title: 'Push Notification Service', status: 'New', priority: 'High', assignee: 'Hoang Hoa' },
];

const SEARCH_USERS = [
  { id: 'USR-1', name: 'Trang Nguyen', email: 'ntttrang241205@gmail.com', role: 'Administrator', status: 'Active', initials: 'TN' },
  { id: 'USR-2', name: 'Tien Phham', email: 'tienthicamphamqn20@gmail.com', role: 'User', status: 'Active', initials: 'TP' },
  { id: 'USR-3', name: 'Hoang Hoa', email: 'hoanghoa@example.com', role: 'User', status: 'Active', initials: 'HH' },
  { id: 'USR-4', name: 'Trong Nghia', email: 'trongnghia@example.com', role: 'User', status: 'Active', initials: 'TN' },
];

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tasksForModal, setTasksForModal] = useState([]);
  const [createTaskHandler, setCreateTaskHandler] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const avatarRef = useRef(null);
  const avatarDropdownRef = useRef(null);
  // Refs hỗ trợ đóng dropdown khi click ra ngoài
  const dropdownRef = useRef(null);
  const bellRef = useRef(null);
  const settingsRef = useRef(null);
  const settingsDropdownRef = useRef(null);
  const searchRef = useRef(null);

  const roleParam = searchParams.get('role')?.toUpperCase();
  const currentRole = roleParam === 'USER' ? 'USER' : 'ADMIN';
  const currentUser = currentRole === 'ADMIN'
    ? { id: 'admin-demo-user', name: 'Alex Morgan', initials: 'AM', role: 'ADMIN' }
    : { id: '8ce04f65-ea2c-4279-8350-7c1f0e81c9f5', name: 'Trang Nguyễn', initials: 'TN', role: 'USER' };

  // State dữ liệu thông báo được đồng bộ với globalNotifications
  const [allNotifications, setAllNotifications] = useState(globalNotifications);

  useEffect(() => {
    const handleSync = () => setAllNotifications([...globalNotifications]);
    window.addEventListener('sync_global_notifications', handleSync);
    return () => window.removeEventListener('sync_global_notifications', handleSync);
  }, []);

  const filteredNotifications = allNotifications.filter(n => n.role === currentRole);
  const unreadCount = filteredNotifications.filter(n => !n.is_read).length;

  const handleMarkAllRead = () => {
    const updated = globalNotifications.map(n =>
      n.role === currentRole ? { ...n, is_read: true } : n
    );
    updateGlobalNotifications(updated);
  };

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
        searchRef.current && !searchRef.current.contains(event.target)
      ) {
        setShowSearchDropdown(false);
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
  }, [location.pathname, showNotifications, showSettings, showAvatarDropdown, showSearchDropdown]);

  const isDashboardActive = location.pathname === '/dashboard' || location.pathname === '/dashboard/';
  const isTasksActive = location.pathname === '/dashboard/spaces' || location.pathname.includes('/dashboard/tasks');
  const isUsersActive = location.pathname === '/dashboard/users';
  const isProfileActive = location.pathname === '/dashboard/profile';
  const isSettingsActive = location.pathname === '/dashboard/notification-settings' || location.pathname === '/dashboard/settings/general';
  const isHelpActive = location.pathname === '/dashboard/help';

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const isAdmin = currentRole === 'ADMIN';
  const visibleTasks = useMemo(() => {
    if (!normalizedSearchQuery) return SEARCH_TASKS.slice(0, 4);
    return SEARCH_TASKS.filter(task =>
      task.id.toLowerCase().includes(normalizedSearchQuery) ||
      task.title.toLowerCase().includes(normalizedSearchQuery) ||
      task.status.toLowerCase().includes(normalizedSearchQuery) ||
      task.assignee.toLowerCase().includes(normalizedSearchQuery)
    ).slice(0, 6);
  }, [normalizedSearchQuery]);

  const visibleUsers = useMemo(() => {
    if (!isAdmin || !normalizedSearchQuery) return [];
    return SEARCH_USERS.filter(user =>
      user.name.toLowerCase().includes(normalizedSearchQuery) ||
      user.email.toLowerCase().includes(normalizedSearchQuery) ||
      user.role.toLowerCase().includes(normalizedSearchQuery)
    ).slice(0, 4);
  }, [isAdmin, normalizedSearchQuery]);

  const hasSearchResults = visibleTasks.length > 0 || visibleUsers.length > 0;

  const handleSearchTaskClick = (taskId) => {
    navigate(`/dashboard/tasks/${taskId}${location.search}`);
    setSearchQuery('');
    setShowSearchDropdown(false);
  };

  const handleSearchUserClick = () => {
    navigate(`/dashboard/users${location.search}`);
    setSearchQuery('');
    setShowSearchDropdown(false);
  };
  // Handlers for AvatarDropdown actions
  const handleProfileClick = () => {
    navigate(`/dashboard/profile${location.search}`);
    setShowAvatarDropdown(false); // Close dropdown after navigation
  };

  const handleSettingsClick = () => {
    navigate(`/dashboard/notification-settings${location.search}`);
    setShowAvatarDropdown(false); // Close dropdown after navigation
  };

  const handleGeneralClick = () => {
    navigate(`/dashboard/settings/general${location.search}`);
    setShowAvatarDropdown(false); // Close dropdown after navigation
  };

  const handleNotificationClick = () => {
    navigate(`/dashboard/notification-settings${location.search}`);
    setShowAvatarDropdown(false); // Close dropdown after navigation
  };

  const handleLogoutClick = () => {
    // In a real application, this would involve clearing authentication tokens/state
    console.log("User logged out"); // Placeholder for actual logout logic
    navigate('/'); // Redirect to login or home page
    setShowAvatarDropdown(false); // Close dropdown after logout
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

        {/* Navigation Links */}
        <nav className="flex-1 px-3 space-y-1 mt-4">
          {/* Dashboard Item */}
          {isDashboardActive ? (
            <div className="relative flex items-center">
              <div className="sidebar-active-indicator"></div>
              <Link className="flex items-center flex-1 px-4 py-3 bg-[#E0E8FF] text-[#2D1B4E] rounded-xl transition-colors ml-2" to={`/dashboard${location.search}`}>
                <i className="w-5 h-5 mr-3 text-[#2D1B4E]" data-lucide="layout-grid"></i>
                <span className="text-sm font-bold">Dashboard</span>
              </Link>
            </div>
          ) : (
            <Link className="flex items-center px-4 py-3 text-[#6B7280] hover:bg-gray-50 rounded-xl group transition-colors" to={`/dashboard${location.search}`}>
              <i className="w-5 h-5 mr-3" data-lucide="layout-grid"></i>
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
          )}

          {/* Tasks Item */}
          {isTasksActive ? (
            <div className="relative flex items-center">
              <div className="sidebar-active-indicator"></div>
              <Link className="flex items-center flex-1 px-4 py-3 bg-[#E0E8FF] text-[#2D1B4E] rounded-xl transition-colors ml-2 justify-between" to={`/dashboard/spaces${location.search}`}>
                <div className="flex items-center">
                  <i className="w-5 h-5 mr-3 text-[#2D1B4E]" data-lucide="clipboard-list"></i>
                  <span className="text-sm font-bold">Tasks</span>
                </div>
                <span className="bg-[#EADFF9] text-[#2D1B4E] text-[10px] font-bold px-2 py-0.5 rounded-full">12</span>
              </Link>
            </div>
          ) : (
            <Link className="flex items-center px-4 py-3 text-[#6B7280] hover:bg-gray-50 rounded-xl group transition-colors justify-between" to={`/dashboard/spaces${location.search}`}>
              <div className="flex items-center">
                <i className="w-5 h-5 mr-3" data-lucide="clipboard-list"></i>
                <span className="text-sm font-medium">Tasks</span>
              </div>
              <span className="bg-[#EADFF9] text-[#2D1B4E] text-[10px] font-bold px-2 py-0.5 rounded-full">12</span>
            </Link>
          )}

          {/* Users Item */}
          {isUsersActive ? (
            <div className="relative flex items-center">
              <div className="sidebar-active-indicator"></div>
              <Link className="flex items-center flex-1 px-4 py-3 bg-[#E0E8FF] text-[#2D1B4E] rounded-xl transition-colors ml-2" to={`/dashboard/users${location.search}`}>
                <i className="w-5 h-5 mr-3 text-[#2D1B4E]" data-lucide="users"></i>
                <span className="text-sm font-bold">Users</span>
              </Link>
            </div>
          ) : (
            <Link className="flex items-center px-4 py-3 text-[#6B7280] hover:bg-gray-50 rounded-xl transition-colors" to={`/dashboard/users${location.search}`}>
              <i className="w-5 h-5 mr-3" data-lucide="users"></i>
              <span className="text-sm font-medium">Users</span>
            </Link>
          )}

          {/* Profile Item */}
          {isProfileActive ? (
            <div className="relative flex items-center">
              <div className="sidebar-active-indicator"></div>
              <Link className="flex items-center flex-1 px-4 py-3 bg-[#E0E8FF] text-[#2D1B4E] rounded-xl transition-colors ml-2" to={`/dashboard/profile${location.search}`}>
                <i className="w-5 h-5 mr-3 text-[#2D1B4E]" data-lucide="user-circle"></i>
                <span className="text-sm font-bold">Profile</span>
              </Link>
            </div>
          ) : (
            <Link className="flex items-center px-4 py-3 text-[#6B7280] hover:bg-gray-50 rounded-xl transition-colors" to={`/dashboard/profile${location.search}`}>
              <i className="w-5 h-5 mr-3" data-lucide="user-circle"></i>
              <span className="text-sm font-medium">Profile</span>
            </Link>
          )}

        </nav>

        {/* Bottom Navigation */}
        <div className={`px-3 py-6 border-t border-gray-100 space-y-1 relative transition-transform duration-300 ${showSettings ? '-translate-y-[100px]' : ''}`}>
          {/* Help Item */}
          {isHelpActive ? (
            <div className="relative flex items-center">
              <div className="sidebar-active-indicator"></div>
              <Link className="flex items-center flex-1 px-4 py-3 bg-[#E0E8FF] text-[#2D1B4E] rounded-xl transition-colors ml-2" to="/dashboard/help">
                <i className="w-5 h-5 mr-3 text-[#2D1B4E]" data-lucide="help-circle"></i>
                <span className="text-sm font-bold">Help</span>
              </Link>
            </div>
          ) : (
            <Link className="flex items-center px-4 py-3 text-[#6B7280] hover:bg-gray-50 rounded-xl transition-colors" to="/dashboard/help">
              <i className="w-5 h-5 mr-3" data-lucide="help-circle"></i>
              <span className="text-sm font-medium">Help</span>
            </Link>
          )}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center w-full px-4 py-3 rounded-xl transition-colors ${isSettingsActive || showSettings ? 'bg-[#E0E8FF] text-[#2D1B4E]' : 'text-[#6B7280] hover:bg-gray-50'}`}
            >
              {(isSettingsActive || showSettings) && <div className="sidebar-active-indicator"></div>}
              <div className="flex items-center flex-1">
                <i className={`w-5 h-5 mr-3 ${isSettingsActive || showSettings ? 'text-[#2D1B4E]' : ''}`} data-lucide="settings"></i>
                <span className={`text-sm ${isSettingsActive || showSettings ? 'font-bold' : 'font-medium'}`}>Settings</span>
              </div>
            </button>

            {showSettings && (
              <div ref={settingsDropdownRef} className="absolute left-0 top-full mt-2 z-50 w-full">
                <SettingsDropdown onClose={() => setShowSettings(false)} />
              </div>
            )}
          </div>
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
              <i className="w-5 h-5" data-lucide="menu"></i>
            </button>

            <div className="relative w-full" ref={searchRef}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="h-4 w-4 text-gray-400" data-lucide="search"></i>
              </div>
              <input
                className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#2D1B4E] focus:border-[#2D1B4E]"
                placeholder={isAdmin ? "Search tasks or users..." : "Search tasks..."}
                type="text"
                value={searchQuery}
                onFocus={() => setShowSearchDropdown(true)}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setShowSearchDropdown(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && visibleTasks[0]) {
                    handleSearchTaskClick(visibleTasks[0].id);
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
                        {isAdmin ? 'Quickly open tasks or users.' : 'Quickly open tasks.'}
                      </p>
                    </div>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-[11px] font-bold text-gray-400 hover:text-[#4C2B74]"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="max-h-[360px] overflow-y-auto custom-scrollbar py-2">
                    {visibleTasks.length > 0 && (
                      <div>
                        <div className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                          Tasks
                        </div>
                        {visibleTasks.map((task) => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => handleSearchTaskClick(task.id)}
                            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#FAF8FF] transition-colors"
                          >
                            <div className="w-9 h-9 rounded-lg bg-[#EEF2FF] border border-blue-100 flex items-center justify-center shrink-0">
                              <i className="w-4 h-4 text-[#4C2B74]" data-lucide="check-square"></i>
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
                          </button>
                        ))}
                      </div>
                    )}

                    {visibleUsers.length > 0 && (
                      <div className="border-t border-gray-50 mt-2 pt-2">
                        <div className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                          Users
                        </div>
                        {visibleUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={handleSearchUserClick}
                            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#FAF8FF] transition-colors"
                          >
                            <div className="w-9 h-9 rounded-full bg-[#EADFF9] text-[#4C2B74] flex items-center justify-center text-xs font-black shrink-0">
                              {user.initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-800 truncate">{user.name}</span>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">{user.role}</span>
                              </div>
                              <p className="text-[11px] text-gray-400 font-semibold truncate mt-1">{user.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {!hasSearchResults && (
                      <div className="px-6 py-10 text-center">
                        <div className="w-12 h-12 mx-auto rounded-full bg-gray-50 flex items-center justify-center mb-3">
                          <i className="w-5 h-5 text-gray-300" data-lucide="search-x"></i>
                        </div>
                        <p className="text-sm font-bold text-gray-700">No results found</p>
                        <p className="text-xs text-gray-400 mt-1">Try a task ID, task title, or user name.</p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/dashboard/spaces${location.search}`);
                      setShowSearchDropdown(false);
                    }}
                    className="w-full px-4 py-3 border-t border-gray-100 text-left text-xs font-bold text-[#4C2B74] hover:bg-[#FAF8FF] transition-colors"
                  >
                    View all tasks
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-6 flex-shrink-0">
            {/* Create Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#2D1B4E] text-white px-4 py-2 rounded-lg flex items-center text-sm font-semibold hover:bg-opacity-90 transition-all font-['Inter']"
            >
              <i className="w-4 h-4 mr-2" data-lucide="plus"></i>
              Create Task
            </button>

            {/* Notification Bell Dropdown */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                title="View notifications"
              >
                <i className="w-6 h-6" data-lucide="bell"></i>
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
                  <div className="w-full h-full bg-gradient-to-tr from-purple-200 to-indigo-100 flex items-center justify-center">
                    <span className="text-[#2D1B4E] text-xs font-bold">
                      {currentUser.initials}
                    </span>
                  </div>
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
                    onClose={() => setShowAvatarDropdown(false)}
                    onProfileClick={handleProfileClick}
                    onSettingsClick={handleSettingsClick}
                    onGeneralClick={handleGeneralClick}
                    onNotificationClick={handleNotificationClick}
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
          <Outlet context={{ setShowCreateModal, setTasksForModal, setCreateTaskHandler, currentRole, currentUser }} />
        </main>
        {/* END: MainContentArea */}

      </div>

      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        tasks={tasksForModal}
        onCreateTask={createTaskHandler}
        currentRole={currentRole}
        currentUser={currentUser}
      />

      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        currentRole={currentRole}
      />
    </div>
  );
}
