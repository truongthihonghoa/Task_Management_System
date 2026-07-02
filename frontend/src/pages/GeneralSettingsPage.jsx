import React, { useState } from 'react';

const GeneralSettingsPage = () => {
  const [theme, setTheme] = useState('light');
  const [timezone, setTimezone] = useState('(UTC+07:00) Asia/Ho_Chi_Minh');
  const [language, setLanguage] = useState('English (US)');
  const [defaultPage, setDefaultPage] = useState('Dashboard');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-[#4C2B74]">General Settings</h1>
      <p className="text-sm text-gray-500">Customize your application appearance, timezone, language, and default preferences.</p>

      <div className="mt-6 bg-white p-6 rounded-lg shadow">
        {/* Appearance Section */}
        <div className="flex items-center space-x-3">
          <i className="w-5 h-5 font-bold" data-lucide="sun"></i>
          <h2 className="text-lg font-semibold text-gray-800">Appearance</h2>
        </div>
        <p className="mt-1 text-sm font-medium text-gray-500">Theme Preference</p>
        <div className="mt-4 grid grid-cols-2 gap-10">
          {/* Light Theme */}
            <label className="flex flex-col items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-colors duration-200
              border-gray-200
              has-[:checked]:border-gray-900
              has-[:checked]:ring-1
              has-[:checked]:ring-[#2D1B4E]">
              <input
                type="radio"
                name="theme"
                value="light"
                className="sr-only"
                checked={theme === 'light'}
                onChange={() => setTheme('light')}
              />
              <div className="w-full h-24 bg-white border border-gray-300 rounded-md flex items-center justify-center">
                <i className="w-8 h-8 text-gray-700" data-lucide="sun"></i>
              </div>
              <span className="mt-2 text-sm font-medium text-gray-700">Light</span>
            </label>

            {/* Dark Theme */}
            <label className="flex flex-col items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-colors duration-200
              border-gray-200
              has-[:checked]:border-gray-900
              has-[:checked]:ring-1
              has-[:checked]:ring-[#2D1B4E]">
              <input
                type="radio"
                name="theme"
                value="dark"
                className="sr-only"
                checked={theme === 'dark'}
                onChange={() => setTheme('dark')}
              />
              <div className="w-full h-24 bg-gray-900 border border-gray-700 rounded-md flex items-center justify-center">
                <i className="w-8 h-8 text-gray-200" data-lucide="moon"></i>
              </div>
              <span className="mt-2 text-sm font-medium text-gray-700">Dark</span>
            </label>
        </div>
      </div>

      {/* Regional Settings Section */}
        <div className="mt-6 bg-white p-6 rounded-lg shadow">
          <div className="flex items-center space-x-3">
            <i className="w-5 h-5 font-bold " data-lucide="globe"></i>
            <h2 className="text-lg font-semibold text-gray-800">Regional Settings</h2>
          </div>

          <div className="mt-4 space-y-6">
            {/* Timezone - Hiển thị tĩnh */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
              <div className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-600 text-[15px]">
                {timezone}
              </div>
              <p className="mt-2 text-xs font-medium text-[#5e4db2] italic">
                To change your timezone, please go to the Preferences tab within your Profile settings.
              </p>
            </div>

            {/* Language - Hiển thị tĩnh */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
              <div className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-600 text-[15px]">
                {language}
              </div>
              <p className="mt-2 text-xs font-medium text-[#5e4db2] italic">
                To change your language, please go to the Preferences tab within your Profile settings.
              </p>
            </div>
          </div>
        </div>

      {/* Default Page Section */}
      <div className="mt-6 bg-white p-6 rounded-lg shadow">
        <div className="flex items-center space-x-3">
          <i className="w-5 h-5 font-bold" data-lucide="home"></i>
          <h2 className="text-lg font-semibold text-gray-800">Default Page After Login</h2>
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-4">Homepage Destination</label>
          <select 
            value={defaultPage}
            onChange={(e) => setDefaultPage(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option>Dashboard</option>
            <option>Spaces</option>
            <option>Tasks</option>
            <option>Notifications</option>
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex justify-end gap-3">
        <button className="px-5 py-2 text-[16px] font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors">
          Discard Changes
        </button>
        <button className="bg-[#2D1B4E] text-white px-4 py-2 rounded-lg flex items-center text-[15[px] font-semibold hover:bg-opacity-90 transition-all font-['Inter']">
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default GeneralSettingsPage;
