import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../api/axiosClient';
import {
  getManagedUser,
  listManagedUsers,
  updateManagedUser,
  updateManagedUserLockStatus,
  updateManagedUserStatus,
} from '../api/userManagementApi';
import UserModal from '../components/tasks/EditUserModal';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 20;
const ROLE_FILTERS = ['All Roles', 'Super Admin', 'User'];
const STATUS_FILTERS = ['All Status', 'Pending', 'Active', 'Inactive', 'Locked'];

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;
  const message = error?.response?.data?.message;

  if (message) return message;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if (detail?.message) return detail.message;

  return 'Unable to load user management data. Please try again.';
}

function getBackendOrigin() {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return '';
  }
}

function normalizeAvatarUrl(avatarUrl) {
  if (!avatarUrl) return '';
  if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) return avatarUrl;
  const path = avatarUrl.startsWith('media/') ? `/${avatarUrl}` : avatarUrl;
  if (path.startsWith('/media/')) return `${getBackendOrigin()}${path}`;
  return avatarUrl;
}

function initialsForName(value = '') {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'U';
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
}

function displayRole(role) {
  return role === 'SUPER_ADMIN' ? 'Super Admin' : 'User';
}

function toApiRole(role) {
  return role === 'Super Admin' ? 'SUPER_ADMIN' : 'USER';
}

