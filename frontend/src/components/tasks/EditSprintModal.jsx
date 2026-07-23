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
  const [sprintGoal, setSprintGoal] = useState('');
  const [autoStart, setAutoStart] = useState(false);
  const [autoComplete, setAutoComplete] = useState(false);

  useEffect(() => {
    if (!sprint) return;
    setSprintName(sprint.name || '');
    setDuration(`${getDurationWeeks(sprint.duration)} weeks`);
    setStartDate(formatDateTimeLocal(sprint.startDate || new Date()));
    setSprintGoal(sprint.goal || '');
    setAutoStart(!!sprint.autoStart);
    setAutoComplete(!!sprint.autoComplete);
  }, [sprint]);

  const endDate = useMemo(() => {
    const parsedStart = parseDate(startDate);
    if (!parsedStart) return '';
    const end = new Date(parsedStart);
    end.setDate(end.getDate() + getDurationWeeks(duration) * 7);
    return formatSummaryDate(end);
  }, [startDate, duration]);

  if (!isOpen || !sprint) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedStart = parseDate(startDate);
    const updatedSprintData = {
      ...sprint,
      name: sprintName,
      duration: getDurationWeeks(duration),
      startDate: parsedStart ? parsedStart.toISOString() : sprint.startDate,
      endDate: parseDate(endDate)?.toISOString() || sprint.endDate,
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-black/40" onClick={onClose}>
      <div className="create-task-modal" onClick={(e) => e.stopPropagation()}>
        <form className="flex h-full flex-col" onSubmit={handleSubmit}>
          <div className="modal-header">
            <div>
              <span className="block text-[12px] font-medium tracking-widest text-[#4a454f]">EDIT SPRINT</span>
            </div>
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
                    onChange={(e) => setSprintName(e.target.value)}
                    className="input-custom"
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
                        onChange={(e) => setDuration(e.target.value)}
                        className="select-custom"
                      >
                        <option value="1 week">1 week</option>
                        <option value="2 weeks">2 weeks</option>
                        <option value="3 weeks">3 weeks</option>
                        <option value="4 weeks">4 weeks</option>
                        <option value="Custom">Custom</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#4a454f]">expand_more</span>
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
                  <div className="form-group opacity-80">
                    <label htmlFor="end-date">End date</label>
                    <input
                      id="end-date"
                      type="text"
                      readOnly
                      value={endDate}
                      className="input-custom"
                    />
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
                <div className="rounded-xl border border-[#ccc4d0]/30 bg-[#eff4ff] p-6 space-y-3">
                  <h3 className="text-[20px] font-semibold text-[#121c2a]">Sprint settings</h3>

                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-[14px] font-semibold text-[#121c2a]">Automatically start sprint</p>
                      <p className="text-[12px] leading-tight text-[#5e6572]">Start this sprint once all prerequisites are ready.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer mt-1 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={autoStart}
                        onChange={(e) => setAutoStart(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 rounded-full bg-[#dce2f3] peer-focus:outline-none peer-checked:bg-[#331b55] transition-colors"></div>
                      <div className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full border border-gray-300 bg-white transition-transform peer-checked:translate-x-full"></div>
                    </label>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-[14px] font-semibold text-[#121c2a]">Complete sprint automatically</p>
                      <p className="text-[12px] leading-tight text-[#5e6572]">Close the sprint when all tasks meet done criteria.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer mt-1 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={autoComplete}
                        onChange={(e) => setAutoComplete(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 rounded-full bg-[#dce2f3] peer-focus:outline-none peer-checked:bg-[#331b55] transition-colors"></div>
                      <div className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full border border-gray-300 bg-white transition-transform peer-checked:translate-x-full"></div>
                    </label>
                  </div>

                  <div className="rounded-lg border border-[#ccc4d0]/50 bg-white p-4 space-y-3">
                    <h4 className="border-b border-[#ccc4d0] pb-2 text-[11px] font-bold uppercase tracking-wider text-[#4a454f]">Summary</h4>
                    <div className="space-y-1 text-sm text-[#5e6572]">
                      <div className="flex justify-between text-[14px]">
                        <span>Sprint name</span>
                        <span className="font-semibold text-[#121c2a]">{sprintName || '—'}</span>
                      </div>
                      <div className="flex justify-between text-[14px]">
                        <span>Duration</span>
                        <span className="font-semibold text-[#121c2a]">{duration}</span>
                      </div>
                      <div className="flex flex-col gap-1 text-[14px]">
                        <span>Roadmap</span>
                        <span className="font-semibold text-[#121c2a] text-right">{formatSummaryDate(startDate)} → {endDate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-[#ccc4d0] bg-white px-6 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#ccc4d0] bg-white px-6 py-2 text-[14px] font-semibold text-[#331b55] transition hover:bg-[#eff4ff] active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#4a326d] px-6 py-2 text-[14px] font-semibold text-white transition hover:opacity-90 shadow-md active:scale-95"
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
