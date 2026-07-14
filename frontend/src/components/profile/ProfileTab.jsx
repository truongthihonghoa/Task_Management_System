import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import ChangePasswordSection from "./ChangePasswordSection";

export default function ProfileTab({ routeContext = null } = {}) {
  const outletContext = useOutletContext() || {};
  const { currentRole, currentUser } = routeContext || outletContext;
  
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef(null); // Ref để trigger chọn file

  const [profileData, setProfileData] = useState({
    fullName: currentUser?.name || 'Alex Morgan',
    username: currentUser?.name?.toLowerCase().replace(/\s/g, '_') || 'jsmith_admin',
    role: currentRole === 'ADMIN' ? 'Super Admin' : 'User',
    accountStatus: 'Active',
    email: currentRole === 'ADMIN' ? 'alex.morgan@taskcore.com' : 'trang.nguyen@taskcore.com',
    avatar: 'https://via.placeholder.com/150' // Thêm trường avatar
  });

  const [editData, setEditData] = useState({ ...profileData });

  // Sync profileData when currentRole or currentUser changes
  useEffect(() => {
    setProfileData({
      fullName: currentUser?.name || 'Alex Morgan',
      username: currentUser?.name?.toLowerCase().replace(/\s/g, '_') || 'jsmith_admin',
      role: currentRole === 'ADMIN' ? 'Super Admin' : 'User',
      accountStatus: 'Active',
      email: currentRole === 'ADMIN' ? 'alex.morgan@taskcore.com' : 'trang.nguyen@taskcore.com',
      avatar: profileData.avatar
    });
    setEditData({
      fullName: currentUser?.name || 'Alex Morgan',
      username: currentUser?.name?.toLowerCase().replace(/\s/g, '_') || 'jsmith_admin',
      role: currentRole === 'ADMIN' ? 'Super Admin' : 'User',
      accountStatus: 'Active',
      email: currentRole === 'ADMIN' ? 'alex.morgan@taskcore.com' : 'trang.nguyen@taskcore.com',
      avatar: profileData.avatar
    });
  }, [currentRole, currentUser]);

  // Tính toán % hoàn thành profile
  const profileCompletion = useMemo(() => {
    const fields = ['fullName', 'username', 'role', 'accountStatus', 'email', 'avatar'];
    const filledFields = fields.filter(field => {
      const value = profileData[field];
      return value && value !== '' && value !== 'https://via.placeholder.com/150';
    });
    const percentage = Math.round((filledFields.length / fields.length) * 100);
    return {
      percentage,
      completed: filledFields.length,
      total: fields.length
    };
  }, [profileData]);

  // Xử lý chọn ảnh
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditData({ ...editData, avatar: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditClick = () => {
    setEditData({ ...profileData });
    setIsEditing(true);
  };

  const handleSave = () => {
    setProfileData({ ...editData });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({ ...profileData }); // Reset về dữ liệu cũ
    setIsEditing(false);
  };

  const handleChange = (e) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center gap-6">
      {/* Avatar Section */}
      <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-100 bg-gradient-to-br from-[#2D1B4E] to-[#4A3B7A] flex items-center justify-center">
            {(isEditing ? editData.avatar : profileData.avatar) &&
            (isEditing ? editData.avatar : profileData.avatar) !==
              "https://via.placeholder.com/150" ? (
              <img
                src={isEditing ? editData.avatar : profileData.avatar}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white text-3xl font-bold">
                {profileData.fullName
                  ? profileData.fullName
                      .split(" ")
                      .map((word) => word.charAt(0).toUpperCase())
                      .join("")
                      .slice(0, 2)
                  : "U"}
              </span>
            )}
          </div>

          {/* Chỉ hiện khi đang Edit */}
          {isEditing && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 bg-[#2D1B4E] rounded-full border-2 border-white shadow-sm flex items-center justify-center hover:bg-opacity-90 transition"
            >
              <span className="material-symbols-outlined text-white text-[18px]">
                photo_camera
              </span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

      {/* Info Section */}
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">{profileData.fullName}</h1>
          {/* Bổ sung Badge trạng thái */}
          <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-100">
            Active
          </span>
        </div>

        {/* Bổ sung Email và Vai trò */}
        <p className="text-gray-500 text-sm mb-2">{profileData.email}</p>
        {/* Nút hành động */}
        <div className="flex gap-3">
          <button
            onClick={handleEditClick}
            className="px-4 py-1.5 bg-[#2D1B4E] text-white text-sm font-bold rounded-lg hover:bg-opacity-90 shadow-sm"
          >
            Edit Profile
          </button>
        </div>
      </div>
    </div>
      {/* Main Content Layout */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

  {/* LEFT COLUMN */}
  <div className="lg:col-span-2 space-y-6">

    {/* PERSONAL INFORMATION */}
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Personal Information
        </h2>
      </div>

      {isEditing ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={editData.fullName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2D1B4E]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                name="username"
                value={editData.username}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2D1B4E]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <input
                type="text"
                name="role"
                value={editData.role}
                onChange={handleChange}
                readOnly
                className="w-full px-3 text-gray-600 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2D1B4E]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Status
              </label>
              <input
                type="text"
                name="accountStatus"
                value={editData.accountStatus}
                onChange={handleChange}
                readOnly
                className="w-full text-gray-600 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2D1B4E]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={editData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2D1B4E]"
              />
            </div>

          </div>
        </>
      ) : (
        <div className="space-y-6">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <p className="text-sm text-gray-900 font-medium">Full Name</p>
              <p className="text-gray-500 mt-0.5">{profileData.fullName}</p>
            </div>

            <div>
              <p className="text-sm text-gray-900 font-medium">Username</p>
              <p className="text-gray-500 mt-0.5">{profileData.username}</p>
            </div>

            <div>
              <p className="text-sm text-gray-900 font-medium">Role</p>
              <p className="text-gray-500 mt-0.5">{profileData.role}</p>
            </div>

            <div>
              <p className="text-sm text-gray-900 font-medium">
                Account Status
              </p>

              <div className="mt-1">
                <span className="px-2.5 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                  {profileData.accountStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100"></div>

          <div>
            <p className="text-sm text-gray-900 font-medium">
              Contact Information
            </p>

            <p className="text-gray-500 mt-1.5">
              {profileData.email}
            </p>
          </div>

        </div>
      )}

    </div>

    {/* CHANGE PASSWORD */}
    {isEditing && (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <ChangePasswordSection />
      </div>
    )}
    {isEditing && (
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#2D1B4E] text-white rounded-lg hover:bg-opacity-90 font-bold"
          >
            Save Changes
          </button>
        </div>
      )}

  </div>

  {/* RIGHT COLUMN */}
  <div className="space-y-6">

    {/* Profile Completion */}
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Profile Completion
      </h2>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">
            {profileCompletion.percentage}% Complete
          </span>

          <span className="text-gray-600">
            {profileCompletion.completed}/{profileCompletion.total} Steps
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-[#2D1B4E] h-2 rounded-full"
            style={{ width: `${profileCompletion.percentage}%` }}
          />
        </div>
      </div>
    </div>

    {/* System Logs */}
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        System Logs
      </h2>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Created Date</span>
          <span className="font-medium">Oct 12, 2023</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Last Login</span>
          <span className="font-medium">Today, 09:30 AM</span>
        </div>
      </div>
    </div>

  </div>

</div>
      </div>
  );
}
