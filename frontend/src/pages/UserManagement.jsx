import React, { useState } from 'react';
import UserModal from '../components/tasks/CreateUserModal';

// ── Static user data (replace with API data later) ──────────────────────────
const USERS = [
  {
    id: 1,
    name:      'Trang Nguyen',
    email:     'ntttrang241205@gmail.com',
    role:      'Administrator',
    status:    'Active',
    lastLogin: '2 mins ago',
    createdAt: 'Jan 12, 2024',
    avatar:    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  },
  {
    id: 2,
    name:      'Tien Phham',
    email:     'tienthicamphamqn20@gmail.com',
    role:      'User',
    status:    'Active',
    lastLogin: '1 hour ago',
    createdAt: 'Feb 05, 2024',
    avatar:    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
  },
];

export default function UserManagement() {
  // Modal visibility
  const [modalOpen, setModalOpen] = useState(false);
  // 'create' | 'edit'
  const [modalMode, setModalMode] = useState('create');
  // The user being edited (null in create mode)
  const [selectedUser, setSelectedUser] = useState(null);

  // Toast notification
  const [toast, setToast] = useState({ show: false, message: '' });

  const triggerToast = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  // Open modal in create mode
  const openCreateModal = () => {
    setSelectedUser(null);
    setModalMode('create');
    setModalOpen(true);
  };

  // Open modal in edit mode with the clicked user's data
  const openEditModal = (user) => {
    setSelectedUser(user);
    setModalMode('edit');
    setModalOpen(true);
  };

  return (
    <div className="mt-4 mb-4 px-6 pt-6 pb-6 space-y-6 max-w-[1400px] w-full mx-auto font-sans relative">
      
      {/* Tiêu đề trang */}
      <div>
        <h2 className="text-2xl font-bold text-[#4C2B74]">User Management</h2>
        <p className="text-gray-500 text-sm">Manage users, roles, account status, and permissions.</p>
      </div>

      {/* Thanh công cụ tìm kiếm & bộ lọc */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-[#6B7280] tracking-wider uppercase">
            Search Spaces
          </label>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {/* Ô Input Search */}
              <div className="relative w-full max-w-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <i data-lucide="search" className="text-gray-400 w-4 h-4"></i>
                </div>
                <input 
                  type="text" 
                  placeholder="Search by name or email..." 
                  className="w-full pl-10 h-10 px-3 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition shadow-sm"
                />
              </div>
              
              {/* Bộ lọc Roles & Status */}
              <button className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center space-x-2.5 transition shadow-sm">
                <span>All Roles</span> <i data-lucide="chevron-down" className="w-3.5 h-3.5 text-gray-400"></i>
              </button>
              <button className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center space-x-2.5 transition shadow-sm">
                <span>All Status</span> <i data-lucide="chevron-down" className="w-3.5 h-3.5 text-gray-400"></i>
              </button>
            </div>

            {/* + Create User button */}
            <button 
              onClick={openCreateModal}
              className="h-10 px-5 bg-[#4C1D95] hover:bg-[#3B1578] text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md transition flex-shrink-0 active:scale-95"
            >
              <i data-lucide="plus" className="w-4 h-4 stroke-[3]"></i> <span>Create User</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bảng dữ liệu người dùng */}
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
              
              {USERS.map((user) => {
                const isAdmin = user.role === 'Administrator';
                return (
                  <tr
                    key={user.id}
                    className="hover:bg-purple-50/30 transition cursor-pointer"
                    onClick={() => openEditModal(user)}
                  >
                    <td className="px-6 py-3.5 flex items-center space-x-3">
                      <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover border border-gray-100" />
                      <div>
                        <p className="font-bold text-gray-900 leading-tight">{user.name}</p>
                        <p className="text-gray-400 text-[11px] mt-0.5">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2 py-0.5 text-[11px] font-medium rounded border ${
                        isAdmin
                          ? 'bg-blue-50 text-blue-700 border-blue-100'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>{user.role}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center space-x-1.5 font-bold text-green-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        <span>{user.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-500 font-medium">{user.lastLogin}</td>
                    <td className="px-6 py-3.5 text-gray-400 font-medium">{user.createdAt}</td>
                    <td className="px-6 py-3.5 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(user); }}
                        className="text-gray-400 hover:text-gray-600 p-1 transition-colors"
                        aria-label="Edit user"
                      >
                        <i data-lucide="more-vertical" className="w-4 h-4"></i>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal – create or edit */}
      <UserModal
        isOpen={modalOpen}
        initialMode={modalMode}
        selectedUser={selectedUser}
        onClose={() => setModalOpen(false)}
        onSaveSuccess={(msg) => triggerToast(msg)}
      />

      {/* Thông báo Toast Popup */}
      <div className={`fixed bottom-8 right-8 bg-[#1F2937] text-white px-5 py-3 rounded-xl shadow-2xl transition-all duration-300 flex items-center gap-3 z-[100] ${
        toast.show ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
      }`}>
        <span className="material-symbols-outlined text-green-400 text-[20px]">check_circle</span>
        <span className="text-xs font-semibold tracking-wide">{toast.message}</span>
      </div>

    </div>
  );
}