function formatDate(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

function statusTone(status) {
  if (status === 'Active') return 'text-green-600 bg-green-500';
  if (status === 'Inactive') return 'text-amber-700 bg-amber-500';
  if (status === 'Locked') return 'text-red-600 bg-red-500';
  return 'text-gray-600 bg-gray-400';
}

function mapApiUser(user) {
  return {
    id: user.user_id,
    userId: user.user_id,
    name: user.full_name || 'User',
    email: user.email || '',
    role: displayRole(user.role),
    apiRole: user.role,
    status: user.status_user || 'Pending',
    lastLogin: formatDate(user.last_login),
    createdAt: formatDate(user.created_at),
    avatar: normalizeAvatarUrl(user.avatar_url || ''),
    raw: user,
  };
}

export default function UserManagement() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();

  const routeUserId = searchParams.get('userId');
  const routeMode = searchParams.get('mode');
  const isSuperAdmin = authUser?.role === 'SUPER_ADMIN';

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('edit');
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [showRoleFilter, setShowRoleFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toast, setToast] = useState({ show: false, message: '' });

  const roleRef = useRef(null);
  const statusRef = useRef(null);
  const routeOpenRef = useRef('');

  const triggerToast = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const loadUsers = useCallback(async () => {
    if (!isSuperAdmin) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await listManagedUsers({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearchTerm,
        status: selectedStatus === 'All Status' ? '' : selectedStatus,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });
      setUsers((response.items || []).map(mapApiUser));
      setTotal(response.total || 0);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchTerm, isSuperAdmin, page, selectedStatus]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isSuperAdmin) {
      navigate('/dashboard/spaces?role=USER', { replace: true });
    }
  }, [isAuthLoading, isSuperAdmin, navigate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (roleRef.current && !roleRef.current.contains(event.target)) {
        setShowRoleFilter(false);
      }

      if (statusRef.current && !statusRef.current.contains(event.target)) {
        setShowStatusFilter(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredUsers = useMemo(() => users.filter((user) => (
    selectedRole === 'All Roles' || user.role === selectedRole
  )), [selectedRole, users]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openEditModal = (user) => {
    setSelectedUser(user);
    setModalMode('edit');
    setModalOpen(true);
  };

  const closeUserModal = () => {
    setModalOpen(false);
    routeOpenRef.current = '';
    if (routeUserId || routeMode) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('userId');
      nextParams.delete('mode');
      setSearchParams(nextParams, { replace: true });
    }
  };

  useEffect(() => {
    if (routeMode !== 'edit' || !routeUserId || !isSuperAdmin) return;
    if (routeOpenRef.current === routeUserId) return;

    const userFromRoute = users.find((user) => String(user.userId) === routeUserId);
    if (userFromRoute) {
      routeOpenRef.current = routeUserId;
      openEditModal(userFromRoute);
      return;
    }

    routeOpenRef.current = routeUserId;
    getManagedUser(routeUserId)
      .then((response) => openEditModal(mapApiUser(response)))
      .catch((error) => {
        routeOpenRef.current = '';
        setErrorMessage(getErrorMessage(error));
      });
  }, [isSuperAdmin, routeMode, routeUserId, users]);

  const handleStatusFilterChange = (status) => {
    setSelectedStatus(status);
    setPage(1);
    setShowStatusFilter(false);
  };

  const handleSaveUser = async (form, user) => {
    if (!user) return;

    const nextStatus = form.status;
    const nextRole = toApiRole(form.role);
    let responseUser = null;

    if (nextRole !== user.apiRole) {
      responseUser = await updateManagedUser(user.userId, { role: nextRole });
    }

    if (nextStatus !== user.status) {
      if (nextStatus === 'Locked') {
        responseUser = await updateManagedUserLockStatus(user.userId, true);
      } else {
        if (user.status === 'Locked') {
          responseUser = await updateManagedUserLockStatus(user.userId, false);
        }
        if (nextStatus !== 'Active' || user.status !== 'Locked') {
          responseUser = await updateManagedUserStatus(user.userId, nextStatus);
        }
      }
    }

    if (!responseUser) {
      triggerToast('No changes to save.');
      closeUserModal();
      return;
    }

    const mappedUser = mapApiUser(responseUser);
    setUsers((prev) => prev.map((item) => (item.userId === mappedUser.userId ? mappedUser : item)));
    setSelectedUser(mappedUser);
    triggerToast(`User "${mappedUser.name}" updated successfully!`);
    closeUserModal();
  };

  return (
    <div className="mt-4 mb-4 px-6 pt-6 pb-6 space-y-6 max-w-[1400px] w-full mx-auto font-sans relative">
      <div>
        <h2 className="text-2xl font-bold text-[#4C2B74]">User Management</h2>
        <p className="text-sm text-gray-500">Manage users, roles, account status, and permissions.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-[#6B7280] tracking-wider uppercase">
            Search User
          </label>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative w-full max-w-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-gray-400 text-[18px]">search</span>
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-outline-variant rounded text-[11px] outline-none focus:ring-1 focus:ring-[#4C2B74] focus:border-[#4C2B74] transition-all"
                />
              </div>

              <div className="relative" ref={roleRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowRoleFilter(!showRoleFilter);
                    setShowStatusFilter(false);
                  }}
                  className="h-9 px-3 bg-white border border-outline-variant rounded text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-2 shadow-sm"
                >
                  <span>{selectedRole}</span>
                  <span className={`material-symbols-outlined text-[18px] transition-transform ${showRoleFilter ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                {showRoleFilter && (
                  <div className="absolute left-0 mt-2 w-44 bg-white border border-gray-200 rounded shadow-lg z-50 overflow-hidden">
                    {ROLE_FILTERS.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          setSelectedRole(role);
                          setShowRoleFilter(false);
                        }}
                        className={`w-44 text-left px-4 py-2 text-sm hover:bg-[#EBF0FF] transition-colors cursor-pointer text-on-surface ${
                          selectedRole === role ? 'font-semibold' : ''
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative" ref={statusRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowStatusFilter(!showStatusFilter);
                    setShowRoleFilter(false);
                  }}
                  className="h-9 px-3 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-2 shadow-sm"
                >
                  <span>{selectedStatus}</span>
                  <span className={`material-symbols-outlined text-[18px] transition-transform ${showStatusFilter ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                {showStatusFilter && (
                  <div className="absolute left-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                    {STATUS_FILTERS.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleStatusFilterChange(status)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-[#EBF0FF] transition-colors cursor-pointer text-on-surface ${
                          selectedStatus === status ? 'font-semibold' : ''
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-blue-50 border-b border-blue-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3.5">User</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Last Login</th>
                <th className="px-6 py-3.5">Created Date</th>
                <th className="px-6 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500 font-semibold">
                    Loading users...
                  </td>
                </tr>
              )}

              {!isLoading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500 font-semibold">
                    No users found.
                  </td>
                </tr>
              )}

              {!isLoading && filteredUsers.map((user) => {
                const isAdminRole = user.apiRole === 'SUPER_ADMIN';
                const tone = statusTone(user.status);

                return (
                  <tr
                    key={user.userId}
                    className="hover:bg-purple-50/30 transition cursor-pointer"
                    onClick={() => openEditModal(user)}
                  >
                    <td className="px-6 py-3.5 flex items-center space-x-3">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover border border-gray-100" />
                      ) : (
                        <div className="w-8 h-8 rounded-full border border-purple-100 bg-purple-50 text-[#4C2B74] flex items-center justify-center text-[11px] font-bold">
                          {initialsForName(user.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900 leading-tight">{user.name}</p>
                        <p className="text-gray-400 text-[11px] mt-0.5">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2 py-0.5 text-[11px] font-medium rounded border ${
                        isAdminRole
                          ? 'bg-blue-50 text-blue-700 border-blue-100'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center space-x-1.5 font-bold ${tone.split(' ')[0]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${tone.split(' ')[1]}`}></span>
                        <span>{user.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-500 font-medium">{user.lastLogin}</td>
                    <td className="px-6 py-3.5 text-gray-400 font-medium">{user.createdAt}</td>
                    <td className="px-6 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEditModal(user); }}
                        className="text-gray-400 hover:text-gray-600 p-1 transition-colors"
                        aria-label="Edit user"
                      >
                        <span className="material-symbols-outlined text-[18px]">more_vert</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500">
        <span>
          Showing {filteredUsers.length} of {total} users
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="h-8 px-3 rounded border border-gray-200 bg-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="font-semibold text-gray-600">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="h-8 px-3 rounded border border-gray-200 bg-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      <UserModal
        isOpen={modalOpen}
        mode={modalMode}
        selectedUser={selectedUser}
        onClose={closeUserModal}
        onSave={handleSaveUser}
        onSaveSuccess={triggerToast}
      />

      <div className={`fixed bottom-8 right-8 bg-[#1F2937] text-white px-5 py-3 rounded-xl shadow-2xl transition-all duration-300 flex items-center gap-3 z-[100] ${
        toast.show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
      }`}>
        <span className="material-symbols-outlined text-green-400 text-[20px]">check_circle</span>
        <span className="text-xs font-semibold tracking-wide">{toast.message}</span>
      </div>
    </div>
  );
}
