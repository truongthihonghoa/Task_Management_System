import React, { useEffect } from 'react';
import AIChatSection from '../components/help/AIChatSection';
import GuideSection from '../components/help/GuideSection';
import FAQSection from '../components/help/FAQSection';
import SupportSidebar from '../components/help/SupportSidebar';

const HelpCenter = () => {
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, []);

  return (
    <div className="p-6">
      {/* Header Section */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-[#4C2B74] mb-1">Help Center</h1>
        <p className="text-gray-500 text-sm">Find answers, browse documentation, or ask the AI Assistant for instant help.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-[70%] space-y-6">
          <AIChatSection />
          <GuideSection />
          <FAQSection />
        </div>
        <aside className="w-full lg:w-[30%]">
          <SupportSidebar />
        </aside>
      </div>
    </div>
  );
};

export default HelpCenter;
