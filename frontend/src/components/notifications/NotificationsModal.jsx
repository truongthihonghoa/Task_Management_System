import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, BellOff, X } from 'lucide-react';
import NotificationItem from './NotificationItem';
import { isNotificationWithinDisplayWindow, notificationLimitMessage } from '../../utils/notificationRetention';
import '../../styles/NotificationsModal.css';

const buildNotificationSearchText = (notification) => [
  notification.title,
  notification.message,
  notification.type,
  notification.audience,
  notification.role,
  notification.task_name,
  notification.task_title,
  notification.space_name,
  notification.space,
  notification.sprint_name,
  notification.triggered_by_name,
  notification.triggered_by_email,
  notification.target_user,
  notification.target_user_email,
  notification.target_user_id,
  notification.task_id,
  notification.space_id,
  notification.audit_log_id,
  notification.new_status,
  notification.new_priority,
  notification.priority,
].filter(Boolean).join(' ').toLowerCase();

const NotificationsModal = ({
  isOpen,
  onClose,
  currentRole,
  currentSpaceRole = 'USER',
  isSuperAdmin = false,
  notifications = [],
  onUpdateNotifications,
  onDeleteNotification,
}) => {
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  if (!isOpen) return null;

  const roleFiltered = notifications.filter(n => {
    if (!isNotificationWithinDisplayWindow(n)) {
      return false;
    }
    if (isSuperAdmin || currentRole === 'ADMIN') {
      return n.audience === 'SUPER_ADMIN' || n.role === 'ADMIN';
    }
    return n.audience === 'USER' || n.audience === 'OWNER' || n.audience === 'MEMBER' || n.role === 'USER';
  });

  const filteredNotifications = roleFiltered.filter(n => {
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Unread' && !n.is_read) ||
      (filter === 'Read' && n.is_read);

    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    const matchesSearch =
      !normalizedSearchQuery ||
      buildNotificationSearchText(n).includes(normalizedSearchQuery);

    return matchesFilter && matchesSearch;
  });

  const markAllAsRead = () => {
    setOpenActionMenuId(null);
    const updated = notifications.map(n =>
      roleFiltered.some(item => item.NOTI_id === n.NOTI_id) ? { ...n, is_read: true } : n
    );
    onUpdateNotifications?.(updated);
  };

  const handleNotificationClick = (clickedNoti) => {
    setOpenActionMenuId(null);
    const updated = notifications.map(n =>
      n.NOTI_id === clickedNoti.NOTI_id ? { ...n, is_read: true } : n
    );
    onUpdateNotifications?.(updated);
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
        className="notifications-modal animate-in fade-in zoom-in-95 duration-200"
        data-purpose="notifications-popup-form"
      >
        {/* Header Section */}
        <div className="notifications-modal__header">
          <div>
            <div className="notifications-modal__title-row">
              <h2 className="notifications-modal__title">Notifications</h2>
              {roleFiltered.filter(n => !n.is_read).length > 0 && (
                <span className="notifications-modal__new-badge">
                  {roleFiltered.filter(n => !n.is_read).length} New
                </span>
              )}
            </div>
            <p className="notifications-modal__description">
              {isSuperAdmin || currentRole === "ADMIN"
                ? "View and manage important Super Admin system notifications."
                : "View and manage your notifications."}
            </p>
          </div>

          <div className="notifications-modal__actions">
            <button
              onClick={markAllAsRead}
              className="notifications-modal__mark-read"
            >
              Mark all as read
            </button>
            <button
              onClick={onClose}
              className="notifications-modal__close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="notifications-modal__toolbar">
          <div className="notifications-modal__filters">
            {['All', 'Unread', 'Read'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`notifications-modal__filter ${filter === f ? 'notifications-modal__filter--active' : ''}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="notifications-modal__search">
            <Search className="notifications-modal__search-icon w-4 h-4" />
            <input
              type="text"
              placeholder={
                isSuperAdmin || currentRole === "ADMIN"
                  ? "Search system notifications..."
                  : "Search your notifications..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="notifications-modal__search-input"
            />
          </div>
        </div>

        {/* Dynamic List */}
        <div className="notifications-modal__list custom-scrollbar divide-y divide-gray-50">
          {filteredNotifications.length > 0 ? (
            <>
              {filteredNotifications.map(notification => (
                <NotificationItem
                  key={notification.NOTI_id}
                  notification={notification}
                  onClick={handleNotificationClick}
                  onDelete={onDeleteNotification}
                  showFullTimestamp
                  isMenuOpen={openActionMenuId === notification.NOTI_id}
                  onMenuToggle={(notificationId) => {
                    setOpenActionMenuId((currentId) => (
                      currentId === notificationId ? null : notificationId
                    ));
                  }}
                  onMenuClose={() => setOpenActionMenuId(null)}
                />
              ))}
              <div className="notifications-modal__limit">
                {notificationLimitMessage}
              </div>
            </>
          ) : (
            <div className="notifications-modal__empty">
              <div className="notifications-modal__empty-icon">
                <BellOff className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="notifications-modal__empty-title">No {(isSuperAdmin || currentRole === 'ADMIN') ? 'super admin' : 'account'} notifications</h3>
              <p className="notifications-modal__empty-text">
                {currentRole === 'USER'
                  ? "You'll see task, space, and owner-level updates that are relevant to your account."
                  : "Only important system management events will appear here."}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
};

export default NotificationsModal;
