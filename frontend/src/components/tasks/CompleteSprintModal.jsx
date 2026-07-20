import React from 'react';
import { createPortal } from 'react-dom';

const CompleteSprintModal = ({ isOpen, onClose, sprintName, completedTasksCount, openTasksCount }) => {
  if (!isOpen) return null;

  const hasOpenIssues = openTasksCount > 0;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <h2 className="text-base font-bold text-on-surface">Complete {sprintName}</h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-surface-container rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] text-outline">close</span>
          </button>
        </div>
        
        <div className="p-6">
          <div className="flex flex-col gap-4 text-[13px] text-on-surface-variant leading-relaxed">
            <p>This sprint can only be completed when every issue is marked as Done.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg flex flex-col items-center">
                <span className="text-2xl font-bold text-green-700">{completedTasksCount}</span>
                <span className="text-[11px] font-medium text-green-600 uppercase tracking-wider">Completed</span>
              </div>
              <div className={`${hasOpenIssues ? 'bg-orange-50 border-orange-100' : 'bg-white border-slate-300'} border p-4 rounded-lg flex flex-col items-center`}>
                <span className={`text-2xl font-bold ${hasOpenIssues ? 'text-orange-700' : 'text-slate-700'}`}>{openTasksCount}</span>
                <span className={`text-[11px] font-medium uppercase tracking-wider ${hasOpenIssues ? 'text-orange-600' : 'text-slate-600'}`}>Open issues</span>
              </div>
            </div>

            {hasOpenIssues ? (
              <div className="rounded-lg border border-orange-100 bg-orange-50 px-4 py-3 text-orange-800">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-[20px] leading-none text-orange-600">error</span>
                  <div>
                    <p className="font-bold text-orange-900">Sprint cannot be completed yet.</p>
                    <p className="mt-1 text-[12px] leading-relaxed">
                      Move all open issues to Done before completing this sprint.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-[20px] leading-none text-slate-600">check_circle</span>
                  <div>
                    <p className="font-bold text-slate-800">Ready to complete.</p>
                    <p className="mt-1 text-[12px] leading-relaxed">
                      All issues are Done. Completing this sprint will mark it as Completed.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="px-6 py-4 bg-surface-container-low/50 border-t border-outline-variant flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-bold text-outline hover:bg-surface-container rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              if (!hasOpenIssues) {
                onClose();
              }
            }}
            disabled={hasOpenIssues}
            className={`px-5 py-2 text-[13px] font-bold rounded-lg shadow-md transition-all active:scale-95 ${
              hasOpenIssues
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed shadow-none'
                : 'bg-[#5e4db2] text-white hover:bg-[#4d3e9c]'
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
