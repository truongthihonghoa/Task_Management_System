import React, { useState, useEffect } from "react";

import ProfileTab from "../components/profile/ProfileTab";
export default function Profile() {
  const [activeTab, setActiveTab] = useState("profile");

  // Tự động kích hoạt Lucide Icons khi component mount hoặc khi đổi tab
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [activeTab]);

  return (
    <main className="ml-3 pt-4 min-h-screen p-8 max-w-[1440px]">
      {/* Internal Tab Navigation */}
      <div className="flex gap-6 border-b border-gray-200 mt-4 ml-[10px]">
        {/* Profile Tab */}
        <button
          onClick={() => setActiveTab("profile")}
          className={`tab-btn flex items-center gap-2 pb-3 border-b-2 transition-all ${
            activeTab === "profile"
              ? "border-[#5e4db2] text-[#5e4db2] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <i className="w-4 h-4" data-lucide="user"></i>
          Profile
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === "profile" && <ProfileTab />}
      </div>
    </main>
  );
}