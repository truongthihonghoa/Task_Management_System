import React, { useEffect, useState, useRef } from 'react';
// import { useNavigate } from "react-router-dom";
import { Outlet, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import taskflowLogo from '../../assets/taskflow-logo.png';
import CreateTaskModal from '../tasks/CreateTaskModal';
import NotificationDropdown from '../notifications/NotificationDropdown';
import AvatarDropdown from '../auth/AvatarDropdown';
import HelpCenter from '../../pages/HelpCenter';
import usFlag from "../../assets/us.png";
import vnFlag from "../../assets/vn.png";

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tasksForModal, setTasksForModal] = useState([]);
  const [createTaskHandler, setCreateTaskHandler] = useState(null);
  const [createTaskInitialSprint, setCreateTaskInitialSprint] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);

  const avatarRef = useRef(null);
  const avatarDropdownRef = useRef(null);
  const [showApps, setShowApps] = useState(false);
  const [language, setLanguage] = useState("en");

  const appsRef = useRef(null);
  const appsDropdownRef = useRef(null);
  // Refs hỗ trợ đóng dropdown khi click ra ngoài
  const dropdownRef = useRef(null);
  const bellRef = useRef(null);
  const settingsRef = useRef(null);
  const settingsDropdownRef = useRef(null);

  const roleParam = searchParams.get('role')?.toUpperCase();
  const currentRole = roleParam === 'USER' ? 'USER' : 'ADMIN';
  const currentUser = currentRole === 'ADMIN'
    ? { id: 'admin-demo-user', name: 'Alex Morgan', initials: 'AM', role: 'ADMIN' }
    : { id: '8ce04f65-ea2c-4279-8350-7c1f0e81c9f5', name: 'Trang Nguyễn', initials: 'TN', role: 'USER' };

  // State dữ liệu thông báo giả lập để tính toán badge số lượng
  const [allNotifications, setAllNotifications] = useState([
    {
      NOTI_id: 1,
      type: 'task_assigned',
      task_name: 'Design Dashboard',
      triggered_by_name: 'Hoa',
      triggered_by_avatar: true,
      triggered_by_initials: 'H',
      is_read: false,
      created_at: '2 min ago',
      group: 'Today',
      role: 'USER',
      task_status: 'To Do',
      space_id: 'spaces'
    },
    {
      NOTI_id: 2,
      type: 'status_changed',
      task_name: 'Design System',
      new_status: 'In Review',
      triggered_by_name: 'Phạm Thị Cẩm Tiên',
      triggered_by_avatar: true,
      triggered_by_initials: 'PT',
      is_read: false,
      created_at: '33 sec ago',
      group: 'Today',
      role: 'USER',
      task_status: 'In Progress',
      space_id: 'spaces'
    },
    {
      NOTI_id: 3,
      type: 'comment_added',
      task_name: 'Audit Logs Screen',
      triggered_by_name: 'Trung',
      triggered_by_avatar: true,
      triggered_by_initials: 'T',
      is_read: true,
      created_at: 'Yesterday',
      group: 'Yesterday',
      role: 'USER',
      task_status: 'In Progress',
      space_id: 'spaces'
    },
    {
      NOTI_id: 4,
      type: 'due_today',
      task_name: 'Database Migration',
      is_read: false,
      created_at: '3 hours ago',
      group: 'Today',
      role: 'USER',
      task_status: 'Pending',
      space_id: 'spaces'
    },
    // ADMIN notifications
    {
      NOTI_id: 10,
      type: 'user_registered',
      target_user: 'Nguyen Van A',
      is_read: false,
      created_at: '5 min ago',
      group: 'Today',
      role: 'ADMIN'
    },
    {
      NOTI_id: 11,
      type: 'account_locked',
      target_user: 'User123',
      is_read: false,
      created_at: '10 min ago',
      group: 'Today',
      role: 'ADMIN'
    },
    {
      NOTI_id: 12,
      type: 'user_verified',
      target_user: 'Alex Morgan',
      is_read: true,
      created_at: '2 days ago',
      group: 'Earlier',
      role: 'ADMIN'
    }
  ]);

  const filteredNotifications = allNotifications.filter(n => n.role === currentRole);
  const unreadCount = filteredNotifications.filter(n => !n.is_read).length;

  const handleMarkAllRead = () => {
    setAllNotifications(allNotifications.map(n =>
      n.role === currentRole ? { ...n, is_read: true } : n
    ));
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
  }, [location.pathname, showNotifications, showSettings, showAvatarDropdown,showApps]);

  const isDashboardActive = location.pathname === '/dashboard' || location.pathname === '/dashboard/';
  const isTasksActive = location.pathname === '/dashboard/spaces' || location.pathname.includes('/dashboard/tasks');
  const isUsersActive = location.pathname === '/dashboard/users';
  const isProfileActive = location.pathname === '/dashboard/profile';
  const isNotificationsActive = location.pathname === '/dashboard/notifications';
  const isSettingsActive = location.pathname === '/dashboard/notification-settings';
  const isHelpActive = location.pathname === '/dashboard/help';

  // Handlers for AvatarDropdown actions
  const handleProfileClick = () => {
    navigate(`/dashboard/profile${location.search}`);
    setShowAvatarDropdown(false); // Close dropdown after navigation
  };

  const handleSettingsClick = () => {
    navigate(`/dashboard/notification-settings${location.search}`);
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
  const handleChangeLanguage = (lang) => {
    setLanguage(lang);
    setShowApps(false);
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
          {/* Notifications Item */}
          {isNotificationsActive ? (
            <div className="relative flex items-center">
              <div className="sidebar-active-indicator"></div>
              <Link className="flex items-center flex-1 px-4 py-3 bg-[#E0E8FF] text-[#2D1B4E] rounded-xl transition-colors ml-2 justify-between" to={`/dashboard/notifications${location.search}`}>
                <div className="flex items-center">
                  <i className="w-5 h-5 mr-3 text-[#2D1B4E]" data-lucide="bell"></i>
                  <span className="text-sm font-bold">Notifications</span>
                </div>
                {unreadCount > 0 && (
                  <span className="bg-[#EF4444] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
                )}
              </Link>
            </div>
          ) : (
            <Link className="flex items-center px-4 py-3 text-[#6B7280] hover:bg-gray-50 rounded-xl group transition-colors justify-between" to={`/dashboard/notifications${location.search}`}>
              <div className="flex items-center">
                <i className="w-5 h-5 mr-3" data-lucide="bell"></i>
                <span className="text-sm font-medium">Notifications</span>
              </div>
              {unreadCount > 0 && (
                <span className="bg-[#EF4444] text-white text-[10px] font-bold px-3 py-0.5 rounded-full scale-[0.9]">{unreadCount}</span>
              )}
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
              onClick={() => navigate("/dashboard/notification-settings")}
              className={`flex items-center w-full px-4 py-3 rounded-xl transition-colors ${
                isSettingsActive
                  ? "bg-[#E0E8FF] text-[#2D1B4E]"
                  : "text-[#6B7280] hover:bg-gray-50"
              }`}
            >
              {isSettingsActive && <div className="sidebar-active-indicator"></div>}

              <div className="flex items-center flex-1">
                <i
                  className={`w-5 h-5 mr-3 ${
                    isSettingsActive ? "text-[#2D1B4E]" : ""
                  }`}
                  data-lucide="settings"
                ></i>

                <span className={`text-sm ${isSettingsActive ? "font-bold" : "font-medium"}`}>
                  Settings
                </span>
              </div>
            </button>
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

            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="h-4 w-4 text-gray-400" data-lucide="search"></i>
              </div>
              <input
                className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#2D1B4E] focus:border-[#2D1B4E]"
                placeholder="Search tasks, spaces, users..."
                type="text"
              />
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
                    {language === "en"} 
                </span>

                <i
                    className="w-4 h-4 text-gray-500"
                    data-lucide="chevron-down"
                ></i>
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
          <Outlet context={{ setShowCreateModal, setTasksForModal, setCreateTaskHandler, setSprintsForModal, setCreateTaskInitialSprint, currentRole, currentUser }} />
        </main>
        {/* END: MainContentArea */}

      </div>

      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setCreateTaskInitialSprint(''); }}
        tasks={tasksForModal}
        sprints={sprintsForModal}
        initialSprint={createTaskInitialSprint}
        onCreateTask={createTaskHandler}
        currentRole={currentRole}
        currentUser={currentUser}
      />
    </div>
  );
}
