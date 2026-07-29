import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import CreateSpaceModal from '../components/tasks/CreateSpaceModal';
import SpaceDetailModal from '../components/spaces/SpaceDetailModal';
import axiosClient from '../api/axiosClient';

export const DEMO_SPACES = [
  {
    id: 'SP-001',
    title: 'Task Management System',
    description: 'Final project for task management system integration with enterprise...',
    tasksCount: 25,
    date: '2026-06-01',
    status: 'Active',
    ownerId: 'pham-tien',
    memberIds: ['trang-nguyen']
  },
  {
    id: 'SP-002',
    title: 'E-Commerce Platform',
    description: 'Headless commerce rebuild with Next.js and high-performance API...',
    tasksCount: 18,
    date: '2026-05-15',
    status: 'Active',
    ownerId: 'pham-tien',
    memberIds: ['trang-nguyen']
  },
  {
    id: 'SP-003',
    title: 'CRM System',
    description: 'Legacy customer relationship management maintenance and data...',
    tasksCount: 12,
    date: '2026-04-20',
    status: 'Active',
    ownerId: 'trang-nguyen',
    memberIds: ['pham-tien']
  },
  {
    id: 'SP-004',
    title: 'Mobile App Development',
    description: 'Cross-platform mobile application development with React Native...',
    tasksCount: 32,
    date: '2026-06-10',
    status: 'Active',
    ownerId: 'pham-tien',
    memberIds: ['trang-nguyen']
  }
];

const getLayoutQueryParams = (search) => {
  const currentParams = new URLSearchParams(search);
  const nextParams = new URLSearchParams();
  ['role', 'spaceRole', 'user'].forEach((key) => {
    const value = currentParams.get(key);
    if (value) {
      nextParams.set(key, value);
    }
  });
  return nextParams;
};

const formatSpaceDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const getSpaceDisplayDate = (space) => {
  if (space.status === 'Deleted') {
    return formatSpaceDate(space.deletedAt || space.deleted_at || space.date);
  }
  return formatSpaceDate(space.date);
};

const getErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail || error?.response?.data?.message;
  if (Array.isArray(detail)) {
    return detail.map(item => item?.msg || String(item)).join(', ') || fallback;
  }
  return detail || error?.message || fallback;
};

const mapApiSpace = (space) => ({
  id: space.space_id,
  title: space.name_space || 'Untitled Space',
  description: space.description || 'No description provided.',
  tasksCount: space.task_count ?? space.tasks_count ?? 0,
  date: formatSpaceDate(space.created_at),
  updatedAt: space.updated_at,
  archivedAt: space.archived_at,
  reopenUntil: space.reopen_until,
  canReopen: Boolean(space.can_reopen),
  deletedAt: space.deleted_at,
  status: space.status_space || 'Active',
  ownerId: space.owner_id,
  memberIds: [],
  raw: space,
});

const listSpacesRequest = async ({ includeDeleted = false } = {}) => {
  const response = await axiosClient.get('/spaces', {
    params: includeDeleted ? { include_deleted: true } : undefined,
  });
  return response.data.map(mapApiSpace);
};

const listOwnerTrashRequest = async (ownerId) => {
  if (!ownerId) return [];
  const response = await axiosClient.get(`/spaces/owners/${ownerId}/trash`);
  return response.data.map(mapApiSpace);
};

const createSpaceRequest = async ({ name, title, description, ownerId }) => {
  const response = await axiosClient.post('/spaces', {
    name_space: name || title,
    description: description || null,
    owner_id: ownerId,
  });
  return mapApiSpace(response.data);
};

const updateSpaceRequest = async (spaceId, { name, title, description }) => {
  const response = await axiosClient.patch(`/spaces/${spaceId}`, {
    name_space: name || title,
    description: description || null,
  });
  return mapApiSpace(response.data);
};

const completeSpaceRequest = async (spaceId) => {
  const response = await axiosClient.post(`/spaces/${spaceId}/complete`);
  return mapApiSpace(response.data);
};

