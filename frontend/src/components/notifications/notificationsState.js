// Shared notifications state for both MainLayout and NotificationsModal

export let globalNotifications = [
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
  // ADMIN
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
];

export const updateGlobalNotifications = (newData) => {
  globalNotifications = newData;
  window.dispatchEvent(new Event('sync_global_notifications'));
};
