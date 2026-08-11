import React, { useEffect } from 'react';
import AIChatSection from '../components/help/AIChatSection';
import GuideSection from '../components/help/GuideSection';

const HelpCenter = () => {
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, []);

  return (
    <div className="px-6 pt-4 pb-6 md:px-8 md:pt-5 md:pb-8">
      {/* Header Section */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-[#4C2B74] mb-1">Help Center</h1>
        <p className="text-sm text-gray-500">Find answers, browse documentation, or ask the AI Assistant for instant help.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-[90%] space-y-6">
          <AIChatSection />
          <GuideSection />
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