const listAllSpaceTasksRequest = async (spaceId) => {
  const pageSize = 100;
  const firstResponse = await axiosClient.get(`/spaces/${spaceId}/tasks`, {
    params: { page: 1, page_size: pageSize, active_sprint_only: false },
  });
  const firstPage = firstResponse.data;
  const items = [...(firstPage.items || [])];
  const total = firstPage.total || items.length;
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages > 1) {
    const remainingResponses = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) => (
        axiosClient.get(`/spaces/${spaceId}/tasks`, {
          params: { page: index + 2, page_size: pageSize, active_sprint_only: false },
        })
      ))
    );
    remainingResponses.forEach(response => {
      items.push(...(response.data.items || []));
    });
  }

  return items;
};

const getSpaceCompletionReadiness = async (spaceId) => {
  const [tasks, sprintsResponse, pendingRequestsResponse] = await Promise.all([
    listAllSpaceTasksRequest(spaceId),
    axiosClient.get(`/spaces/${spaceId}/sprints`),
    axiosClient.get(`/spaces/${spaceId}/member-requests`),
  ]);

  const incompleteTasksCount = tasks.filter(task => !['done', 'cancelled'].includes(task.task_status)).length;
  const incompleteSprintsCount = (sprintsResponse.data || []).filter(sprint => (
    sprint.status !== 'Completed' && sprint.status !== 'Deleted'
  )).length;
  const pendingInvitationsCount = (pendingRequestsResponse.data || []).filter(request => (
    request.status === 'PENDING_OWNER' || request.status === 'PENDING_INVITEE'
  )).length;

  return {
    incompleteTasksCount,
    incompleteSprintsCount,
    pendingInvitationsCount,
    isReady: incompleteTasksCount === 0 && incompleteSprintsCount === 0 && pendingInvitationsCount === 0,
  };
};

const unarchiveSpaceRequest = async (spaceId) => {
  const response = await axiosClient.post(`/spaces/${spaceId}/unarchive`);
  return mapApiSpace(response.data);
};

const deleteSpaceRequest = async (spaceId) => {
  const response = await axiosClient.delete(`/spaces/${spaceId}`);
  return mapApiSpace(response.data);
};

const restoreSpaceRequest = async (spaceId) => {
  const response = await axiosClient.post(`/spaces/${spaceId}/restore`);
  return mapApiSpace(response.data);
};

