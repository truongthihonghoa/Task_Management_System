import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const GuideItem = ({ icon, title, desc, onClick }) => (
  <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-[#EADFF9] flex items-center justify-center text-[#2D1B4E]">
        <i className="w-6 h-6" data-lucide={icon}></i>
      </div>
      <div>
        <h4 className="text-base font-bold text-gray-900">{title}</h4>
        <p className="text-xs text-gray-600">{desc}</p>
      </div>
    </div>

    <button
      onClick={onClick}
      className="px-4 py-2 border border-[#2D1B4E] text-[#2D1B4E] hover:bg-[#2D1B4E] hover:text-white rounded-lg text-sm font-medium transition-colors"
    >
      Read Guide
    </button>
  </div>
);

const GuideSection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const guides = [
    {
      icon: 'sparkles',
      title: 'Getting Started',
      desc: 'A comprehensive 5-minute walk-through.',
      slug: 'getting-started',
    },
    {
      icon: 'users',
      title: 'User Permissions',
      desc: 'How to manage roles and groups.',
      slug: 'user-permissions',
    },
    {
      icon: 'layout-dashboard',
      title: 'Dashboard Overview',
      desc: 'Understanding your workspace.',
      slug: 'dashboard-overview',
    },
    {
      icon: 'clipboard-list',
      title: 'Task Management',
      desc: 'Create and manage tasks effectively.',
      slug: 'task-management',
    },
  ];

  const openGuide = (slug) => {
    navigate(`/dashboard/help/guides/${slug}${location.search}`);
  };

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">System Guides</h2>

      <div className="flex flex-col gap-3">
        {guides.map((guide) => (
          <GuideItem
            key={guide.slug}
            icon={guide.icon}
            title={guide.title}
            desc={guide.desc}
            onClick={() => openGuide(guide.slug)}
          />
        ))}
      </div>
    </section>
  );
};

export default GuideSection;
