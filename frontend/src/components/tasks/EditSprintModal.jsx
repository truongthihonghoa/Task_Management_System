import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/CreateTaskModal.css';

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatEditDate = (value) => {
  const date = parseDate(value);
  if (!date) return '';
  return `${date.toLocaleDateString('en-US')} ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};

const formatDateTimeInput = (value) => {
  const date = parseDate(value);
  if (!date) return '';
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatSummaryDate = (value) => {
  const date = parseDate(value);
  if (!date) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const formatDateTimeLocal = (value) => {
  const date = parseDate(value);
  if (!date) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  const pad = (num) => String(num).padStart(2, '0');
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
};

const getDurationWeeks = (value) => {
  if (typeof value === 'number') return value;
  if (!value) return 2;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 2 : parsed;
};

const EditSprintModal = ({ isOpen, onClose, sprint, onSave, onUpdate }) => {
  const [sprintName, setSprintName] = useState('');
  const [duration, setDuration] = useState('2 weeks');
  const [startDate, setStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [autoStart, setAutoStart] = useState(false);
  const [autoComplete, setAutoComplete] = useState(false);

  useEffect(() => {
    if (!sprint) return;
    setSprintName(sprint.name || '');
    setDuration(`${getDurationWeeks(sprint.duration)} weeks`);
    const initialStart = formatDateTimeLocal(sprint.startDate || new Date());
    setStartDate(initialStart);
    if (sprint.endDate) {
      setCustomEndDate(formatDateTimeLocal(sprint.endDate));
    }
    setSprintGoal(sprint.goal || '');
    setAutoStart(!!sprint.autoStart);
    setAutoComplete(!!sprint.autoComplete);
  }, [sprint]);

  const calculatedEndDateObj = useMemo(() => {
    const parsedStart = parseDate(startDate);
    if (!parsedStart) return null;
    const end = new Date(parsedStart);
    end.setDate(end.getDate() + getDurationWeeks(duration) * 7);
    return end;
  }, [startDate, duration]);

  const summaryEndDate = useMemo(() => {
    if (duration === 'Custom') {
      const parsedCustom = parseDate(customEndDate);
      return parsedCustom ? formatSummaryDate(parsedCustom) : '';
    }
    return calculatedEndDateObj ? formatSummaryDate(calculatedEndDateObj) : '';
  }, [duration, customEndDate, calculatedEndDateObj]);

  const handleDurationChange = (e) => {
    const newDuration = e.target.value;
    setDuration(newDuration);
    if (newDuration === 'Custom' && !customEndDate) {
      setCustomEndDate(formatDateTimeLocal(calculatedEndDateObj || new Date()));
    }
  };

  if (!isOpen || !sprint) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedStart = parseDate(startDate);
    let finalEndDateObj = null;
    let finalDurationWeeks = getDurationWeeks(duration);

    if (duration === 'Custom') {
      finalEndDateObj = parseDate(customEndDate);
      if (parsedStart && finalEndDateObj) {
        const diffMs = finalEndDateObj.getTime() - parsedStart.getTime();
        finalDurationWeeks = Math.max(1, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)));
      }
    } else {
      finalEndDateObj = calculatedEndDateObj;
    }

    const updatedSprintData = {
      ...sprint,
      name: sprintName,
      duration: finalDurationWeeks,
      startDate: parsedStart ? parsedStart.toISOString() : sprint.startDate,
      endDate: finalEndDateObj ? finalEndDateObj.toISOString() : sprint.endDate,
      goal: sprintGoal,
      autoStart,
      autoComplete,
    };

    if (onUpdate) {
      await onUpdate(updatedSprintData);
    } else if (onSave) {
      await onSave(updatedSprintData);
    }
  };

  return createPortal(
    <div className="modal-overlay modal-overlay-strong" onClick={onClose}>
      <div className="create-task-modal" onClick={(e) => e.stopPropagation()}>
        <form className="flex h-full flex-col" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2>Edit Sprint</h2>
            <div className="header-actions">
              <button type="button" className="header-btn" onClick={onClose} title="Close">
                <span className="material-symbols-outlined block">close</span>
              </button>
            </div>
          </div>

          <div className="modal-body">
            <div className="form-info">Edit sprint details and update the sprint settings.</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="md:col-span-8 space-y-4">
                <div className="form-group">
                  <label htmlFor="sprint-name">Sprint name</label>
                  <input
                    id="sprint-name"
                    type="text"
                    value={sprintName}
                    readOnly
                    onKeyDown={(e) => e.preventDefault()}
                    className="input-custom !bg-white"
                    style={{ backgroundColor: '#ffffff', color: '#1F2937' }}
                    placeholder="SCRUM Sprint 2"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="form-group">
                    <label htmlFor="duration">Duration</label>
                    <div className="select-wrapper">
                      <select
                        id="duration"
                        value={duration}
                        onChange={handleDurationChange}
                        className="select-custom"
                      >
                        <option value="1 week">1 week</option>
                        <option value="2 weeks">2 weeks</option>
                        <option value="3 weeks">3 weeks</option>
                        <option value="4 weeks">4 weeks</option>
                        <option value="Custom">Custom</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#42526E]">expand_more</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="start-date">Start date</label>
                    <div className="relative">
                      <input
                        id="start-date"
                        type="datetime-local"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="input-custom"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="form-group">
                    <label htmlFor="end-date">End date</label>
                    {duration === 'Custom' ? (
                      <div className="relative">
                        <input
                          id="end-date"
                          type="datetime-local"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="input-custom"
                        />
                      </div>
                    ) : (
                      <input
                        id="end-date"
                        type="text"
                        readOnly
                        onKeyDown={(e) => e.preventDefault()}
                        value={summaryEndDate}
                        className="input-custom !bg-white"
                        style={{ backgroundColor: '#ffffff', color: '#1F2937' }}
                      />
                    )}
                  </div>
                  <div className="hidden md:block"></div>
                </div>

                <div className="form-group">
                  <label htmlFor="sprint-goal">Sprint goal</label>
                  <textarea
                    id="sprint-goal"
                    value={sprintGoal}
                    onChange={(e) => setSprintGoal(e.target.value)}
                    rows={4}
                    placeholder="A short sentence describing the sprint objective"
                    className="input-custom"
                  />
                </div>
              </div>

              <div className="md:col-span-4 space-y-3">
                <div className="sprint-settings-panel space-y-3">
                  <h3 className="sprint-settings-title">Sprint settings</h3>

                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="sprint-setting-title">Automatically start sprint</p>
                      <p className="sprint-setting-help">Start this sprint once all prerequisites are ready.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer mt-1 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={autoStart}
                        onChange={(e) => setAutoStart(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 rounded-full bg-[#dce2f3] peer-focus:outline-none peer-checked:bg-[#4C2B74] transition-colors"></div>
                      <div className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full border border-gray-300 bg-white transition-transform peer-checked:translate-x-full"></div>
                    </label>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="sprint-setting-title">Complete sprint automatically</p>
                      <p className="sprint-setting-help">Close the sprint when all tasks meet done criteria.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer mt-1 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={autoComplete}
                        onChange={(e) => setAutoComplete(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 rounded-full bg-[#dce2f3] peer-focus:outline-none peer-checked:bg-[#4C2B74] transition-colors"></div>
                      <div className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full border border-gray-300 bg-white transition-transform peer-checked:translate-x-full"></div>
                    </label>
                  </div>

                  <div className="sprint-summary-box space-y-3">
                    <h4 className="sprint-summary-title">Summary</h4>
                    <div className="space-y-1">
                      <div className="sprint-summary-row">
                        <span>Sprint name</span>
                        <span className="font-semibold text-[#121c2a]">{sprintName || '—'}</span>
                      </div>
                      <div className="sprint-summary-row">
                        <span>Duration</span>
                        <span className="font-semibold text-[#121c2a]">{duration}</span>
                      </div>
                      <div className="sprint-summary-stack">
                        <span>Roadmap</span>
                        <span className="font-semibold text-[#121c2a] text-right">{formatSummaryDate(startDate)} → {summaryEndDate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer modal-footer-end">
            <button
              type="button"
              onClick={onClose}
              className="btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-create"
            >
              Update sprint
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default EditSprintModal;