const SpaceManagement = ({ routeContext = null } = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const outletContext = useOutletContext() || {};
  const { currentRole = 'ADMIN', currentUser = null } = routeContext || outletContext;
  const currentUserId = currentUser?.id || currentUser?.user_id || '';
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || currentRole === 'ADMIN';
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('Recently Created');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [createSpaceError, setCreateSpaceError] = useState('');
  const [spaceToComplete, setSpaceToComplete] = useState(null);
  const [isCompletingSpace, setIsCompletingSpace] = useState(false);
  const [completeSpaceError, setCompleteSpaceError] = useState('');
  const [completeSpaceReadiness, setCompleteSpaceReadiness] = useState(null);
  const [isLoadingCompleteSpaceReadiness, setIsLoadingCompleteSpaceReadiness] = useState(false);
  const [spaceAction, setSpaceAction] = useState(null);
  const [isSpaceActionSubmitting, setIsSpaceActionSubmitting] = useState(false);
  const [spaceActionError, setSpaceActionError] = useState('');
  const [spaceView, setSpaceView] = useState('active');
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [spacesError, setSpacesError] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [spaceDetailSelection, setSpaceDetailSelection] = useState(null);
  const datePickerRef = useRef(null);
  const canCreateSpace = currentRole === 'USER' && !isSuperAdmin && Boolean(currentUserId);
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
 
  const getDaysInMonth = (year, month) => {
    const days = [];
    const startDay = new Date(year, month, 1).getDay();
    const numDays = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= numDays; d++) days.push(d);
    return days;
  };
 
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
 
  const [spaces, setSpaces] = useState([]);
  const isRecentlyDeletedView = spaceView === 'deleted';

  const loadSpaces = async () => {
    if (!currentUserId && !isSuperAdmin) {
      setSpaces([]);
      return;
    }

    setIsLoadingSpaces(true);
    setSpacesError('');

    try {
      const nextSpaces = isRecentlyDeletedView && !isSuperAdmin
        ? await listOwnerTrashRequest(currentUserId)
        : await listSpacesRequest({ includeDeleted: isRecentlyDeletedView || isSuperAdmin });
      setSpaces(nextSpaces);
    } catch (error) {
      setSpacesError(getErrorMessage(error, 'Unable to load spaces.'));
      setSpaces([]);
    } finally {
      setIsLoadingSpaces(false);
    }
  };

  useEffect(() => {
    loadSpaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, isSuperAdmin, isRecentlyDeletedView]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setIsDatePickerOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const canAccessSpace = (space, userId) => {
    if (isSuperAdmin || userId === 'alex-morgan') return true;
    if (!userId) return false;

    // The backend already scopes /spaces to the logged-in user. If a non-owner
    // space reaches the UI, the user is an active member of it.
    return true;
  };
  
  const getUserRoleInSpace = (space, userId) => {
    if (!userId) return null;
    if (isSuperAdmin) return null;
    if (space.ownerId === userId) return 'Owner';
    return 'Member';
  };

  const handleViewTasks = (space, isAssigned, isOwner) => {
    if (isAssigned) {
      const params = getLayoutQueryParams(location.search);
      if (!isSuperAdmin) {
        params.set('role', 'USER');
        params.set('spaceRole', isOwner ? 'OWNER' : 'USER');
      }
      const query = params.toString();
      navigate(`/dashboard/tasks/${space.id}${query ? `?${query}` : ''}`);
    }
  };

  const handleOpenSpaceDetail = (space, isAssigned, isOwner) => {
    if (!isAssigned) return;

    setSpaceDetailSelection({
      space,
      isOwner,
      roleLabel: isSuperAdmin ? null : isOwner ? 'Owner' : 'Member',
    });
  };

  const closeSpaceDetailModal = () => {
    setSpaceDetailSelection(null);
  };

  const handleUpdateSpaceDetails = async (spaceId, data) => {
    const updatedSpace = await updateSpaceRequest(spaceId, data);
    setSpaces(prev => prev.map(space => (space.id === updatedSpace.id ? updatedSpace : space)));
    setSpaceDetailSelection(prev => (
      prev?.space?.id === updatedSpace.id
        ? { ...prev, space: updatedSpace }
        : prev
    ));
    return updatedSpace;
  };

  const openCompleteSpaceModal = async (space) => {
    setCompleteSpaceError('');
    setCompleteSpaceReadiness(null);
    setSpaceToComplete(space);
    setIsLoadingCompleteSpaceReadiness(true);
    try {
      const readiness = await getSpaceCompletionReadiness(space.id);
      setCompleteSpaceReadiness(readiness);
    } catch (error) {
      setCompleteSpaceError(getErrorMessage(error, 'Unable to check whether this space is ready to complete.'));
    } finally {
      setIsLoadingCompleteSpaceReadiness(false);
    }
  };

  const closeCompleteSpaceModal = () => {
    if (isCompletingSpace) return;
    setSpaceToComplete(null);
    setCompleteSpaceError('');
    setCompleteSpaceReadiness(null);
    setIsLoadingCompleteSpaceReadiness(false);
  };

  const handleCompleteSpace = async () => {
    if (!spaceToComplete) return;
    if (!completeSpaceReadiness?.isReady) {
      setCompleteSpaceError('Complete the required items before completing this space.');
      return;
    }

    setIsCompletingSpace(true);
    setCompleteSpaceError('');

    try {
      const completedSpace = await completeSpaceRequest(spaceToComplete.id);
      setSpaces(prev => prev.map(space => (
        space.id === spaceToComplete.id
          ? completedSpace
          : space
      )));
      setSpaceToComplete(null);
    } catch (error) {
      setCompleteSpaceError(getErrorMessage(error, 'Unable to complete this space.'));
    } finally {
      setIsCompletingSpace(false);
    }
  };

  const openSpaceActionModal = (space, type) => {
    setSpaceActionError('');
    setSpaceAction({ space, type });
  };

  const closeSpaceActionModal = () => {
    if (isSpaceActionSubmitting) return;
    setSpaceAction(null);
    setSpaceActionError('');
  };

  const handleSpaceAction = async () => {
    if (!spaceAction?.space || !spaceAction?.type) return;

    setIsSpaceActionSubmitting(true);
    setSpaceActionError('');

    try {
      const actionRequest = spaceAction.type === 'delete'
        ? deleteSpaceRequest
        : spaceAction.type === 'restore'
          ? restoreSpaceRequest
          : unarchiveSpaceRequest;
      const updatedSpace = await actionRequest(spaceAction.space.id);
      setSpaces(prev => {
        if (isRecentlyDeletedView && spaceAction.type === 'restore') {
          return prev.filter(space => space.id !== spaceAction.space.id);
        }
        if (!isRecentlyDeletedView && spaceAction.type === 'delete') {
          return prev.filter(space => space.id !== spaceAction.space.id);
        }
        return prev.map(space => (space.id === spaceAction.space.id ? updatedSpace : space));
      });
      setSpaceAction(null);
    } catch (error) {
      setSpaceActionError(getErrorMessage(error, `Unable to ${spaceAction.type} this space.`));
    } finally {
      setIsSpaceActionSubmitting(false);
    }
  };
 
  const filteredAndSortedSpaces = spaces
    .filter(space => {
      if (!canAccessSpace(space, currentUserId)) return false;
      if (isRecentlyDeletedView) {
        if (space.status !== 'Deleted') return false;
      } else if (space.status === 'Deleted') {
        return false;
      }
      const matchesSearch = space.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        space.description.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (selectedDate) {
        const spaceDate = new Date(getSpaceDisplayDate(space));
        return spaceDate.getFullYear() === selectedDate.getFullYear() &&
               spaceDate.getMonth() === selectedDate.getMonth() &&
               spaceDate.getDate() === selectedDate.getDate();
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'Alpha-numeric') {
        return a.title.localeCompare(b.title);
      }
      if (sortOrder === 'Oldest') {
        return new Date(getSpaceDisplayDate(a)) - new Date(getSpaceDisplayDate(b));
      }
      // Recently Created
      return new Date(getSpaceDisplayDate(b)) - new Date(getSpaceDisplayDate(a));
    });
 
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, []);

  const completionBlockers = completeSpaceReadiness
    ? [
        {
          label: 'Tasks not Done/Cancelled',
          count: completeSpaceReadiness.incompleteTasksCount,
          helper: 'All tasks in this space must be Done or Cancelled.',
        },
        {
          label: 'Sprints not Completed',
          count: completeSpaceReadiness.incompleteSprintsCount,
          helper: 'All sprints in this space must be Completed.',
        },
        {
          label: 'Pending invitations',
          count: completeSpaceReadiness.pendingInvitationsCount,
          helper: 'No member invitations can still be pending.',
        },
      ]
    : [];
  const canSubmitCompleteSpace = Boolean(completeSpaceReadiness?.isReady) &&
    !isLoadingCompleteSpaceReadiness &&
    !isCompletingSpace;
 
  return (
    <div className="px-6 pb-6 pt-10 bg-[#F5F7FA] min-h-full">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
          <div>
          <h1 className="text-2xl font-bold text-[#4C2B74]">Space Management</h1>
          <p className="text-sm text-gray-500">Manage and organize your team's project ecosystems.</p>
          </div>
        {canCreateSpace && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#4C2B74] text-white px-4 py-2 rounded-lg flex items-center text-sm font-semibold hover:bg-opacity-90 transition-all shadow-md active:scale-95"
          >
            <i data-lucide="plus" className="w-4 h-4 mr-2"></i>
            Create Space
          </button>
        )}
        </div>
 
      {/* Search and Filter Section */}
      <div className="bg-white p-5 rounded-lg border border-outline-variant shadow-sm mb-8 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-outline uppercase mb-1.5 ml-0.5">Search Spaces</label>
          <div className="relative flex items-center">
            <i data-lucide="search" className="w-4 h-4 absolute left-3 text-outline"></i>
            <input
              type="text"
              placeholder="Search by name or description..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-outline-variant rounded text-[11px] outline-none focus:ring-2 focus:ring-[#4C2B74] focus:border-[#4C2B74] transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSpaceView(prev => prev === 'deleted' ? 'active' : 'deleted')}
          className={`flex h-[34px] items-center gap-2 rounded border px-3 text-[11px] font-bold transition-all shadow-sm active:scale-95 ${
            isRecentlyDeletedView
              ? 'border-[#4C2B74] bg-[#4C2B74] text-white hover:bg-[#3D225E]'
              : 'border-outline-variant bg-white text-[#5e4db2] hover:border-[#5e4db2] hover:bg-[#f0edff]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {isRecentlyDeletedView ? 'arrow_back' : 'delete'}
          </span>
          {isRecentlyDeletedView ? 'All Spaces' : 'Recently Deleted'}
        </button>

        <div className="w-43" ref={datePickerRef}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(prev => !prev)}
              aria-expanded={isDatePickerOpen}
              className={`w-full flex items-center justify-between px-3 py-1.5 bg-white border rounded transition-colors shadow-sm cursor-pointer hover:bg-surface-container hover:border-[#5e4db2] ${
                isDatePickerOpen ? 'border-[#5e4db2]' : 'border-outline-variant'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#5e4db2] text-[18px]">calendar_month</span>
                <span className="text-[11px] font-bold text-[#5e4db2]">
                  {selectedDate ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date'}
                </span>
              </div>
              <span className="material-symbols-outlined text-outline text-[16px]">expand_more</span>
            </button>
 
            {/* Calendar Dropdown */}
            {isDatePickerOpen && (
            <div className="absolute top-full right-0 mt-2 w-[280px] bg-white border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
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
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
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
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
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
                    const today = new Date();
                    const isToday = day === today.getDate() &&
                      viewMonth === today.getMonth() &&
                      viewYear === today.getFullYear();
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
                          setIsDatePickerOpen(false);
                        }}
                        className={`h-7 w-7 flex items-center justify-center rounded-lg text-[10px] transition-all ${isSelected
                          ? 'bg-[#5e4db2] text-white font-bold shadow-sm scale-110'
                          : isToday
                            ? 'border border-[#5e4db2] text-[#5e4db2] font-semibold'
                            : 'hover:bg-[#f0edff] hover:text-[#5e4db2] text-on-surface'
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
 
      {/* Empty State */}
      {spacesError && (
        <div className="mb-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
          {spacesError}
        </div>
      )}

      {isLoadingSpaces && (
        <div className="mb-5 rounded-lg border border-[#E5E0EF] bg-white px-4 py-3 text-[13px] font-semibold text-[#4C2B74] shadow-sm">
          Loading spaces...
        </div>
      )}

      {!isLoadingSpaces && filteredAndSortedSpaces.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
            <i data-lucide="folder-open" className="w-10 h-10 text-gray-300"></i>
          </div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">
            {isRecentlyDeletedView ? 'No recently deleted spaces' : "You don't have any spaces yet"}
          </h3>
          <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
            {isRecentlyDeletedView
              ? 'Deleted spaces owned by you will appear here until they are restored.'
              : 'Create your first space to start organizing your projects and collaborating with your team.'}
          </p>
          {canCreateSpace && !isRecentlyDeletedView && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-[#4C2B74] text-white px-6 py-3 rounded-lg flex items-center text-sm font-semibold hover:bg-opacity-90 transition-all shadow-md active:scale-95"
            >
              <i data-lucide="plus" className="w-4 h-4 mr-2"></i>
              Create Space
            </button>
          )}
        </div>
      )}

      {/* Grid of Space Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedSpaces.map(space => {
          const isAssigned = canAccessSpace(space, currentUserId);
          const userSpaceRole = getUserRoleInSpace(space, currentUserId);
          const isOwner = !isSuperAdmin && userSpaceRole === 'Owner';
          const isArchived = space.status === 'Archived';
          const isDeleted = space.status === 'Deleted';
          const canCompleteSpace = isAssigned && isOwner && space.status === 'Active';
          const canReopenSpace = isAssigned && isOwner && space.status === 'Archived' && space.canReopen;
          const canDeleteSpace = isAssigned && isOwner && !isDeleted;
          const canRestoreSpace = isAssigned && isOwner && isDeleted;
          const footerActionCount = (canCompleteSpace ? 1 : 0) + (canReopenSpace ? 1 : 0);
          const displayDate = getSpaceDisplayDate(space);
          return (
            <div
              key={space.id}
              role="button"
              tabIndex={isAssigned ? 0 : -1}
              onClick={() => handleOpenSpaceDetail(space, isAssigned, isOwner)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleOpenSpaceDetail(space, isAssigned, isOwner);
                }
              }}
              className="group flex min-h-[218px] cursor-pointer flex-col overflow-hidden rounded-xl border border-[#ECE7F4] bg-white shadow-[0_10px_28px_rgba(76,43,116,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D8CDE8] hover:shadow-[0_18px_42px_rgba(76,43,116,0.12)] focus:outline-none focus:ring-2 focus:ring-[#D9D3F6]"
            >
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold leading-6 text-[#4C2B74]">{space.title}</h3>
                  {userSpaceRole && (
                    <span className={`shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-bold leading-none tracking-wide ${
                      userSpaceRole === 'Owner'
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-[#D9D3F6] bg-[#F2F0FF] text-[#5e4db2]'
                    }`}>
                      {userSpaceRole}
                    </span>
                  )}
                </div>
                <p className="mb-5 line-clamp-2 min-h-[38px] text-[12px] leading-relaxed text-[#6B6375]">{space.description}</p>
   
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#F0ECF6] pt-4 text-[#6B6375]">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
                    <div className="flex items-center whitespace-nowrap">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F4F0FA]">
                        <span className="material-symbols-outlined text-[16px] leading-none text-[#4C2B74]">task_alt</span>
                      </span>
                      <span className="ml-2 text-[12px] font-semibold">{space.tasksCount} Tasks</span>
                    </div>
                    <div className="flex items-center whitespace-nowrap">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F4F0FA]">
                        <span className="material-symbols-outlined text-[16px] leading-none text-[#4C2B74]">event</span>
                      </span>
                      <span className="ml-2 text-[12px] font-semibold">{displayDate}</span>
                    </div>
                  </div>

                  {canDeleteSpace && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openSpaceActionModal(space, 'delete');
                      }}
                      aria-label={`Delete ${space.title}`}
                      title="Delete space"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent text-red-600 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-200 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[18px] leading-none">delete</span>
                    </button>
                  )}

                  {canRestoreSpace && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openSpaceActionModal(space, 'restore');
                      }}
                      aria-label={`Restore ${space.title}`}
                      title="Restore space"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent text-[#4C2B74] transition-all hover:border-[#DDD4EA] hover:bg-[#F4F0FA] hover:text-[#3D225E] focus:outline-none focus:ring-2 focus:ring-[#D9D3F6] active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[18px] leading-none">undo</span>
                    </button>
                  )}
                </div>
              </div>
   
              {!isRecentlyDeletedView && (
                <div className="p-4 bg-gray-50/50 border-t border-gray-100">
                  <div
                    className="grid items-center gap-3"
                    style={{ gridTemplateColumns: `repeat(${footerActionCount + 1}, minmax(0, 1fr))` }}
                  >
                    <button
                      disabled={!isAssigned || isDeleted}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleViewTasks(space, isAssigned, isOwner);
                      }}
                      className={`w-full py-2.5 rounded-lg font-bold text-[12px] transition-all shadow-sm ${
                        !isAssigned || isDeleted
                          ? 'bg-[#f0edff] text-[#5e4db2] border border-[#e6e1ff] opacity-50 cursor-not-allowed'
                          : isArchived
                            ? 'bg-[#f0edff] text-[#5e4db2] border border-[#e6e1ff] hover:bg-[#e6e1ff]'
                            : 'bg-[#4C2B74] text-white hover:bg-[#3D225E]'
                      }`}
                    >
                      View Tasks
                    </button>

                    {canCompleteSpace && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openCompleteSpaceModal(space);
                        }}
                        className="w-full py-2.5 rounded-lg border border-[#4C2B74] text-[#4C2B74] bg-white font-bold text-[12px] transition-all shadow-sm hover:bg-[#f0edff] active:scale-95"
                      >
                        Complete
                      </button>
                    )}

                    {canReopenSpace && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openSpaceActionModal(space, 'unarchive');
                        }}
                        className="w-full py-2.5 rounded-lg border border-[#4C2B74] text-[#4C2B74] bg-white font-bold text-[12px] transition-all shadow-sm hover:bg-[#f0edff] active:scale-95"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {spaceToComplete && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={closeCompleteSpaceModal}
          />

          <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-6 py-4">
              <h2 className="text-base font-bold text-on-surface">Complete Space</h2>
              <button
                type="button"
                onClick={closeCompleteSpaceModal}
                disabled={isCompletingSpace}
                className="rounded-full p-1 transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px] text-outline">close</span>
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="flex flex-col gap-4 text-[13px] leading-relaxed text-on-surface-variant">
                <p>
                  Complete <span className="font-bold text-on-surface">{spaceToComplete.title}</span> only when the space is ready to be archived.
                </p>

                {isLoadingCompleteSpaceReadiness ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px] leading-none text-slate-600">hourglass_top</span>
                      <p className="font-bold text-slate-800">Checking completion requirements...</p>
                    </div>
                  </div>
                ) : completeSpaceReadiness ? (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {completionBlockers.map(item => {
                        const hasBlocker = item.count > 0;
                        return (
                          <div
                            key={item.label}
                            className={`rounded-lg border p-3 text-center ${
                              hasBlocker
                                ? 'border-orange-100 bg-orange-50'
                                : 'border-emerald-100 bg-emerald-50'
                            }`}
                            title={item.helper}
                          >
                            <span className={`block text-xl font-bold ${
                              hasBlocker ? 'text-orange-700' : 'text-green-700'
                            }`}>
                              {item.count}
                            </span>
                            <span className={`mt-1 block text-[10px] font-bold uppercase leading-tight ${
                              hasBlocker ? 'text-orange-600' : 'text-green-600'
                            }`}>
                              {item.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {completeSpaceReadiness.isReady ? (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-emerald-800">
                        <div className="flex gap-3">
                          <span className="material-symbols-outlined text-[20px] leading-none text-emerald-600">check_circle</span>
                          <div>
                            <p className="font-bold text-emerald-900">Ready to complete.</p>
                            <p className="mt-1 text-[12px] leading-relaxed">
                              All tasks are Done or Cancelled, all sprints are Completed, and no invitations are pending.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-orange-100 bg-orange-50 px-4 py-3 text-orange-800">
                        <div className="flex gap-3">
                          <span className="material-symbols-outlined text-[20px] leading-none text-orange-600">error</span>
                          <div>
                            <p className="font-bold text-orange-900">Space cannot be completed yet.</p>
                            <p className="mt-1 text-[12px] leading-relaxed">
                              Finish the remaining tasks, complete every sprint, and resolve pending invitations before completing this space.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-red-700">
                    <div className="flex gap-3">
                      <span className="material-symbols-outlined text-[20px] leading-none text-red-600">error</span>
                      <p className="font-bold">Unable to check completion requirements.</p>
                    </div>
                  </div>
                )}

                <p>
                  When completed, this space will be archived and its tasks will become read-only.
                </p>
              </div>

              {completeSpaceError && (
                <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
                  {completeSpaceError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-outline-variant bg-surface-container-low/50 px-6 py-4">
              <button
                type="button"
                onClick={closeCompleteSpaceModal}
                disabled={isCompletingSpace}
                className="rounded-lg px-4 py-2 text-[13px] font-bold text-outline transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompleteSpace}
                disabled={!canSubmitCompleteSpace}
                className={`rounded-lg px-5 py-2 text-[13px] font-bold shadow-md transition-all active:scale-95 ${
                  canSubmitCompleteSpace
                    ? 'bg-[#5e4db2] text-white hover:bg-[#4d3e9c]'
                    : 'cursor-not-allowed bg-gray-200 text-gray-500 shadow-none'
                }`}
              >
                {isCompletingSpace
                  ? 'Completing...'
                  : isLoadingCompleteSpaceReadiness
                    ? 'Checking...'
                    : 'Complete Space'}
              </button>
            </div>
          </div>
        </div>
      )}

      {spaceAction && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={closeSpaceActionModal}
          />

          <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low px-6 py-4">
              <h2 className="text-base font-bold text-on-surface">
                {spaceAction.type === 'delete'
                  ? 'Delete Space'
                  : spaceAction.type === 'restore'
                    ? 'Restore Space'
                    : 'Reopen Space'}
              </h2>
              <button
                type="button"
                onClick={closeSpaceActionModal}
                disabled={isSpaceActionSubmitting}
                className="rounded-full p-1 transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px] text-outline">close</span>
              </button>
            </div>

            <div className="px-6 py-5">
              <p className="text-[13px] leading-relaxed text-on-surface-variant">
                {spaceAction.type === 'delete' ? (
                  <>
                    Are you sure you want to delete <span className="font-bold text-on-surface">{spaceAction.space.title}</span>? This space will be moved to trash and can be restored by the space owner.
                  </>
                ) : spaceAction.type === 'restore' ? (
                  <>
                    Restore <span className="font-bold text-on-surface">{spaceAction.space.title}</span> back to active spaces?
                  </>
                ) : (
                  <>
                    Reopen <span className="font-bold text-on-surface">{spaceAction.space.title}</span> and make it active again?
                  </>
                )}
              </p>

              {spaceActionError && (
                <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
                  {spaceActionError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-outline-variant bg-surface-container-low/50 px-6 py-4">
              <button
                type="button"
                onClick={closeSpaceActionModal}
                disabled={isSpaceActionSubmitting}
                className="rounded-lg px-4 py-2 text-[13px] font-bold text-outline transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSpaceAction}
                disabled={isSpaceActionSubmitting}
                className={`rounded-lg px-5 py-2 text-[13px] font-bold text-white shadow-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 ${
                  spaceAction.type === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-700 hover:bg-blue-800'
                }`}
              >
                {isSpaceActionSubmitting
                  ? (spaceAction.type === 'delete'
                    ? 'Deleting...'
                    : spaceAction.type === 'restore'
                      ? 'Restoring...'
                      : 'Reopening...')
                  : (spaceAction.type === 'delete'
                    ? 'Delete Space'
                    : spaceAction.type === 'restore'
                      ? 'Restore Space'
                      : 'Reopen Space')}
              </button>
            </div>
          </div>
        </div>
      )}

      <SpaceDetailModal
        isOpen={Boolean(spaceDetailSelection)}
        spaceId={spaceDetailSelection?.space?.id}
        previewSpace={spaceDetailSelection?.space}
        roleLabel={spaceDetailSelection?.roleLabel}
        canEdit={Boolean(spaceDetailSelection?.isOwner)}
        onClose={closeSpaceDetailModal}
        onUpdateSpace={handleUpdateSpaceDetails}
        onViewTasks={(space, isOwner) => {
          closeSpaceDetailModal();
          handleViewTasks(space, true, isOwner);
        }}
      />
  
 
      <CreateSpaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        currentUser={currentUser}
        onCreate={async (data) => {
          if (!canCreateSpace) return;
          setIsCreatingSpace(true);
          setCreateSpaceError('');
          try {
            const createdSpace = await createSpaceRequest({
              ...data,
              ownerId: currentUserId,
            });
            setSpaces(prev => [createdSpace, ...prev]);
            setIsCreateModalOpen(false);
          } catch (error) {
            const message = getErrorMessage(error, 'Unable to create this space.');
            setCreateSpaceError(message);
            throw new Error(message);
          } finally {
            setIsCreatingSpace(false);
          }
        }}
        isSubmitting={isCreatingSpace}
        submitError={createSpaceError}
      />
    </div>
  );
};
 
export default SpaceManagement;
 
 
