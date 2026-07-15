import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

function getSlugFromPathname(pathname) {
  if (pathname.replace(/\/+$/, '') === '/dashboard/help-guide') {
    return 'getting-started';
  }

  // Extracts the slug from /dashboard/help/guides/:slug
  const match = pathname.match(/\/dashboard\/help\/guides\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const Breadcrumb = ({ title, onBack }) => (
  <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
    <button
      onClick={onBack}
      className="hover:text-[#4C2B74] transition-colors font-medium"
    >
      Help Center
    </button>
    <i className="w-4 h-4" data-lucide="chevron-right"></i>
    <span className="text-gray-900 font-semibold truncate">{title}</span>
  </nav>
);

const ReadingTimeBadge = ({ time }) => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EADFF9] text-[#2D1B4E] rounded-full text-xs font-semibold">
    <i className="w-3.5 h-3.5" data-lucide="clock"></i>
    {time}
  </span>
);

const TableOfContents = ({ items, activeId, onSelect }) => (
  <nav className="space-y-1">
    <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">
      On this page
    </p>
    {items.map((item) => (
      <button
        key={item.id}
        onClick={() => onSelect(item.id)}
        className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors font-medium ${
          activeId === item.id
            ? 'bg-[#EADFF9] text-[#2D1B4E]'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        {item.title}
      </button>
    ))}
  </nav>
);

const StepList = ({ steps }) => (
  <ol className="mt-4 space-y-4">
    {steps.map((step) => (
      <li key={step.step} className="flex gap-4">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#2D1B4E] text-white flex items-center justify-center text-xs font-black">
          {step.step}
        </div>
        <div className="flex-1 pt-0.5">
          <p className="text-sm font-bold text-gray-900">{step.title}</p>
          <p className="text-sm text-gray-600 mt-1">{step.description}</p>
        </div>
      </li>
    ))}
  </ol>
);

const TipBox = ({ tip }) => (
  <div className="mt-4 flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
    <i className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" data-lucide="lightbulb"></i>
    <p className="text-sm text-amber-800">{tip}</p>
  </div>
);

const GuideContentSection = ({ section }) => (
  <section id={section.id} className="scroll-mt-24">
    <h2 className="text-xl font-bold text-gray-900 mb-3">{section.title}</h2>
    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
      {section.content}
    </div>
    {section.steps && section.steps.length > 0 && (
      <StepList steps={section.steps} />
    )}
    {section.tip && <TipBox tip={section.tip} />}
  </section>
);

const TipsPracticesPanel = ({ tips }) => {
  if (!tips || tips.length === 0) return null;
  return (
    <div className="bg-[#F6F7FF] border border-[#E0E8FF] rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <i className="w-5 h-5 text-[#4C2B74]" data-lucide="zap"></i>
        <h3 className="text-base font-bold text-[#2D1B4E]">Tips &amp; Best Practices</h3>
      </div>
      <ul className="space-y-3">
        {tips.map((tip, index) => (
          <li key={index} className="flex gap-3">
            <i className="w-4 h-4 text-[#4C2B74] flex-shrink-0 mt-0.5" data-lucide="check-circle-2"></i>
            <p className="text-sm text-gray-700">{tip}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

const RelatedGuideCard = ({ guide, onNavigate }) => (
  <button
    onClick={() => onNavigate(guide.slug)}
    className="flex-1 min-w-[220px] text-left p-5 bg-white border border-gray-200 rounded-xl hover:border-[#4C2B74] hover:shadow-sm transition-all group"
  >
    <div className="flex items-start justify-between gap-2">
      <p className="text-sm font-bold text-gray-900 group-hover:text-[#4C2B74] transition-colors">
        {guide.title}
      </p>
      <i className="w-4 h-4 text-gray-400 group-hover:text-[#4C2B74] flex-shrink-0 mt-0.5 transition-colors" data-lucide="arrow-right"></i>
    </div>
    <p className="text-xs text-gray-500 mt-1">{guide.description}</p>
  </button>
);

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

const LoadingSkeleton = () => (
  <div className="p-6 animate-pulse">
    <div className="h-4 w-48 bg-gray-200 rounded mb-6"></div>
    <div className="flex gap-8">
      <div className="flex-1 space-y-6">
        <div className="space-y-3">
          <div className="h-8 w-3/4 bg-gray-200 rounded"></div>
          <div className="h-4 w-24 bg-gray-200 rounded-full"></div>
          <div className="h-4 w-full bg-gray-200 rounded"></div>
          <div className="h-4 w-5/6 bg-gray-200 rounded"></div>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-6 w-1/2 bg-gray-200 rounded"></div>
            <div className="h-4 w-full bg-gray-200 rounded"></div>
            <div className="h-4 w-4/5 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
      <div className="hidden lg:block w-56 space-y-2">
        <div className="h-3 w-20 bg-gray-200 rounded mb-4"></div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 bg-gray-200 rounded-lg"></div>
        ))}
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

const ErrorState = ({ message, onBack }) => (
  <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
    <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
      <i className="w-8 h-8 text-red-400" data-lucide="file-x"></i>
    </div>
    <h2 className="text-lg font-bold text-gray-900 mb-2">Guide Not Found</h2>
    <p className="text-sm text-gray-500 max-w-sm mb-6">{message}</p>
    <button
      onClick={onBack}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2D1B4E] text-white rounded-lg text-sm font-semibold hover:bg-opacity-90 transition-colors"
    >
      <i className="w-4 h-4" data-lucide="arrow-left"></i>
      Back to Help Center
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// Main HelpGuide page
// ---------------------------------------------------------------------------

const HelpGuide = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const slug = getSlugFromPathname(location.pathname);

  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('');

  // Navigate back to Help Center preserving query string
  const handleBack = () => {
    navigate(`/dashboard/help${location.search}`);
  };

  // Navigate to a related guide preserving query string
  const handleRelatedGuide = (targetSlug) => {
    navigate(`/dashboard/help/guides/${targetSlug}${location.search}`);
  };

  // Scroll to a section by id
  const handleTocSelect = (id) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Fetch guide content from backend API
  useEffect(() => {
    if (!slug) {
      setError('No guide identifier found in the URL.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`${API_BASE_URL}/help/guides/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(
              `The guide "${slug}" could not be found. It may have been moved or the URL is incorrect.`
            );
          }
          throw new Error(`Failed to load guide (HTTP ${res.status}). Please try again later.`);
        }
        return res.json();
      })
      .then((data) => {
        setGuide(data);
        if (data.table_of_contents && data.table_of_contents.length > 0) {
          setActiveSection(data.table_of_contents[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug]);

  // Activate Lucide icons from CDN after every render that changes visible content
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [guide, loading, error]);

  // Intersection Observer to highlight the active ToC item while scrolling
  useEffect(() => {
    if (!guide) return;

    const sectionIds = guide.table_of_contents.map((item) => item.id);
    const observers = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        { rootMargin: '-20% 0px -70% 0px' }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((obs) => obs.disconnect());
  }, [guide]);

  // -------------------------------------------------------------------------
  // Render states
  // -------------------------------------------------------------------------

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return <ErrorState message={error} onBack={handleBack} />;
  }

  if (!guide) return null;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Breadcrumb */}
      <Breadcrumb title={guide.title} onBack={handleBack} />

      <div className="flex flex-col lg:flex-row gap-8">

        {/* ------------------------------------------------------------------ */}
        {/* Main content column */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex-1 min-w-0">

          {/* Guide header */}
          <div className="mb-8 pb-6 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#EADFF9] flex items-center justify-center text-[#2D1B4E]">
                <i className="w-5 h-5" data-lucide="book-open"></i>
              </div>
              <ReadingTimeBadge time={guide.estimated_read_time} />
            </div>
            <h1 className="text-2xl font-bold text-[#4C2B74] mb-3">{guide.title}</h1>
            <p className="text-sm text-gray-600 leading-relaxed">{guide.introduction}</p>
          </div>

          {/* Table of Contents — visible on mobile only (inline) */}
          <div className="lg:hidden mb-8 p-4 bg-[#F6F7FF] border border-[#E0E8FF] rounded-xl">
            <TableOfContents
              items={guide.table_of_contents}
              activeId={activeSection}
              onSelect={handleTocSelect}
            />
          </div>

          {/* Guide sections */}
          <div className="space-y-10">
            {guide.sections.map((section) => (
              <GuideContentSection key={section.id} section={section} />
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-10"></div>

          {/* Tips & Best Practices */}
          <TipsPracticesPanel tips={guide.tips} />

          {/* Related Guides */}
          {guide.related_guides && guide.related_guides.length > 0 && (
            <div className="mt-10">
              <h3 className="text-base font-bold text-gray-900 mb-4">Related Guides</h3>
              <div className="flex flex-wrap gap-4">
                {guide.related_guides.map((related) => (
                  <RelatedGuideCard
                    key={related.slug}
                    guide={related}
                    onNavigate={handleRelatedGuide}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Back to Help Center button */}
          <div className="mt-10 pt-6 border-t border-gray-200">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#2D1B4E] text-[#2D1B4E] hover:bg-[#2D1B4E] hover:text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <i className="w-4 h-4" data-lucide="arrow-left"></i>
              Back to Help Center
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Sticky sidebar — Table of Contents (desktop only) */}
        {/* ------------------------------------------------------------------ */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <TableOfContents
              items={guide.table_of_contents}
              activeId={activeSection}
              onSelect={handleTocSelect}
            />
          </div>
        </aside>

      </div>
    </div>
  );
};

export default HelpGuide;
