import React from 'react';
import { createPortal } from 'react-dom';
import '../../styles/CompleteSprintModal.css';

const CompleteSprintModal = ({ isOpen, onClose, sprintName, completedTasksCount, openTasksCount, onComplete }) => {
  if (!isOpen) return null;

  const hasOpenIssues = openTasksCount > 0;

  return createPortal(
    <div className="complete-sprint-modal fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      <div className="complete-sprint-modal__panel relative bg-white w-full max-w-[560px] rounded-2xl shadow-[0_18px_60px_rgba(17,24,39,0.22)] overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="complete-sprint-modal__header px-8 py-5 border-b border-[#D9D6EA] flex items-center justify-between bg-white">
          <h2 className="complete-sprint-modal__title text-base font-bold text-on-surface">Complete {sprintName}</h2>
          <button 
            onClick={onClose}
            type="button"
            aria-label="Close dialog"
            className="complete-sprint-modal__close"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div className="complete-sprint-modal__body px-8 py-7">
          <div className="complete-sprint-modal__content flex flex-col gap-5 text-[13px] text-on-surface-variant leading-relaxed">
            <p>This sprint can only be completed when every issue is marked as Done or Cancelled.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="complete-sprint-modal__stat complete-sprint-modal__stat--success">
                <span className="complete-sprint-modal__stat-number">{completedTasksCount}</span>
                <span className="complete-sprint-modal__stat-label">Completed</span>
              </div>
              <div className={`complete-sprint-modal__stat ${hasOpenIssues ? 'complete-sprint-modal__stat--warning' : 'complete-sprint-modal__stat--neutral'}`}>
                <span className="complete-sprint-modal__stat-number">{openTasksCount}</span>
                <span className="complete-sprint-modal__stat-label">Open issues</span>
              </div>
            </div>

            {hasOpenIssues ? (
              <div className="complete-sprint-modal__notice complete-sprint-modal__notice--warning">
                <div className="complete-sprint-modal__notice-row">
                  <span className="complete-sprint-modal__notice-icon complete-sprint-modal__notice-icon--warning" aria-hidden="true">
                    !
                  </span>
                  <div className="complete-sprint-modal__notice-copy">
                    <p className="complete-sprint-modal__notice-title complete-sprint-modal__notice-title--warning">Sprint cannot be completed yet.</p>
                    <p className="complete-sprint-modal__notice-body complete-sprint-modal__notice-body--warning">
                      Move all open issues to Done or Cancelled before completing this sprint.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="complete-sprint-modal__notice complete-sprint-modal__notice--neutral">
                <div className="complete-sprint-modal__notice-row">
                  <span className="complete-sprint-modal__notice-icon complete-sprint-modal__notice-icon--neutral" aria-hidden="true">
                    &#10003;
                  </span>
                  <div className="complete-sprint-modal__notice-copy">
                    <p className="complete-sprint-modal__notice-title complete-sprint-modal__notice-title--neutral">Ready to complete.</p>
                    <p className="complete-sprint-modal__notice-body complete-sprint-modal__notice-body--neutral">
                      All issues are Done or Cancelled. Completing this sprint will mark it as Completed.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="complete-sprint-modal__footer px-8 py-4 bg-white border-t border-[#D9D6EA] flex justify-end gap-4">
          <button 
            onClick={onClose}
            type="button"
            className="complete-sprint-modal__cancel"
          >
            Cancel
          </button>
          <button 
            onClick={async () => {
              if (!hasOpenIssues) {
                await onComplete?.();
              }
            }}
            disabled={hasOpenIssues}
            className={`complete-sprint-modal__confirm ${
              hasOpenIssues
                ? 'is-disabled'
                : 'is-enabled'
            }`}
          >
            Complete Sprint
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CompleteSprintModal;
