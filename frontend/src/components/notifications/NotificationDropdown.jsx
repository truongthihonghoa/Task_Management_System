import React, { useMemo } from 'react';
import { BellOff, ChevronRight } from 'lucide-react';
import NotificationItem from './NotificationItem';
import { isNotificationWithinDisplayWindow, notificationLimitMessage } from '../../utils/notificationRetention';

const NotificationDropdown = ({ notifications = [], onMarkAllRead, onViewAll, onClose }) => {
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
    onViewAll?.();
    onClose?.();
  };

  return (
    <div className="absolute top-full right-0 mt-3 w-[380px] bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[20px] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/40">
        <h3 className="font-bold text-[#4C2B74]">Notifications</h3>
        <div className="flex items-center space-x-4">
          <button 
            onClick={onMarkAllRead}
            className="text-xs font-semibold text-[#4C2B74] hover:underline"
          >
            Mark all as read
          </button>
          <button 
            onClick={handleNavigateToAll}
            className="text-xs font-semibold text-gray-500 hover:text-[#4C2B74]"
          >
            View all
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
        {hasNotifications ? (
          Object.entries(groupedNotifications).map(([group, items]) => (
            items.length > 0 && (
              <div key={group}>
                <div className="px-4 py-2 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {group}
                </div>
                {items.map(item => (
                  <NotificationItem 
                    key={item.NOTI_id} 
                    notification={item} 
                    onClick={onClose}
                  />
                ))}
              </div>
            )
          ))
        ) : (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <BellOff className="w-8 h-8 text-gray-300" />
            </div>
            <h4 className="font-bold text-gray-700 mb-1">You're all caught up!</h4>
            <p className="text-xs text-gray-400">No new notifications.</p>
          </div>
        )}
        {hasNotifications && (
          <div className="px-5 py-3 text-center text-[11px] font-semibold text-gray-400 border-t border-gray-100">
            {notificationLimitMessage}
          </div>
        )}
      </div>

      {/* Footer */}
      {hasNotifications && (
        <div className="p-3 border-t border-gray-100 bg-white/40 flex justify-center">
          <button 
            onClick={handleNavigateToAll}
            className="text-xs font-bold text-[#4C2B74] flex items-center"
          >
            See all notifications
            <ChevronRight className="w-3 h-3 ml-1" />
          </button>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E7EB;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D1D5DB;
        }
      `}</style>
    </div>
  );
};

export default NotificationDropdown;
