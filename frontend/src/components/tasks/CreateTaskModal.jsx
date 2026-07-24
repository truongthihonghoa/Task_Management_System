import React, { useState, useEffect, useRef } from 'react';
import '../../styles/CreateTaskModal.css';
import RichTextEditor from '../tasks/RichTextEditor';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const parseDateValue = (value) => {
  if (!value) return new Date(2026, 5, 1);

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(2026, 5, 1) : date;
};

const formatDateValue = (year, month, day) => {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const isValidStoryPointsInput = (value) => {
  if (value === '') return true;
  const points = Number(value);
  return Number.isFinite(points) && points >= 0;
};

const getApiErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail || error?.response?.data?.message;
  if (Array.isArray(detail)) {
    return detail.map(item => item?.msg || String(item)).join(', ') || fallback;
  }
  return detail || error?.message || fallback;
};

const getInitialFormData = (spaceName = 'Task Management') => ({
  space: spaceName,
  status: 'New',
  summary: '',
  description: '',
  assignee: 'Unassigned',
  assigneeId: '',
  priority: 'Medium',
  createdAt: formatDateValue(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()),
  completed_at: '',
  updated_at: '',
  sprint: '',
  storyPoints: '',
  comment: '',
  attachments: [],
  createAnother: false
});

function CalendarDropdown({ value, onSelect, onClose }) {
  const initialDate = parseDateValue(value);
  const [viewDate, setViewDate] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const selectedDate = value ? parseDateValue(value) : null;
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const leadingEmptyDays = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const moveCalendar = (monthDelta, yearDelta = 0) => {
    setViewDate(prev => new Date(prev.getFullYear() + yearDelta, prev.getMonth() + monthDelta, 1));
  };

  return (
    <div className="calendar-dropdown-container" onClick={(e) => e.stopPropagation()}>
      <div className="calendar-header">
        <div className="flex gap-2">
          <button type="button" className="calendar-nav-btn" onClick={() => moveCalendar(0, -1)} aria-label="Previous year">
            <i data-lucide="chevrons-left" className="w-4 h-4"></i>
          </button>
          <button type="button" className="calendar-nav-btn" onClick={() => moveCalendar(-1)} aria-label="Previous month">
            <i data-lucide="chevron-left" className="w-4 h-4"></i>
          </button>
        </div>
        <span className="font-bold text-sm">{monthNames[viewMonth]} {viewYear}</span>
        <div className="flex gap-2">
          <button type="button" className="calendar-nav-btn" onClick={() => moveCalendar(1)} aria-label="Next month">
            <i data-lucide="chevron-right" className="w-4 h-4"></i>
          </button>
          <button type="button" className="calendar-nav-btn" onClick={() => moveCalendar(0, 1)} aria-label="Next year">
            <i data-lucide="chevrons-right" className="w-4 h-4"></i>
          </button>
        </div>
      </div>
      <div className="calendar-body">
        <div className="grid grid-cols-7 text-[11px] font-bold text-gray-500 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingEmptyDays }).map((_, i) => (
            <div key={`empty-${i}`} className="calendar-day empty-day" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isSelected = selectedDate &&
              selectedDate.getFullYear() === viewYear &&
              selectedDate.getMonth() === viewMonth &&
              selectedDate.getDate() === day;

            return (
              <button
                key={day}
                type="button"
                className={`calendar-day ${isSelected ? 'selected-day' : ''}`}
                onClick={() => {
                  onSelect(formatDateValue(viewYear, viewMonth, day));
                  onClose();
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const CreateTaskModal = ({ isOpen, onClose, tasks = [], sprints = [], assignees = [], initialSprint = '', currentSpaceName = 'Task Management', onCreateTask, currentRole = 'ADMIN', currentSpaceRole = 'USER', currentUser }) => {
  const statusOptions = currentSpaceRole === 'OWNER'
    ? ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done', 'Cancelled']
    : ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done'];
  const [formData, setFormData] = useState(getInitialFormData());

  useEffect(() => {
    if (isOpen) {
      const initialData = getInitialFormData(currentSpaceName);
      if (initialSprint) {
        initialData.sprint = initialSprint;
      }
      setFormData(initialData);
      setErrors({});
      setSubmitError('');
      setIsSubmitting(false);
      setIsStatusOpen(false);
      setIsPriorityOpen(false);
      setIsAssigneeOpen(false);
      setIsCreatedAtOpen(false);
      setIsCompletedAtOpen(false);
      setIsUpdatedAtOpen(false);
      setIsSprintOpen(false);
      setOnlyShowCurrentSpace(true);
    }
  }, [isOpen, initialSprint, currentSpaceName]);

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [isCreatedAtOpen, setIsCreatedAtOpen] = useState(false);
  const [isCompletedAtOpen, setIsCompletedAtOpen] = useState(false);
  const [isUpdatedAtOpen, setIsUpdatedAtOpen] = useState(false);
  const [isSprintOpen, setIsSprintOpen] = useState(false);
  const [onlyShowCurrentSpace, setOnlyShowCurrentSpace] = useState(true);
  const currentUserId = currentUser?.id || currentUser?.user_id || null;
  const fileInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const [replaceTargetId, setReplaceTargetId] = useState(null);

  const formatFileSize = (bytes) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const createAttachmentFromFile = (file, index = 0) => {
    const isImage = file.type.startsWith('image/');
    const url = isImage ? URL.createObjectURL(file) : null;
    return {
      id: Date.now() + index,
      name: file.name,
      size: formatFileSize(file.size),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      icon: file.name.endsWith('.zip') ? 'folder_zip' : file.name.endsWith('.pdf') ? 'picture_as_pdf' : isImage ? 'image' : 'upload_file',
      color: file.name.endsWith('.zip') ? '#4C2B74' : file.name.endsWith('.pdf') ? '#DE350B' : '#4C2B74',
      bg: file.name.endsWith('.zip') ? '#EBF5FF' : file.name.endsWith('.pdf') ? '#FFF5F5' : '#EEF3FF',
      type: isImage ? 'image' : 'file',
      previewUrl: url,
      url,
      uploadedBy: currentUserId,
      file
    };
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    const newAttachments = files.map((file, index) => createAttachmentFromFile(file, index));
    setFormData(prev => ({
      ...prev,
      attachments: [...(prev.attachments || []), ...newAttachments]
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newAttachments = files.map((file, index) => createAttachmentFromFile(file, index));
    setFormData(prev => ({
      ...prev,
      attachments: [...(prev.attachments || []), ...newAttachments]
    }));
    e.target.value = '';
  };

  const triggerReplace = (id) => {
    setReplaceTargetId(id);
    replaceInputRef.current?.click();
  };

  const handleReplaceFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || replaceTargetId == null) return;
    const newAtt = createAttachmentFromFile(file);
    setFormData(prev => {
      const next = (prev.attachments || []).map(a => {
        if (a.id !== replaceTargetId) return a;
        if (a.previewUrl) {
          try { URL.revokeObjectURL(a.previewUrl); } catch (_) {}
        }
        return newAtt;
      });
      return { ...prev, attachments: next };
    });
    setReplaceTargetId(null);
    e.target.value = '';
  };

  const deleteAttachment = (id) => {
    setFormData(prev => {
      const toDelete = (prev.attachments || []).find(a => a.id === id);
      if (toDelete && toDelete.previewUrl) {
        try { URL.revokeObjectURL(toDelete.previewUrl); } catch (_) {}
      }
      const next = (prev.attachments || []).filter(a => a.id !== id);
      return { ...prev, attachments: next };
    });
  };

  const downloadAttachment = (att, e) => {
    e?.stopPropagation();
    if (!att) return;
    if (att.previewUrl) {
      try {
        const a = document.createElement('a');
        a.href = att.previewUrl;
        a.download = att.name || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (err) {
        window.open(att.previewUrl, '_blank');
      }
    }
  };

  const handleClose = () => {
    if (formData.attachments) {
      formData.attachments.forEach(att => {
        if (att.previewUrl) {
          try { URL.revokeObjectURL(att.previewUrl); } catch (_) {}
        }
      });
    }
    onClose();
  };

  const assigneeBtnRef = useRef(null);
  const assigneeMenuRef = useRef(null);

  const fallbackAssignees = [
    { name: 'Pham Tien', initials: 'PT', color: '#2f3650', textColor: '#FFFFFF' },
    { name: 'Hoang Hoa', initials: 'HH', color: '#F97316', textColor: '#FFFFFF' },
    { name: 'Trong Nghia', initials: 'TN', color: '#14B8A6', textColor: '#FFFFFF' },
    { name: 'Unassigned', initials: 'UN', color: '#8e8f90', textColor: '#FFFFFF', icon: 'person' }
  ];
  const availableAssignees = assignees.length > 0 ? assignees : fallbackAssignees;

  useEffect(() => {
    if (isOpen && window.lucide) {
      window.lucide.createIcons();
    }
  }, [isOpen, isStatusOpen, isPriorityOpen, isCreatedAtOpen, isCompletedAtOpen, isUpdatedAtOpen, isSprintOpen, onlyShowCurrentSpace]);

  useEffect(() => {
    if (!isAssigneeOpen) return;
    const handleClickOutside = (e) => {
      if (assigneeMenuRef.current && !assigneeMenuRef.current.contains(e.target) &&
          assigneeBtnRef.current && !assigneeBtnRef.current.contains(e.target)) {
        setIsAssigneeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAssigneeOpen]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'storyPoints' && !isValidStoryPointsInput(value)) {
      setErrors(prev => ({ ...prev, storyPoints: 'Story points must be 0 or greater.' }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (name === 'summary' && value.trim()) {
      setErrors(prev => ({ ...prev, summary: null }));
    }
    if (name === 'storyPoints') {
      setErrors(prev => ({ ...prev, storyPoints: null }));
    }
  };

  const handleCreate = async () => {
    if (isSubmitting) return;
    const storyPointsValue = formData.storyPoints === '' ? 0 : Number(formData.storyPoints);
    const nextErrors = {};

    if (!formData.summary.trim()) {
      nextErrors.summary = 'Summary is required';
    }
    if (!Number.isFinite(storyPointsValue) || storyPointsValue < 0) {
      nextErrors.storyPoints = 'Story points must be 0 or greater.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setSubmitError('');
    setIsSubmitting(true);
    if (onCreateTask) {
      try {
        await onCreateTask(formData);
      } catch (error) {
        setSubmitError(getApiErrorMessage(error, 'Unable to create this task.'));
        setIsSubmitting(false);
        return;
      }
    }

    if (!formData.createAnother) {
      setIsSubmitting(false);
      handleClose();
    } else {
      if (formData.attachments) {
        formData.attachments.forEach(att => {
          if (att.previewUrl) {
            try { URL.revokeObjectURL(att.previewUrl); } catch (_) {}
          }
        });
      }
      setFormData(prev => ({ ...prev, summary: '', description: '', comment: '', attachments: [] }));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-task-overlay" onClick={handleClose}>
      <div className="create-task-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>Create Task</h2>
          <div className="header-actions">
            <button className="header-btn" onClick={handleClose} title="Close">
              <i data-lucide="x" className="w-4 h-4 text-gray-500"></i>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body">
          <p className="form-info">Required fields are marked with an asterisk <span className="required-star">*</span></p>

          {/* Space */}
          <div className="form-group">
            <label>Space <span className="required-star">*</span></label>
            <div className="space-select-wrapper">
              <div className="space-icon">
                <i data-lucide="zap" className="w-4 h-4 text-white"></i>
              </div>
              <select 
                name="space" 
                className="select-custom pl-10" 
                value={formData.space} 
                onChange={handleInputChange}
                disabled={currentRole !== 'ADMIN'}
              >
                <option value={currentSpaceName}>{currentSpaceName}</option>
                {currentRole === 'ADMIN' && (
                  <>
                    <option>Project Alpha (KANBAN)</option>
                    <option>Web Redesign (SCRUM)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="form-group">
            <label>Status</label>
            <div className="relative">
              <div 
                className="status-custom-trigger"
                onClick={() => setIsStatusOpen(!isStatusOpen)}
              >
                <span className={`status-badge-pill ${
                  formData.status === 'Need Revision' ? 'badge-revision' :
                  formData.status === 'Done' ? 'badge-done' :
                  (formData.status === 'Cancelled' || formData.status === 'New') ? 'badge-neutral' :
                  'badge-progress'
                }`}>
                  {formData.status.toUpperCase()}
                </span>
                <i data-lucide="chevron-down" className="w-4 h-4 text-gray-500"></i>
              </div>

              {isStatusOpen && (
                <div className="status-custom-dropdown">
                  {statusOptions.map(s => (
                    <div 
                      key={s} 
                      className="status-dropdown-item"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, status: s }));
                        setIsStatusOpen(false);
                      }}
                    >
                      <span className={`status-badge-pill text-[10px] ${
                        s === 'Need Revision' ? 'badge-revision' :
                        s === 'Done' ? 'badge-done' :
                        (s === 'Cancelled' || s === 'New') ? 'badge-neutral' :
                        'badge-progress'
                      }`}>
                        {s.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="form-group">
            <label>Summary <span className="required-star">*</span></label>
            <input 
              type="text" 
              name="summary" 
              placeholder="e.g. Develop login screen"
              className={`input-custom ${errors.summary ? 'input-error' : ''}`}
              value={formData.summary}
              onChange={handleInputChange}
              autoFocus
            />
            {errors.summary && (
              <div className="error-message">
                <i data-lucide="alert-circle" className="w-4 h-4"></i>
                {errors.summary}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="form-group">
            <label>Description</label>
            <RichTextEditor
              value={formData.description}
              onChange={(val) => setFormData(prev => ({ ...prev, description: val }))}
              placeholder="Type @ to mention someone or use the toolbar above."
              tasks={tasks}
            />
          </div>

          {/* Assignee */}
          <div className="form-group">
            <label>Assignee</label>
            <div className="relative">
              <button
                ref={assigneeBtnRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAssigneeOpen(prev => !prev);
                }}
                className="select-custom flex items-center gap-3 w-full bg-white text-left"
              >
                {(() => {
                  const selectedProfile =
                    availableAssignees.find(user => (user.user_id || user.id || '') === formData.assigneeId) ||
                    availableAssignees.find(user => user.name === formData.assignee) ||
                    availableAssignees[0];
                  return (
                    <>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                        style={{ backgroundColor: selectedProfile.color, color: selectedProfile.textColor || '#111' }}
                      >
                        {selectedProfile.initials || <span className="material-symbols-outlined">{selectedProfile.icon}</span>}
                      </div>
                      <span className="text-sm text-[#172B4D]">{formData.assignee}</span>
                    </>
                  );
                })()}
              </button>
              {isAssigneeOpen && (
                <div
                  ref={assigneeMenuRef}
                  className="absolute left-0 top-full z-50 mt-2 w-full rounded-[3px] border border-[#DFE1E6] bg-white shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {availableAssignees.map(user => (
                    <button
                      key={user.user_id || user.id || user.name}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData(prev => ({
                          ...prev,
                          assignee: user.name,
                          assigneeId: user.user_id || user.id || ''
                        }));
                        setIsAssigneeOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-[#EBF0FF] transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                        style={{ backgroundColor: user.color, color: user.textColor || '#111' }}
                      >
                        {user.initials || <span className="material-symbols-outlined">{user.icon}</span>}
                      </div>
                      <span>{user.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Priority */}
          <div className="form-group">
            <label>Priority</label>
            <div className="relative">
              <div 
                className="priority-custom-trigger"
                onClick={() => setIsPriorityOpen(!isPriorityOpen)}
              >
                <div className="flex items-center gap-2">
                  {formData.priority === 'Medium' && <span className="material-symbols-outlined text-orange-500 text-[18px]">keyboard_double_arrow_up</span>}
                  {formData.priority === 'High' && <span className="material-symbols-outlined text-red-500 text-[18px]">keyboard_arrow_up</span>}
                  {formData.priority === 'Low' && <span className="material-symbols-outlined text-blue-500 text-[18px]">keyboard_arrow_down</span>}
                  <span className="text-sm">{formData.priority}</span>
                </div>
                <i data-lucide="chevron-down" className="w-4 h-4 text-gray-500"></i>
              </div>

              {isPriorityOpen && (
                <div className="priority-custom-dropdown">
                  {[
                    { label: 'Medium', icon: 'keyboard_double_arrow_up', color: 'text-orange-500' },
                    { label: 'High', icon: 'keyboard_arrow_up', color: 'text-red-500' },
                    { label: 'Low', icon: 'keyboard_arrow_down', color: 'text-blue-500' }
                  ].map(p => (
                    <div 
                      key={p.label} 
                      className="priority-dropdown-item flex items-center gap-3"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, priority: p.label }));
                        setIsPriorityOpen(false);
                      }}
                    >
                      <span className={`material-symbols-outlined ${p.color} text-[18px]`}>{p.icon}</span>
                      <span className="text-sm">{p.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid-2">
            <div className="flex flex-col gap-4">

              {/* Created At */}
              <div className="form-group">
                <label>Created At</label>
                <div className="relative">
                  <div
                    className="date-custom-trigger"
                    onClick={() => setIsCreatedAtOpen(!isCreatedAtOpen)}
                  >
                    <span className={formData.createdAt ? 'text-on-surface' : 'text-gray-400'}>
                      {formData.createdAt || 'Select date'}
                    </span>
                    <i data-lucide="calendar" className="w-4 h-4 text-gray-500"></i>
                  </div>

                  <p className="text-[11px] text-gray-400 mt-1 ml-1 leading-tight">
                    Allows the creation date for a piece of work to be set.
                  </p>

                  {isCreatedAtOpen && (
                    <CalendarDropdown
                      value={formData.createdAt}
                      onSelect={(date) => setFormData(prev => ({ ...prev, createdAt: date }))}
                      onClose={() => setIsCreatedAtOpen(false)}
                    />
                  )}
                </div>
              </div>

        

            </div>

            {/* Completed At */}
            <div className="form-group self-start">
              <label>Completed At</label>

              <div className="relative">
                <div
                  className="date-custom-trigger"
                  onClick={() => setIsCompletedAtOpen(!isCompletedAtOpen)}
                >
                  <span className={formData.completed_at ? 'text-on-surface' : 'text-gray-400'}>
                    {formData.completed_at || 'Select date'}
                  </span>

                  <i data-lucide="calendar" className="w-4 h-4 text-gray-500"></i>
                </div>

                {isCompletedAtOpen && (
                  <CalendarDropdown
                    value={formData.completed_at}
                    onSelect={(date) => setFormData(prev => ({ ...prev, completed_at: date }))}
                    onClose={() => setIsCompletedAtOpen(false)}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Sprint */}
          <div className="form-group">
            <label>Sprint</label>
            <div className="relative">
              <div 
                className={`date-custom-trigger ${!formData.sprint ? 'select-placeholder' : ''}`}
                onClick={() => setIsSprintOpen(!isSprintOpen)}
              >
                <span>{formData.sprint || 'Select sprint'}</span>
                <i data-lucide="chevron-down" className="w-4 h-4 text-gray-500"></i>
              </div>

              {isSprintOpen && (
                <div className="sprint-custom-dropdown">
                  <div className="sprint-filter-zone">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={onlyShowCurrentSpace} 
                        onChange={(e) => setOnlyShowCurrentSpace(e.target.checked)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-[13px] text-[#172B4D]">Only show sprints in this space (SCRUM)</span>
                    </label>
                  </div>
                  
                  <div className="sprint-list-content">
                    <div className="sprint-section-title">Active</div>
                    {(sprints && sprints.length > 0 ? sprints : [{ id: 'sprint-1', name: 'SCRUM Sprint 1' }]).map(s => (
                      <div 
                        key={s.id}
                        className="sprint-item-box active-item"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, sprint: s.name }));
                          setIsSprintOpen(false);
                        }}
                      >
                        <div className="sprint-item-main">{s.name}</div>
                        <div className="sprint-item-sub">SCRUM board</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Story point estimate */}
          <div className="form-group">
            <label>Story Point Estimate</label>
            <input 
              type="number" 
              name="storyPoints" 
              className={`input-custom ${errors.storyPoints ? 'input-error' : ''}`}
              placeholder="0"
              min="0"
              step="any"
              value={formData.storyPoints}
              onChange={handleInputChange}
              onKeyDown={(event) => {
                if (['-', '+', 'e', 'E'].includes(event.key)) {
                  event.preventDefault();
                }
              }}
              onPaste={(event) => {
                const pastedValue = event.clipboardData.getData('text');
                if (!isValidStoryPointsInput(pastedValue)) {
                  event.preventDefault();
                  setErrors(prev => ({ ...prev, storyPoints: 'Story points must be 0 or greater.' }));
                }
              }}
            />
            {errors.storyPoints && (
              <p className="error-message">
                {errors.storyPoints}
              </p>
            )}
            <p className="text-[11px] text-gray-400 mt-1 ml-1 font-medium italic">Measurement of complexity and/or size of a requirement.</p>
          </div>


          {/* Attachment */}
          <div className="form-group">
            <label>Attachment</label>
            <div 
              className="attachment-zone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
                multiple 
              />
              <input 
                type="file" 
                ref={replaceInputRef} 
                onChange={handleReplaceFile} 
                style={{ display: 'none' }} 
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <i data-lucide="upload-cloud" className="w-8 h-8 text-gray-400"></i>
                <span className="text-sm">Drop files to attach or <span className="browse-link">Browse</span></span>
              </div>
            </div>

            {/* Attachments List */}
            {formData.attachments && formData.attachments.length > 0 && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formData.attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 group cursor-pointer hover:bg-slate-50 transition-colors"
                    style={{ padding: '8px 12px', border: '1px solid #DFE1E6', borderRadius: '6px' }}
                  >
                    {file.type === 'image' && file.previewUrl ? (
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #DFE1E6' }}
                      />
                    ) : (
                      <div className="flex items-center justify-center shrink-0" style={{ width: '40px', height: '40px', backgroundColor: file.bg, borderRadius: '6px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '22px', color: file.color }}>{file.icon}</span>
                      </div>
                    )}
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <span className="truncate" style={{ fontSize: '13px', fontWeight: 600, color: '#172B4D' }}>{file.name}</span>
                      <span style={{ fontSize: '11px', color: '#6B778C' }}>{file.size} • {file.date}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); triggerReplace(file.id); }}
                        title="Replace"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6B778C', padding: 6, borderRadius: 6 }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteAttachment(file.id); }}
                        title="Delete"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DE350B', padding: 6, borderRadius: 6 }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                      {file.previewUrl && (
                        <button
                          type="button"
                          onClick={(e) => downloadAttachment(file, e)}
                          title="Download"
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#42526E', padding: 6, borderRadius: 6 }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div className="footer-left">
            <input 
              type="checkbox" 
              name="createAnother" 
              id="createAnother"
              checked={formData.createAnother}
              onChange={handleInputChange}
            />
            <label htmlFor="createAnother" className="text-sm ml-2 cursor-pointer">Create another</label>
          </div>
          <div className="footer-right">
            <button className="btn-cancel" onClick={handleClose} disabled={isSubmitting}>Cancel</button>
            <button className="btn-create" onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
        {submitError && (
          <div className="px-6 pb-4 text-[12px] font-semibold text-red-600">
            {submitError}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateTaskModal;
