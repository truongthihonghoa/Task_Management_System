import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getHelpGuides } from '../../api/helpApi';
import {
  Sparkles,
  Users,
  LayoutDashboard,
  Clipboard,
  BookOpen,
} from "lucide-react";

const GUIDE_ICONS = {
  'getting-started': Sparkles,
  'user-permissions': Users,
  'dashboard-overview': LayoutDashboard,
  'task-management': Clipboard,
};

const GuideItem = ({ Icon, title, desc, onClick }) => (
  <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-[#EADFF9] flex items-center justify-center text-[#2D1B4E]">
        <Icon className="w-6 h-6 text-[#2D1B4E]" />
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
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const openGuide = (slug) => {
    navigate(`/dashboard/help/guides/${slug}${location.search}`);
  };

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');

    getHelpGuides()
      .then((data) => {
        if (cancelled) return;
        setGuides(Array.isArray(data?.guides) ? data.guides : []);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load help guides.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">System Guides</h2>

      <div className="flex flex-col gap-3">
        {loading && (
          [1, 2, 3, 4].map((item) => (
            <div key={item} className="h-20 bg-gray-100 border border-gray-200 rounded-xl animate-pulse" />
          ))
        )}

        {!loading && error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && guides.length === 0 && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
            No help guides are available.
          </div>
        )}

        {guides.map((guide) => {
        const Icon = GUIDE_ICONS[guide.slug] || BookOpen;

        return (
          <GuideItem
            key={guide.slug}
            Icon={Icon}
            title={guide.title}
            desc={guide.description}
            onClick={() => openGuide(guide.slug)}
          />
        );
      })}
      </div>
    </section>
  );
};

export default GuideSection;
