import React, { useState, useEffect } from 'react';

const AvatarDropdown = ({ currentRole, onClose, onProfileClick, onSettingsClick, onLogoutClick}) => {
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  // Re-initialize Lucide icons when submenu expands
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [isSettingsExpanded]);

  return (
    <div className="w-64 bg-white rounded-xl shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)] border border-gray-200 overflow-hidden animate-in fade-in zoom-in duration-200">
      {/* User Info Section */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-indigo-100 text-[#2D1B4E] flex items-center justify-center font-bold text-lg border border-indigo-200">
          {currentRole === "ADMIN" ? "AR" : "TN"}
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-sm font-bold truncate text-gray-900">
            {currentRole === "ADMIN" ? "Alex Rivera" : "Trang Nguyễn"}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {currentRole === "ADMIN" ? "alex.rivera@taskcore.com" : "trang.nguyen@taskcore.com"}
          </p>
        </div>
      </div>

      <div className="border-t border-gray-100"></div>

      {/* Menu Options */}
      <div className="p-2">
        <button onClick={onProfileClick} className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-sm">
          <i className="w-4 h-4 text-gray-400" data-lucide="user"></i>
          <span>Profile</span>
        </button>
        <div>
          <button onClick={onSettingsClick} className="w-full flex items-center justify-between gap-3 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-sm">
            <div className="flex items-center gap-3">
              <i className="w-4 h-4 text-gray-400" data-lucide="settings"></i>
              <span>Settings</span>
            </div>
          </button>
        </div>
      </div>

      <div className="border-t border-gray-100"></div>

      {/* Logout */}
      <div className="p-2">
        <button onClick={onLogoutClick} className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium">
          <i className="w-4 h-4" data-lucide="log-out"></i>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default AvatarDropdown;