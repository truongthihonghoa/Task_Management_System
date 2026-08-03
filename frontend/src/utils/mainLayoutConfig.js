export function buildDemoLayoutUser({ isSuperAdmin, currentSpaceRole }) {
  if (isSuperAdmin) {
    return {
      id: 'admin-demo-user',
      name: 'Alex Morgan',
      initials: 'AM',
      role: 'SUPER_ADMIN',
      displayRole: 'Super Admin',
    };
  }

  return {
    id: '8ce04f65-ea2c-4279-8350-7c1f0e81c9f5',
    name: 'Trang Nguyen',
    initials: 'TN',
    role: 'USER',
    displayRole: currentSpaceRole === 'OWNER' ? 'Owner in this space' : 'User',
  };
}

export function getPrimaryNavigationItems({ isSuperAdmin }) {
  return [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: 'layout-grid',
      path: '/dashboard',
      visible: isSuperAdmin,
      match: (pathname) => pathname === '/dashboard' || pathname === '/dashboard/',
    },
    {
      key: 'tasks',
      label: 'Tasks',
      icon: 'clipboard-list',
      path: '/dashboard/spaces',
      visible: true,
      match: (pathname) => (
        pathname === '/dashboard/spaces'
        || pathname.startsWith('/dashboard/spaces/')
        || pathname.includes('/dashboard/tasks')
      ),
    },
    {
      key: 'users',
      label: 'Users',
      icon: 'users',
      path: '/dashboard/users',
      visible: isSuperAdmin,
      match: (pathname) => pathname === '/dashboard/users',
    },
  ].filter((item) => item.visible);
}

export function getSupportNavigationItems() {
  return [
    {
      key: 'help',
      label: 'Help',
      icon: 'help-circle',
      path: '/dashboard/help',
      match: (pathname) => (
        pathname === '/dashboard/help'
        || pathname === '/dashboard/help-guide'
        || pathname.startsWith('/dashboard/help/guides/')
      ),
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: 'settings',
      path: '/dashboard/notification-settings',
      match: (pathname) => pathname === '/dashboard/notification-settings',
    },
  ];
}
