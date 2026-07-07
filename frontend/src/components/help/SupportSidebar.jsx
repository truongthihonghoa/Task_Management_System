import React from 'react';

const SupportSidebar = () => (
  <div className="sticky top-[80px] space-y-4">
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
  <h3 className="font-bold text-gray-900 mb-6">Need More Help?</h3>

  <div className="space-y-6">
    {/* Email Section */}
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined text-gray-500 mt-0.5">support_agent</span>
      <div>
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Administrator Email</p>
        <p className="text-sm font-semibold text-gray-900">alex.morgan@taskcore.com</p>
      </div>
    </div>

    {/* Office Hours Section */}
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined text-gray-500 mt-0.5">schedule</span>
      <div>
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Office Hours</p>
        <p className="text-sm font-semibold text-gray-900">Mon-Fri, 08:00 AM - 05:00 PM</p>
      </div>
    </div>

    {/* Support Status Section */}
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined text-gray-500 mt-0.5">language</span>
      <div>
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Support Status</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <p className="text-sm font-bold text-green-700">Online Support Active</p>
        </div>
      </div>
    </div>
  </div>

  <button className="w-full mt-8 bg-[#4C2B74] text-white py-3 rounded-lg flex items-center justify-center text-sm font-semibold hover:bg-opacity-90 transition-all shadow-sm">
    <span className="material-symbols-outlined mr-2 text-lg">help</span>
    Contact Administrator
  </button>
</div>
  </div>
);

export default SupportSidebar;