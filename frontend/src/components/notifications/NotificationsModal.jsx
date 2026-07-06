import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, BellOff, X } from 'lucide-react';
import NotificationItem from './NotificationItem';
import { globalNotifications, updateGlobalNotifications } from './notificationsState';

const NotificationsModal = ({ isOpen, onClose, currentRole }) => {
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [allNotifications, setAllNotifications] = useState(globalNotifications);

  // Sync with global notifications updates
  useEffect(() => {
    if (!isOpen) return;
    const handleSync = () => setAllNotifications([...globalNotifications]);
    window.addEventListener('sync_global_notifications', handleSync);
    // Initial sync on open
    handleSync();
    return () => window.removeEventListener('sync_global_notifications', handleSync);
  }, [isOpen]);

  if (!isOpen) return null;

  const roleFiltered = allNotifications.filter(n => n.role === currentRole);

  const filteredNotifications = roleFiltered.filter(n => {
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Unread' && !n.is_read) ||
      (filter === 'Read' && n.is_read);

    const taskName = n.task_name || '';
    const triggeredBy = n.triggered_by_name || '';
    const targetUser = n.target_user || '';

    const matchesSearch =
      taskName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      triggeredBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      targetUser.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const markAllAsRead = () => {
    const updated = globalNotifications.map(n =>
      n.role === currentRole ? { ...n, is_read: true } : n
    );
    updateGlobalNotifications(updated);
  };

  const handleNotificationClick = (clickedNoti) => {
    const updated = globalNotifications.map(n =>
      n.NOTI_id === clickedNoti.NOTI_id ? { ...n, is_read: true } : n
    );
    updateGlobalNotifications(updated);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-all duration-300"
        onClick={onClose}
      />

      {/* Modal Dialog Content */}
      <div 
        className="relative bg-white w-full max-w-3xl h-[80vh] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        data-purpose="notifications-popup-form"
      >
        {/* Header Section */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-[#4C2B74]">Notifications</h2>
              {roleFiltered.filter(n => !n.is_read).length > 0 && (
                <span className="bg-[#EF4444] text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                  {roleFiltered.filter(n => !n.is_read).length} New
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              {currentRole.toLowerCase() === "admin"
                ? "View and manage important system notifications."
                : "View and manage your notifications."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-[#FAF8FF] border border-[#E0D7F0] text-[#4C2B74] text-xs font-bold rounded-xl hover:bg-[#F2EDFA] transition-colors shadow-inner"
            >
              Mark all as read
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="px-6 py-4 border-b border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/30 flex-shrink-0">
          <div className="flex bg-gray-100/60 p-1 rounded-xl">
            {['All', 'Unread', 'Read'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filter === f
                    ? 'bg-white text-[#4C2B74] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={
                currentRole === "ADMIN"
                  ? "Search system notifications..."
                  : "Search your notifications..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#4C2B74]/20 focus:border-[#4C2B74]/30"
            />
          </div>
        </div>

        {/* Dynamic List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-50">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map(notification => (
              <NotificationItem
                key={notification.NOTI_id}
                notification={notification}
                onClick={handleNotificationClick}
              />
            ))
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center px-10">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <BellOff className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="font-bold text-gray-700">No {currentRole.toLowerCase()} notifications</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                {currentRole === 'USER'
                  ? "You'll only see updates here from other users on your tasks."
                  : "Only important system management events will appear here."}
              </p>
            </div>
          )}
        </div>

        {/* Scrollbar styling */}
        <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #E4E4E7;
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #D4D4D8;
          }
        `}</style>
      </div>
    </div>,
    document.body
  );
};

export default NotificationsModal;
