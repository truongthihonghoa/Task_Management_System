import React, { useState } from 'react';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const parseDateValue = (value) => {
  if (!value) return new Date();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export const formatDateValue = (year, month, day) => {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const CalendarDropdown = ({ value, onSelect, onClose }) => {
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
};

export default CalendarDropdown;
