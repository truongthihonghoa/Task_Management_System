import React, { useMemo, useState } from 'react';
import { BellOff, ChevronRight } from 'lucide-react';
import NotificationItem from './NotificationItem';
import { isNotificationWithinDisplayWindow, notificationLimitMessage } from '../../utils/notificationRetention';
import '../../styles/NotificationDropdown.css';

const NotificationDropdown = ({ notifications = [], onMarkAllRead, onViewAll, onClose, onNotificationClick, onDeleteNotification }) => {
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const visibleNotifications = useMemo(
    () => notifications.filter(isNotificationWithinDisplayWindow),
    [notifications]
  );

  const groupedNotifications = useMemo(() => {
    const groups = { Today: [], Yesterday: [], Earlier: [] };
    visibleNotifications.forEach(n => {
      if (groups[n.group]) {
        groups[n.group].push(n);
      } else {
        groups.Earlier.push(n);
      }
    });
    return groups;
  }, [visibleNotifications]);

  const hasNotifications = visibleNotifications.length > 0;

  // Open the full notifications modal from the header dropdown.
  const handleNavigateToAll = () => {
    setOpenActionMenuId(null);
    onViewAll?.();
    onClose?.();
  };

  return (
    <div className="notification-dropdown animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="notification-dropdown__header">
        <h3 className="notification-dropdown__title">Notifications</h3>
        <div className="notification-dropdown__actions">
          <button 
            onClick={() => {
              setOpenActionMenuId(null);
              onMarkAllRead?.();
            }}
            className="notification-dropdown__link notification-dropdown__link--primary"
          >
            Mark all as read
          </button>
          <button 
            onClick={handleNavigateToAll}
            className="notification-dropdown__link"
          >
            View all
          </button>
        </div>
      </div>

      {/* List */}
      <div className="notification-dropdown__list custom-scrollbar">
        {hasNotifications ? (
          Object.entries(groupedNotifications).map(([group, items]) => (
            items.length > 0 && (
              <div key={group}>
                <div className="notification-dropdown__group">
                  {group}
                </div>
                {items.map(item => (
                  <NotificationItem 
                    key={item.NOTI_id} 
                    notification={item} 
                    onClick={(notification) => {
                      setOpenActionMenuId(null);
                      onNotificationClick?.(notification);
                      onClose?.();
                    }}
                    onDelete={onDeleteNotification}
                    isMenuOpen={openActionMenuId === item.NOTI_id}
                    onMenuToggle={(notificationId) => {
                      setOpenActionMenuId((currentId) => (
                        currentId === notificationId ? null : notificationId
                      ));
                    }}
                    onMenuClose={() => setOpenActionMenuId(null)}
                  />
                ))}
              </div>
            )
          ))
        ) : (
          <div className="notification-dropdown__empty">
            <div className="notification-dropdown__empty-icon">
              <BellOff className="w-8 h-8 text-gray-300" />
            </div>
            <h4 className="notification-dropdown__empty-title">You're all caught up!</h4>
            <p className="notification-dropdown__empty-text">No new notifications.</p>
          </div>
        )}
        {hasNotifications && (
          <div className="notification-dropdown__limit">
            {notificationLimitMessage}
          </div>
        )}
      </div>

      {/* Footer */}
      {hasNotifications && (
        <div className="notification-dropdown__footer">
          <button 
            onClick={handleNavigateToAll}
            className="notification-dropdown__see-all"
          >
            See all notifications
            <ChevronRight className="w-3 h-3 ml-1" />
          </button>
        </div>
      )}

    </div>
  );
};

export default NotificationDropdown;
