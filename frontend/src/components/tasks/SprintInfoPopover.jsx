import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/SprintInfoPopover.css';

const SprintInfoPopover = ({
  isOpen,
  onClose,
  anchorRef,
  sprintName = 'SCRUM Sprint',
  sprintDateRange = '',
  startDate = '',
  endDate = '',
  daysLeftLabel = '',
  progressPercent = 0,
  completedTasksCount = 0,
  openTasksCount = 0,
}) => {
  const popoverRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current || !popoverRef.current) return undefined;

    let rafId = 0;

    const updatePosition = () => {
      const anchorRect = anchorRef.current?.getBoundingClientRect();
      const popoverRect = popoverRef.current?.getBoundingClientRect();
      if (!anchorRect || !popoverRect) return;

      const padding = 8;
      const viewportWidth = window.visualViewport?.width || window.innerWidth;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;

      let top = anchorRect.bottom + 8;
      if (top + popoverRect.height + padding > viewportHeight) {
        top = anchorRect.top - popoverRect.height - 8;
      }
      top = Math.max(padding, Math.min(top, viewportHeight - popoverRect.height - padding));

      let left = anchorRect.right - popoverRect.width;
      left = Math.max(padding, Math.min(left, viewportWidth - popoverRect.width - padding));

      setCoords({ top, left });
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(updatePosition);
    };

    scheduleUpdate();

    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);
    window.visualViewport?.addEventListener('resize', scheduleUpdate);
    window.visualViewport?.addEventListener('scroll', scheduleUpdate);

    const anchorObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleUpdate)
      : null;
    const popoverObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleUpdate)
      : null;

    if (anchorObserver && anchorRef.current) {
      anchorObserver.observe(anchorRef.current);
    }
    if (popoverObserver && popoverRef.current) {
      popoverObserver.observe(popoverRef.current);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
      window.visualViewport?.removeEventListener('resize', scheduleUpdate);
      window.visualViewport?.removeEventListener('scroll', scheduleUpdate);
      anchorObserver?.disconnect();
      popoverObserver?.disconnect();
    };
  }, [isOpen, anchorRef, completedTasksCount, openTasksCount]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !anchorRef.current) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="sprint-info-popover fixed bg-white border border-outline-variant shadow-2xl rounded-xl p-5 w-64 animate-in fade-in slide-in-from-top-2 duration-200"
      style={{ '--sprint-popover-top': `${coords.top}px`, '--sprint-popover-left': `${coords.left}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-bold text-on-surface">{sprintName}</h3>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-orange-600 font-medium">{daysLeftLabel}</span>
            <div className="flex-1 h-1 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-orange-500" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
            </div>
          </div>
        </div>

        <div className="sprint-info-popover__dates grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-outline font-bold uppercase">Start date</span>
            <span className="text-[12px] text-on-surface">{startDate || sprintDateRange.split(' - ')[0] || ''}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-outline font-bold uppercase">End date</span>
            <span className="text-[12px] text-on-surface">{endDate || sprintDateRange.split(' - ')[1] || ''}</span>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-lg p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-on-surface-variant">Completed issues</span>
            <span className="text-[11px] font-bold text-green-700">{completedTasksCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-on-surface-variant">Open issues</span>
            <span className="text-[11px] font-bold text-orange-700">{openTasksCount}</span>
          </div>
        </div>
      </div>

      <div className="absolute -top-1.5 right-4 w-3 h-3 bg-white border-l border-t border-outline-variant rotate-45" />
    </div>,
    document.body
  );
};

export default SprintInfoPopover;
