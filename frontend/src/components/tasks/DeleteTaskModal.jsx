import React from 'react';
import { createPortal } from 'react-dom';

const DeleteTaskModal = ({ isOpen, onClose, onConfirm, task }) => {
  if (!isOpen || !task) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity cursor-pointer" 
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-[480px] rounded-[8px] shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-4">
            {/* Warning Icon Container */}
            <div className="bg-red-100 p-3 rounded-full" data-purpose="status-icon">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800">Delete Task</h2>
          </div>
          {/* Close Button */}
          <button 
            type="button"
            className="text-slate-400 hover:text-slate-600 transition-colors -mt-1 focus:outline-none"
            onClick={onClose}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="px-6 pb-6 space-y-4">
          <p className="text-slate-600 text-sm font-medium">Are you sure you want to delete this task?</p>
          
          {/* Task Details Box */}
          <div className="bg-blue-50/50 rounded-[8px] p-3 text-sm" data-purpose="task-details-preview">
            <div className="grid grid-cols-[80px_1fr] gap-y-1">
              <span className="text-slate-500">Task ID:</span>
              <span className="text-slate-700 font-medium">{task.id}</span>
              <span className="text-slate-500">Title:</span>
              <span className="text-slate-700 font-medium">{task.title}</span>
            </div>
          </div>

          {/* Warning Alert Box */}
          <div className="bg-red-50 border border-red-100 rounded-[8px] p-3 flex gap-3" data-purpose="impact-warning">
            <svg className="h-5 w-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs leading-relaxed text-red-800">
              This task will be removed from the active task list. Associated comments, attachments, and task history will be preserved in the system.
            </p>
          </div>

          {/* Informational text */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Deleted tasks can be restored by administrators if needed.</span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-blue-50/30 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-semibold text-sm rounded-[8px] hover:bg-slate-50 transition-colors shadow-sm focus:outline-none"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={() => onConfirm(task.id)}
            className="px-6 py-2.5 bg-red-700 text-white font-semibold text-sm rounded-[8px] hover:bg-red-800 transition-colors shadow-sm flex items-center gap-2 focus:outline-none"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Task
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DeleteTaskModal;