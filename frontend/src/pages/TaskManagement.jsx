import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import SprintInfoPopover from '../components/tasks/SprintInfoPopover';
import CompleteSprintModal from '../components/tasks/CompleteSprintModal';
import EditSprintModal from '../components/tasks/EditSprintModal';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import DeleteTaskModal from '../components/tasks/DeleteTaskModal';

const availableAssignees = [
  { name: 'Unassigned', initials: '', color: '#8e8f90', icon: 'person', textColor: '#FFFFFF' },
  { name: 'Pham Tien', initials: 'PT', color: '#2f3650', textColor: '#FFFFFF' },
  { name: 'Hoang Hoa', initials: 'HH', color: '#F97316', textColor: '#FFFFFF' },
  { name: 'Trong Nghia', initials: 'TN', color: '#14B8A6', textColor: '#FFFFFF' }
];

const assigneeProfiles = {
  'Pham Tien': { initials: 'PT', color: '#2f3650', textColor: '#FFFFFF' },
  'Hoang Hoa': { initials: 'HH', color: '#F97316', textColor: '#FFFFFF' },
  'Trong Nghia': { initials: 'TN', color: '#14B8A6', textColor: '#FFFFFF' },
  'Unassigned': { initials: 'UN', color: '#8e8f90', textColor: '#FFFFFF' }
};

const getInitials = (name) => {
  if (!name) return 'UN';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return 'UN';
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
};

const getAssigneeProfile = (assignee) => {
  if (!assignee) return assigneeProfiles['Unassigned'];
  return assigneeProfiles[assignee] || {
    initials: getInitials(assignee),
    color: '#9CA3AF',
    textColor: '#FFFFFF'
  };
};

const getNextTaskId = (tasks) => {
  const maxTaskNumber = tasks.reduce((max, task) => {
    const match = /^TM-(\d+)$/.exec(task.id || '');
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `TM-${maxTaskNumber + 1}`;
};

const formatTaskDate = (dateValue) => {
  const date = dateValue ? new Date(dateValue) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

export default function TaskManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setShowCreateModal, setTasksForModal, setCreateTaskHandler, currentRole = 'ADMIN', currentUser } = useOutletContext() || {};
  const isAdmin = currentRole === 'ADMIN';
  const [view, setView] = useState('list');
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [isSprintExpanded, setIsSprintExpanded] = useState(true);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);

  // Sprint popover and complete modal states
  const [isSprintInfoOpen, setIsSprintInfoOpen] = useState(false);
  const [isCompleteSprintOpen, setIsCompleteSprintOpen] = useState(false);
  const sprintInfoAnchorRef = useRef(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMonth, setViewMonth] = useState(5); // June
  const [viewYear, setViewYear] = useState(2026);

  const getDaysInMonth = (year, month) => {
    const days = [];
    const startDay = new Date(year, month, 1).getDay();
    const numDays = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= numDays; d++) days.push(d);
    return days;
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Dynamic sprints (Sprint 2, 3, ...) created via "Create sprint" button
  const [extraSprints, setExtraSprints] = useState([]);
  const [expandedSprints, setExpandedSprints] = useState({});
  // Which sprint's ... menu is open (null = none, 'sprint-1' = Sprint 1, sprint.id = extra sprint)
  const [openSprintMenuId, setOpenSprintMenuId] = useState(null);

  // Sprint 1 data (editable)
  const [sprint1Data, setSprint1Data] = useState({
    id: 'sprint-1',
    name: 'SCRUM Sprint 1',
    dateRange: '18 Jun – 2 Jul',
    startDate: '2026-06-18T00:00',
    duration: 2,
    goal: '',
    autoStart: false,
    autoComplete: false,
  });

  // Edit Sprint modal states
  const [isEditSprintOpen, setIsEditSprintOpen] = useState(false);
  const [sprintToEdit, setSprintToEdit] = useState(null);

  // Delete Sprint confirm states
  const [deleteSprintConfirmId, setDeleteSprintConfirmId] = useState(null);

  const [tasks, setTasks] = useState([
    { id: "TM-1", title: "Infrastructure setup", assignee: "Pham Tien", pts: 4, status: "New", priority: "High", date: "Jun 24, 2026", description: "" },
    { id: "TM-2", title: "API Documentation update", assignee: "Hoang Hoa", pts: 3, status: "In Progress", priority: "Medium", date: "Jun 28, 2026", description: "" },
    { id: "TM-3", title: "Checkout flow mobile fix", assignee: "Trong Nghia", pts: 5, status: "In Testing", priority: "High", date: "Jul 02, 2026", description: "" },
    { id: "TM-4", title: "Security Protocols Audit", assignee: "Pham Tien", pts: 8, status: "Done", priority: "High", date: "Jun 20, 2026", description: "" },
    { id: "TM-5", title: "SSO Authentication implementation", assignee: "Hoang Hoa", pts: 2, status: "In Progress", priority: "Medium", date: "Jun 25, 2026", description: "" },
    { id: "TM-6", title: "API Integration & Testing", assignee: "Trong Nghia", pts: 3, status: "Pending Review", priority: "High", date: "Jul 05, 2026", description: "" },
    { id: "TM-7", title: "User Feedback UI Refactor", assignee: "Pham Tien", pts: 2, status: "Need Revision", priority: "Low", date: "Jul 10, 2026", description: "" },
    { id: "TM-8", title: "Database Migration Script", assignee: "Hoang Hoa", pts: 5, status: "New", priority: "High", date: "Jul 12, 2026", description: "" },
    { id: "TM-9", title: "Dashboard Charts optimization", assignee: "Trong Nghia", pts: 3, status: "In Testing", priority: "Medium", date: "Jul 15, 2026", description: "" },
    { id: "TM-10", title: "Mobile App Performance Tuning", assignee: "Trong Nghia", pts: 4, status: "In Testing", priority: "Medium", date: "Jul 18, 2026", description: "" },
    { id: "TM-11", title: "Push Notification Service", assignee: "Hoang Hoa", pts: 3, status: "New", priority: "High", date: "Jul 20, 2026", description: "" },
  ]);

  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('All');

  // Sync tasks with MainLayout context for the CreateTaskModal's RichTextEditor
  useEffect(() => {
    if (setTasksForModal) {
      setTasksForModal(tasks);
    }
  }, [tasks, setTasksForModal]);

  const handleCreateTask = useCallback((taskData) => {
    setTasks(prev => [
      ...prev,
      {
        id: getNextTaskId(prev),
        title: taskData.summary,
        assignee: taskData.assignee === 'Unassigned' ? '' : taskData.assignee,
        pts: Number(taskData.storyPoints) || 0,
        status: taskData.status,
        priority: taskData.priority,
        date: formatTaskDate(taskData.createdAt),
        description: taskData.description || ""
      }
    ]);
  }, []);

  useEffect(() => {
    if (!setCreateTaskHandler) return undefined;

    setCreateTaskHandler(() => handleCreateTask);
    return () => setCreateTaskHandler(null);
  }, [handleCreateTask, setCreateTaskHandler]);
 
  // Keep selected task detail in sync with the latest task state
  useEffect(() => {
    if (selectedTaskDetail) {
      const current = tasks.find(t => t.id === selectedTaskDetail.id);
      if (current && current !== selectedTaskDetail) {
        setSelectedTaskDetail(current);
      }
    }
  }, [tasks, selectedTaskDetail]);
 
  const toggleAll = () => {
    if (selectedTasks.length === tasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(tasks.map(t => t.id));
    }
  };

  const toggleTask = (id) => {
    setSelectedTasks(prev =>
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const updatedTasks = Array.from(tasks);
    const taskIndex = updatedTasks.findIndex(t => t.id === draggableId);

    if (taskIndex !== -1) {
      updatedTasks[taskIndex] = {
        ...updatedTasks[taskIndex],
        status: destination.droppableId
      };
      setTasks(updatedTasks);
    }
  };

  const switchView = (newView) => {
    setView(newView);
  };

  const handleDeleteTask = (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setTaskToDelete(null);
  };

  const handleCreateSprint = () => {
    // Calculate next sprint number (Sprint 1 is fixed + existing extra sprints)
    const nextNum = extraSprints.length + 2;
    // Start date = 2 weeks after previous sprint starts (rough estimate)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + (extraSprints.length + 1) * 14);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 13);
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const newSprint = {
      id: `sprint-${nextNum}`,
      name: `SCRUM Sprint ${nextNum}`,
      dateRange: `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      tasks: [],
      isCompleted: false,
    };
    setExtraSprints(prev => [...prev, newSprint]);
    setExpandedSprints(prev => ({ ...prev, [newSprint.id]: true }));
  };

  const toggleSprintExpanded = (sprintId) => {
    setExpandedSprints(prev => ({ ...prev, [sprintId]: !prev[sprintId] }));
  };

  const handleDeleteExtraSprint = (sprintId) => {
    setExtraSprints(prev => prev.filter(s => s.id !== sprintId));
    setOpenSprintMenuId(null);
    setDeleteSprintConfirmId(null);
  };

  const handleOpenEditSprint = (sprintData) => {
    setSprintToEdit(sprintData);
    setIsEditSprintOpen(true);
    setOpenSprintMenuId(null);
  };

  const handleUpdateSprint = (updatedSprint) => {
    if (updatedSprint.id === 'sprint-1') {
      setSprint1Data(updatedSprint);
    } else {
      setExtraSprints(prev => prev.map(s => s.id === updatedSprint.id ? { ...s, ...updatedSprint } : s));
    }
    setIsEditSprintOpen(false);
    setSprintToEdit(null);
  };

  // Close sprint menus when clicking outside
  useEffect(() => {
    if (!openSprintMenuId) return;
    const handler = (e) => {
      if (!e.target.closest('[data-sprint-menu]')) {
        setOpenSprintMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openSprintMenuId]);

  const filteredTasks = tasks.filter(task => {
    if (selectedAssigneeFilter && selectedAssigneeFilter !== 'All') {
      if (selectedAssigneeFilter === 'Unassigned') {
        if (task.assignee) return false;
      } else if (task.assignee !== selectedAssigneeFilter) {
        return false;
      }
    }

    if (selectedStatusFilter !== 'All' && task.status !== selectedStatusFilter) {
      return false;
    }

    if (selectedPriorityFilter !== 'All' && task.priority !== selectedPriorityFilter) {
      return false;
    }

    if (selectedDate) {
      try {
        const selTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime();
        const taskTime = new Date(task.date).getTime();
        return selTime === taskTime;
      } catch (e) {
        return false;
      }
    }
    return true;
  });

  const handleUpdateTask = (updatedTask) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    setSelectedTaskDetail(updatedTask);
  };

  return (
    <div className="px-6 pb-6 pt-10 flex flex-col bg-[#F4F6F8] text-on-surface" style={{ height: '100%', overflow: 'hidden', position: 'relative' }} id="app-canvas">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center text-[10px] font-bold uppercase tracking-wider mb-1">
            <span className="cursor-pointer text-gray-500 transition-colors hover:text-[#5e4db2] active:text-[#5e4db2]" onClick={() => navigate(`/dashboard/spaces${location.search}`)}>Tasks</span>
            <i className="w-3 h-3 mx-2 text-gray-400 material-symbols-outlined text-[12px]">chevron_right</i>
            <span className="cursor-pointer text-gray-500 transition-colors hover:text-[#5e4db2] active:text-[#5e4db2]" onClick={() => navigate(`/dashboard/spaces${location.search}`)}>Space Management</span>
          </div>
          <h1 className="text-2xl font-bold text-[#4C2B74]">Task Management</h1>
        </div>
        <div className="flex items-center gap-3 bg-surface-container-low p-1 rounded-lg border border-outline-variant">
          <button
            className={`flex items-center gap-2 px-2.5 py-1 rounded text-xs font-medium transition-colors ${view === 'list' ? 'bg-[#cdddff] text-[#003d9b]' : 'text-gray-500'}`}
            onClick={() => switchView('list')}
          >
            List
          </button>
          <button
            className={`flex items-center gap-2 px-2.5 py-1 rounded text-xs font-medium transition-colors ${view === 'board' ? 'bg-[#cdddff] text-[#003d9b]' : 'text-gray-500'}`}
            onClick={() => switchView('board')}
          >
            <span className="material-symbols-outlined text-[16px]">grid_view</span>
            Board
          </button>

        </div>
      </div>

      {/* Filters Section */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-outline text-[20px]">search</span>
            <input
              className="pl-10 pr-4 py-1.5 bg-white border border-outline-variant rounded text-[11px] w-[220px] focus:ring-2 focus:ring-[#5E4DB2]/30 focus:border-[#5E4DB2] outline-none text-[#32275E]"
              placeholder="Filter by ID or title..."
              type="text"
            />
          </div>
          {/* Status Filter */}
          <div className="relative group">
            <button className={`flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded hover:bg-surface-container transition-colors shadow-sm cursor-pointer ${selectedStatusFilter !== 'All' ? 'bg-[#EBF0FF] border-[#5e4db2]' : ''}`}>
              <span className="text-xs font-bold text-[#5e4db2]">{selectedStatusFilter === 'All' ? 'Status' : selectedStatusFilter}</span>
              <span className="material-symbols-outlined text-[#5e4db2] text-[14px]">expand_more</span>
            </button>
            <div className="absolute top-[100%] left-0 pt-1 w-48 hidden group-hover:block z-50">
              <div className="bg-white border border-outline-variant rounded-xl shadow-2xl overflow-hidden py-1">
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('All')}
                  className="w-full text-left px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors cursor-pointer text-on-surface"
                >
                  All statuses
                </button>
                {(isAdmin ? ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done', 'Cancelled'] : ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done']).map(status => (
                  <button 
                    key={status} 
                    type="button"
                    onClick={() => setSelectedStatusFilter(status)}
                    className="w-full text-left px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors cursor-pointer text-on-surface"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Priority Filter */}
          <div className="relative group">
            <button className={`flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded hover:bg-surface-container transition-colors shadow-sm cursor-pointer ${selectedPriorityFilter !== 'All' ? 'bg-[#EBF0FF] border-[#5e4db2]' : ''}`}>
              <span className="text-xs font-bold text-[#5e4db2]">{selectedPriorityFilter === 'All' ? 'Priority' : selectedPriorityFilter}</span>
              <span className="material-symbols-outlined text-[#5e4db2] text-[14px]">expand_more</span>
            </button>
            <div className="absolute top-[100%] left-0 pt-1 w-40 hidden group-hover:block z-50">
              <div className="bg-white border border-outline-variant rounded-xl shadow-2xl overflow-hidden py-1">
                <button
                  type="button"
                  onClick={() => setSelectedPriorityFilter('All')}
                  className="w-full text-left px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors cursor-pointer text-on-surface"
                >
                  All priorities
                </button>
                {['High', 'Medium', 'Low'].map(priority => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => setSelectedPriorityFilter(priority)}
                    className="w-full text-left px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors cursor-pointer text-on-surface"
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Assignee Filter */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center ml-1 hover:opacity-70 transition-opacity"
            >
              <div className="flex -space-x-1">
                {availableAssignees.slice(1).map(user => (
                  <div
                    key={user.name}
                    className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-gray text-[11px] font-medium"
                    style={{ backgroundColor: user.color, color: user.textColor || '#676464' }}
                  >
                    {user.initials}
                  </div>
                ))}
              </div>
            </button>
            <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => setSelectedAssigneeFilter('All')}
                  className="w-full text-left px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors"
                >
                  All assignees
                </button>
                {availableAssignees.map(user => (
                  <button
                    key={user.name}
                    type="button"
                    onClick={() => setSelectedAssigneeFilter(user.name)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-[11px] hover:bg-[#EBF0FF] transition-colors"
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{ backgroundColor: user.color, color: user.textColor || '#111' }}
                    >
                      {user.initials || <span className="material-symbols-outlined">{user.icon}</span>}
                    </div>
                    <span>{user.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Sprint Actions */}
          {view === 'board' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCompleteSprintOpen(true)}
                className="px-4 py-1.5 bg-[#f0edff] text-[#5e4db2] rounded text-[13px] font-semibold hover:bg-[#e6e1ff] transition-colors"
              >
                Complete sprint
              </button>
              <button
                ref={sprintInfoAnchorRef}
                onClick={() => setIsSprintInfoOpen(!isSprintInfoOpen)}
                className="flex items-center justify-center w-[36px] h-[36px] border border-outline-variant rounded hover:bg-surface-container transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[20px] text-on-surface">insights</span>
              </button>
            </div>
          )}

          {/* Date Filter */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-outline-variant rounded hover:bg-surface-container transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[#5e4db2] text-[16px]">calendar_month</span>
              <span className="text-[11px] font-bold text-[#5e4db2]">
                {selectedDate
                  ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Date'}
              </span>
            </button>

            {/* Calendar Dropdown */}
            <div className="absolute top-full right-0 mt-2 w-[280px] bg-white border border-outline-variant rounded-xl shadow-2xl hidden group-hover:block z-50 overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[12px] font-bold text-[#5e4db2]">{monthNames[viewMonth]} {viewYear}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewMonth(m => {
                          if (m === 0) {
                            setViewYear(y => y - 1);
                            return 11;
                          }
                          return m - 1;
                        });
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewMonth(m => {
                          if (m === 11) {
                            setViewYear(y => y + 1);
                            return 0;
                          }
                          return m + 1;
                        });
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                    <span key={day} className="text-[10px] font-bold text-outline uppercase">{day}</span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {getDaysInMonth(viewYear, viewMonth).map((day, i) => {
                    if (day === null) {
                      return <div key={`empty-${i}`} className="h-7 w-7" />;
                    }
                    const isSelected = selectedDate &&
                      selectedDate.getDate() === day &&
                      selectedDate.getMonth() === viewMonth &&
                      selectedDate.getFullYear() === viewYear;
                    const isToday = day === 24 && viewMonth === 5 && viewYear === 2026;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelected) {
                            setSelectedDate(null);
                          } else {
                            setSelectedDate(new Date(viewYear, viewMonth, day));
                          }
                        }}
                        className={`h-7 w-7 flex items-center justify-center rounded-lg text-[10px] transition-colors ${isSelected
                          ? 'bg-[#5e4db2] text-white font-bold'
                          : isToday
                            ? 'border border-[#5e4db2] text-[#5e4db2] font-semibold'
                            : 'hover:bg-surface-container text-on-surface'
                          }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOARD VIEW */}
      {view === 'board' && (
        <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 pb-4 scrollbar-hide" id="board-view-container" style={{ flex: '1 1 0', minHeight: 0, overflowX: 'auto', overflowY: 'hidden', alignItems: 'stretch' }}>
              {(isAdmin ? ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done', 'Cancelled'] : ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done']).map(status => (
                <KanbanColumn
                  key={status}
                  title={status}
                  tasks={filteredTasks.filter(t => t.status === status)}
                  setTasks={setTasks}
                  onCreateTask={setShowCreateModal ? () => setShowCreateModal(true) : undefined}
                  onOpenDetail={setSelectedTaskDetail}
                  color={status === 'Need Revision' ? 'error' : status === 'Done' ? 'green' : status === 'Cancelled' ? 'grey' : 'outline'}
                  currentRole={currentRole}
                />
              ))}
            </div>
          </DragDropContext>
        </div>
      )}

      {/* LIST VIEW */}
      {view === 'list' && (
        <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', paddingBottom: '16px' }}>
          <div className="bg-white border border-outline-variant rounded-lg flex flex-col overflow-hidden shadow-sm" id="list-view-container">
            <div className="px-6 py-2 border-b border-[#DDE3F0] bg-[#FAFAFF] flex items-center justify-between flex-none">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-outline-variant cursor-pointer accent-primary"
                  checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0}
                  onChange={toggleAll}
                />
                <span
                  className="material-symbols-outlined text-[18px] text-outline cursor-pointer transition-transform duration-200"
                  style={{ transform: isSprintExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                  onClick={() => setIsSprintExpanded(!isSprintExpanded)}
                >
                  expand_more
                </span>
                <div
                  ref={sprintInfoAnchorRef}
                  onClick={() => setIsSprintInfoOpen(!isSprintInfoOpen)}
                  className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100/80 px-2 py-0.5 rounded transition-all select-none"
                >
                  <span className="text-[12px] font-bold text-on-surface">{sprint1Data.name}</span>
                  <span className="text-[11px] text-outline">{sprint1Data.dateRange}</span>
                  <span className="material-symbols-outlined text-[14px] text-outline">info</span>
                </div>
                <span className="text-[11px] text-outline">({filteredTasks.length} work items)</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  <span className="px-1.5 py-0.5 bg-gray-200 text-[10px] font-bold rounded text-outline">
                    {filteredTasks.filter(t => t.status === 'New' || (isAdmin && t.status === 'Cancelled')).length}
                  </span>
                  <span className="px-1.5 py-0.5 bg-[#ADC4FF] text-[10px] font-bold rounded text-[#003d9b]">
                    {filteredTasks.filter(t => ['In Progress', 'In Testing', 'Pending Review', 'Need Revision'].includes(t.status)).length}
                  </span>
                  <span className="px-1.5 py-0.5 bg-[#C2FFD9] text-[10px] font-bold rounded text-[#006D3A]">
                    {filteredTasks.filter(t => t.status === 'Done').length}
                  </span>
                </div>
                <button
                  onClick={() => setIsCompleteSprintOpen(true)}
                  className="px-3 py-1 bg-[#f0edff] text-[#5e4db2] border border-[#e6e1ff] rounded text-[11px] font-bold hover:bg-[#e6e1ff] transition-colors shadow-sm"
                >
                  Complete sprint
                </button>
                {/* Sprint 1 ... dropdown menu */}
                <div className="relative" data-sprint-menu>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenSprintMenuId(openSprintMenuId === 'sprint-1' ? null : 'sprint-1'); }}
                    className={`p-1 rounded hover:bg-surface-container transition-colors ${openSprintMenuId === 'sprint-1' ? 'bg-surface-container text-on-surface' : 'text-outline'}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                  </button>
                  {openSprintMenuId === 'sprint-1' && (
                    <div className="absolute right-0 top-full mt-1 w-[160px] bg-white border border-outline-variant rounded-lg shadow-2xl py-1 z-[200]">
                      <button
                        onClick={() => handleOpenEditSprint(sprint1Data)}
                        className="w-full px-4 py-2.5 text-[13px] text-left text-on-surface hover:bg-[#EBF0FF] hover:text-[#003d9b] transition-colors"
                      >
                        Edit sprint
                      </button>
                      <button
                        onClick={() => { setOpenSprintMenuId(null); setDeleteSprintConfirmId('sprint-1'); }}
                        className="w-full px-4 py-2.5 text-[13px] text-left text-error hover:bg-red-50 transition-colors"
                      >
                        Delete sprint
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {isSprintExpanded && (
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low border-b border-outline-variant sticky top-0 z-10 bg-[#F4F5FF]">
                    <tr className="text-[11px] text-outline uppercase tracking-wider">
                      <th className="px-2 py-3 font-bold text-center">Task ID</th>
                      <th className="px-6 py-3 font-bold">Title</th>
                      <th className="px-6 py-3 font-bold">Assignee</th>
                      <th className="px-6 py-3 font-bold text-center">Priority</th>
                      <th className="px-6 py-3 font-bold">Status</th>
                      <th className="px-6 py-3 font-bold">Completed</th>
                      {isAdmin && <th className="px-6 py-3 font-bold text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {filteredTasks.map(task => (
                      <TaskRow
                        key={task.id}
                        {...task}
                        isAdmin={isAdmin}
                        isSelected={selectedTasks.includes(task.id)}
                        isAnySelected={selectedTasks.length > 0}
                        onToggle={() => toggleTask(task.id)}
                        onOpenDetail={() => setSelectedTaskDetail(task)}
                        onDelete={() => setTaskToDelete(task)}
                        onUpdateAssignee={(newAssignee) => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, assignee: newAssignee === 'Unassigned' ? '' : newAssignee } : t))}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* + Create button below Sprint 1 table */}
            {isSprintExpanded && (
              <div className="px-4 py-2 border-t border-outline-variant/30 bg-white">
                <button
                  onClick={() => setShowCreateModal && setShowCreateModal(true)}
                  className="flex items-center gap-1.5 text-outline hover:text-[#5e4db2] transition-colors group"
                >
                  <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">add</span>
                  <span className="text-[12px] font-medium">Create</span>
                </button>
              </div>
            )}
          </div>

          {/* EXTRA SPRINTS (created dynamically) */}
          {extraSprints.map((sprint) => (
            <div key={sprint.id} className="mt-4 bg-white border border-outline-variant rounded-lg overflow-hidden shadow-sm">
              {/* Sprint Header */}
              <div className="px-6 py-2 border-b border-[#DDE3F0] bg-[#FAFAFF] flex items-center justify-between flex-none">
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded border-outline-variant cursor-pointer accent-primary" />
                  <span
                    className="material-symbols-outlined text-[18px] text-outline cursor-pointer transition-transform duration-200"
                    style={{ transform: expandedSprints[sprint.id] ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    onClick={() => toggleSprintExpanded(sprint.id)}
                  >
                    expand_more
                  </span>
                  <div className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100/80 px-2 py-0.5 rounded transition-all select-none">
                    <span className="text-[12px] font-bold text-on-surface">{sprint.name}</span>
                    <span className="text-[11px] text-outline">{sprint.dateRange}</span>
                    <span className="material-symbols-outlined text-[14px] text-outline">info</span>
                  </div>
                  <span className="text-[11px] text-outline">({sprint.tasks.length} work items)</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 bg-gray-200 text-[10px] font-bold rounded text-outline">0</span>
                    <span className="px-1.5 py-0.5 bg-[#ADC4FF] text-[10px] font-bold rounded text-[#003d9b]">0</span>
                    <span className="px-1.5 py-0.5 bg-[#C2FFD9] text-[10px] font-bold rounded text-[#006D3A]">0</span>
                  </div>
                  <button
                    onClick={() => setIsCompleteSprintOpen(true)}
                    className="px-3 py-1 bg-[#f0edff] text-[#5e4db2] border border-[#e6e1ff] rounded text-[11px] font-bold hover:bg-[#e6e1ff] transition-colors shadow-sm"
                  >
                    Complete sprint
                  </button>
                  {/* Extra sprint ... dropdown menu */}
                  <div className="relative" data-sprint-menu>
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenSprintMenuId(openSprintMenuId === sprint.id ? null : sprint.id); }}
                      className={`p-1 rounded hover:bg-surface-container transition-colors ${openSprintMenuId === sprint.id ? 'bg-surface-container text-on-surface' : 'text-outline'}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                    </button>
                    {openSprintMenuId === sprint.id && (
                      <div className="absolute right-0 top-full mt-1 w-[160px] bg-white border border-outline-variant rounded-lg shadow-2xl py-1 z-[200]">
                        <button
                          onClick={() => handleOpenEditSprint(sprint)}
                          className="w-full px-4 py-2.5 text-[13px] text-left text-on-surface hover:bg-[#EBF0FF] hover:text-[#003d9b] transition-colors"
                        >
                          Edit sprint
                        </button>
                        <button
                          onClick={() => { setOpenSprintMenuId(null); setDeleteSprintConfirmId(sprint.id); }}
                          className="w-full px-4 py-2.5 text-[13px] text-left text-error hover:bg-red-50 transition-colors"
                        >
                          Delete sprint
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sprint Body - Empty State */}
              {expandedSprints[sprint.id] && (
                <div className="border-t border-dashed border-outline-variant/60 p-6 flex flex-col items-center justify-center bg-surface-container-lowest min-h-[80px]">
                  <span className="material-symbols-outlined text-[28px] text-outline/50 mb-1">sprint</span>
                  <span className="text-[11px] text-outline italic">No tasks in this sprint yet. Drag tasks here or create new ones.</span>
                </div>
              )}

              {/* + Create button below sprint body */}
              {expandedSprints[sprint.id] && (
                <div className="px-4 py-2 border-t border-outline-variant/30 bg-white">
                  <button
                    onClick={() => setShowCreateModal && setShowCreateModal(true)}
                    className="flex items-center gap-1.5 text-outline hover:text-[#5e4db2] transition-colors group"
                  >
                    <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">add</span>
                    <span className="text-[12px] font-medium">Create</span>
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* TASK LIST / BACKLOG SECTION */}
          <div className="mt-4 flex flex-col gap-2" id="backlog-section">
            <div className="flex items-center justify-between bg-surface-container-low/30 p-2 rounded-t-lg border-x border-t border-outline-variant">
              <div className="flex items-center gap-3">
                <input type="checkbox" className="w-3.5 h-3.5 rounded border-outline-variant" />
                <span className="material-symbols-outlined text-[18px] text-outline cursor-pointer">expand_more</span>
                <span className="text-[12px] font-bold text-on-surface">Task list</span>
                <span className="text-[11px] text-outline">(0 work items)</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  <span className="px-1.5 py-0.5 bg-gray-200 text-[10px] font-bold rounded text-outline">0</span>
                  <span className="px-1.5 py-0.5 bg-[#ADC4FF] text-[10px] font-bold rounded text-[#003d9b]">0</span>
                  <span className="px-1.5 py-0.5 bg-[#C2FFD9] text-[10px] font-bold rounded text-[#006D3A]">0</span>
                </div>
                <button
                  onClick={handleCreateSprint}
                  className="px-3 py-1 bg-white border border-outline-variant rounded text-[11px] font-bold hover:bg-[#f0edff] hover:text-[#5e4db2] hover:border-[#e6e1ff] transition-colors shadow-sm"
                >
                  Create sprint
                </button>
              </div>
            </div>

            <div className="border border-dashed border-outline-variant rounded-b-lg p-6 flex flex-col items-center justify-center bg-surface-container-lowest">
              <span className="text-[11px] text-outline italic">Your task list is empty.</span>
            </div>

            <button
              onClick={() => setShowCreateModal && setShowCreateModal(true)}
              className="flex items-center gap-2 mt-1 px-1 text-outline hover:text-primary transition-colors group w-fit"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">
                add
              </span>
              <span className="text-[12px] font-medium">
                Create
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Popovers & Modals */}
      <SprintInfoPopover
        isOpen={isSprintInfoOpen}
        onClose={() => setIsSprintInfoOpen(false)}
        anchorRef={sprintInfoAnchorRef}
        completedTasksCount={tasks.filter(t => t.status === 'Done').length}
        openTasksCount={tasks.filter(t => t.status !== 'Done').length}
      />

      <CompleteSprintModal
        isOpen={isCompleteSprintOpen}
        onClose={() => setIsCompleteSprintOpen(false)}
        sprintName={sprint1Data.name}
        completedTasksCount={tasks.filter(t => t.status === 'Done').length}
        openTasksCount={tasks.filter(t => t.status !== 'Done').length}
      />

      <EditSprintModal
        isOpen={isEditSprintOpen}
        onClose={() => { setIsEditSprintOpen(false); setSprintToEdit(null); }}
        sprint={sprintToEdit}
        onUpdate={handleUpdateSprint}
      />

      {/* Delete Sprint Confirmation Popup */}
      {deleteSprintConfirmId && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40"
          onClick={() => setDeleteSprintConfirmId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-[350px] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-orange-600 text-xl">warning</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">Delete Sprint</h2>
                  <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                    Are you sure you want to delete{' '}
                    <strong className="text-[#121c2a]">
                      {deleteSprintConfirmId === 'sprint-1'
                        ? sprint1Data.name
                        : extraSprints.find(s => s.id === deleteSprintConfirmId)?.name || 'this sprint'}
                    </strong>?
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDeleteSprintConfirmId(null)}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (deleteSprintConfirmId !== 'sprint-1') {
                      handleDeleteExtraSprint(deleteSprintConfirmId);
                    } else {
                      setDeleteSprintConfirmId(null);
                    }
                  }}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <TaskDetailModal
        task={selectedTaskDetail}
        onClose={() => setSelectedTaskDetail(null)}
        tasks={tasks}
        currentRole={currentRole}
        currentUser={currentUser}
        onUpdateTask={(updatedTask) => {
          setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
          setSelectedTaskDetail(updatedTask);
        }}
      />

      <DeleteTaskModal
        isOpen={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleDeleteTask}
        task={taskToDelete}
      />
    </div>
  );
}

function KanbanColumn({ title, tasks, setTasks, onCreateTask, onOpenDetail, color = 'outline', currentRole }) {
  const headerClass = `bg-[#E0E8FF] border-[#ADC4FF] ${title === 'Need Revision' ? 'text-[#BA1A1A]' :
    title === 'Done' ? 'text-[#006D3A]' :
      title === 'Cancelled' ? 'text-[#475467]' :
        'text-[#003d9b]'
    }`;

  return (
    <div className="kanban-column group flex flex-col bg-[#F3F4FC] border border-outline-variant/50 rounded-xl p-2 min-w-[300px]" style={{ height: '100%', maxHeight: '100%', flex: '0 0 300px' }}>
      <div className={`flex justify-between items-center px-4 py-2 rounded-xl border-b-2 ${headerClass} mb-1`}>
        <span className="text-[11px] font-bold uppercase tracking-wider ">{title}</span>
      </div>
      <Droppable droppableId={title}>
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={`space-y-3 px-0.5 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
            style={{ flex: '1 1 0', minHeight: '50px', overflowY: 'auto', overflowX: 'visible', scrollbarWidth: 'thin' }}
          >
            {tasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} totalCount={tasks.length} setTasks={setTasks} onOpenDetail={onOpenDetail} currentRole={currentRole} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      <button
        onClick={onCreateTask}
        className="hidden group-hover:flex items-center gap-2 px-3 py-2 mt-2 text-outline hover:text-on-surface transition-all w-full rounded hover:bg-surface-container/50"
      >
        <span className="material-symbols-outlined text-[20px]">add</span>
        <span className="text-[13px] tracking-wide">Create</span>
      </button>
    </div>
  );
}

function TaskCard({ task, index, totalCount, setTasks, onOpenDetail, currentRole }) {
  const { id, title, date, pts, priority, status, attachments = [] } = task;
  const previewImage = attachments.find(att => att.type === 'image' && att.previewUrl)?.previewUrl;
  const [isEditing, setIsEditing] = React.useState(false);
  const [tempPts, setTempPts] = React.useState(pts);
  const [showMenu, setShowMenu] = React.useState(false);
  const [showAssigneeMenu, setShowAssigneeMenu] = React.useState(false);
  const [showMoveSubMenu, setShowMoveSubMenu] = React.useState(false);
  const [showStatusSubMenu, setShowStatusSubMenu] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const assigneeBtnRef = useRef(null);
  const assigneeMenuRef = useRef(null);

  const statuses = currentRole === 'ADMIN'
    ? ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done', 'Cancelled']
    : ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done'];

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)) {
        setShowMenu(false);
        setShowMoveSubMenu(false);
        setShowStatusSubMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    if (!showAssigneeMenu) return;
    const handleClickOutside = (e) => {
      if (assigneeMenuRef.current && !assigneeMenuRef.current.contains(e.target) &&
        assigneeBtnRef.current && !assigneeBtnRef.current.contains(e.target)) {
        setShowAssigneeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAssigneeMenu]);

  const handleMenuToggle = (e) => {
    e.stopPropagation();
    if (showMenu) {
      setShowMenu(false);
      setShowMoveSubMenu(false);
      setShowStatusSubMenu(false);
      return;
    }
    // Tính toán tọa độ fixed dựa trên vị trí nút ...
    const rect = btnRef.current.getBoundingClientRect();
    // Menu rộng 192px (w-48), ưu tiên mở sang trái nếu không đủ chỗ bên phải
    const menuWidth = 192;
    let left = rect.right - menuWidth;
    if (left < 8) left = rect.left;
    setMenuPos({ top: rect.bottom + 4, left });
    setShowMenu(true);
  };

  const handleMove = (direction) => {
    setTasks(prev => {
      const columnTasks = prev.filter(t => t.status === task.status);
      const globalIdx = prev.findIndex(t => t.id === task.id);
      if (globalIdx === -1) return prev;
      
      const colIdx = columnTasks.findIndex(t => t.id === task.id);
      let newPrev = [...prev];
      
      if (direction === 'up' && colIdx > 0) {
        const taskAbove = columnTasks[colIdx - 1];
        newPrev.splice(globalIdx, 1);
        const newAboveGlobalIdx = newPrev.findIndex(t => t.id === taskAbove.id);
        newPrev.splice(newAboveGlobalIdx, 0, task);
      } 
      else if (direction === 'down' && colIdx < columnTasks.length - 1) {
        const taskBelow = columnTasks[colIdx + 1];
        newPrev.splice(globalIdx, 1);
        const newBelowGlobalIdx = newPrev.findIndex(t => t.id === taskBelow.id);
        newPrev.splice(newBelowGlobalIdx + 1, 0, task);
      }
      else if (direction === 'top' && colIdx > 0) {
        const firstTask = columnTasks[0];
        newPrev.splice(globalIdx, 1);
        const newFirstGlobalIdx = newPrev.findIndex(t => t.id === firstTask.id);
        newPrev.splice(newFirstGlobalIdx, 0, task);
      }
      else if (direction === 'bottom' && colIdx < columnTasks.length - 1) {
        const lastTask = columnTasks[columnTasks.length - 1];
        newPrev.splice(globalIdx, 1);
        const newLastGlobalIdx = newPrev.findIndex(t => t.id === lastTask.id);
        newPrev.splice(newLastGlobalIdx + 1, 0, task);
      }
      
      return newPrev;
    });
    setShowMenu(false);
    setShowMoveSubMenu(false);
  };

  return (
    <Draggable draggableId={id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{ ...provided.draggableProps.style }}
          className={`relative bg-surface-container-lowest p-2.5 border border-outline-variant rounded shadow-sm hover:bg-surface-container-low transition-all group ${status === 'Cancelled' ? 'opacity-40' : 'group-hover:text-[#1E40AF]'} ${snapshot.isDragging ? 'shadow-xl ring-2 ring-primary/20 scale-[1.02] z-50' : ''}`}
          onClick={(e) => {
            if (e.defaultPrevented) return;
            onOpenDetail && onOpenDetail(task);
          }}
        >
          <div className="flex justify-between items-start mb-2 gap-2">
            <div className={`text-[11px] leading-snug flex items-center gap-1.5 flex-wrap ${status === 'Cancelled' ? 'font-normal text-outline' : 'font-medium text-[#003d9b] group-hover:text-blue-700 text-on-surface'}`}>
              {title}
              <span className="material-symbols-outlined text-[14px] text-outline opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-primary">edit</span>
            </div>
            <div>
              <button
                ref={btnRef}
                onClick={handleMenuToggle}
                className={`p-0.5 hover:bg-surface-container rounded cursor-pointer shrink-0 transition-opacity ${showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              >
                <span className="material-symbols-outlined text-[18px] text-outline">more_horiz</span>
              </button>
            </div>
          </div>

          {/* Portal Menu - nổi lên trên mọi thứ với position:fixed */}
          {showMenu && createPortal(
            <div
              ref={menuRef}
              style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
              className="bg-white border border-outline-variant shadow-2xl rounded-lg py-2 w-48"
            >
              {/* 1. Move work item */}
              {/* ĐÃ XÓA onMouseEnter VÀ onMouseLeave Ở ĐÂY */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoveSubMenu(!showMoveSubMenu);
                    setShowStatusSubMenu(false); // Bấm cái này thì đóng cái kia
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#E8EAF6] hover:text-[#003d9b] hover:font-bold transition-colors text-[13px] text-left ${showMoveSubMenu ? 'bg-[#E8EAF6] text-[#003d9b] font-bold' : 'text-on-surface'
                    }`}
                >
                  <span>Move work item</span>
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>

                {/* Menu con hiển thị khi showMoveSubMenu = true */}
                {showMoveSubMenu && (
                  <div
                    className="absolute top-0 left-full ml-2 bg-white border border-outline-variant shadow-2xl rounded-lg py-2 w-[160px]"
                    style={{ zIndex: 10000 }}
                  >
                    {index > 0 && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleMove('top'); }} className="w-full px-4 py-2.5 hover:bg-[#E8EAF6] hover:text-[#003d9b] hover:font-semibold transition-colors text-[13px] text-left text-on-surface">To the top</button>
                        <button onClick={(e) => { e.stopPropagation(); handleMove('up'); }} className="w-full px-4 py-2.5 hover:bg-[#E8EAF6] hover:text-[#003d9b] hover:font-semibold transition-colors text-[13px] text-left text-on-surface">Up</button>
                      </>
                    )}
                    {index < totalCount - 1 && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleMove('down'); }} className="w-full px-4 py-2.5 hover:bg-[#E8EAF6] hover:text-[#003d9b] hover:font-semibold transition-colors text-[13px] text-left text-on-surface">Down</button>
                        <button onClick={(e) => { e.stopPropagation(); handleMove('bottom'); }} className="w-full px-4 py-2.5 hover:bg-[#E8EAF6] hover:text-[#003d9b] hover:font-semibold transition-colors text-[13px] text-left text-on-surface">To the bottom</button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Change status */}
              {/* ĐÃ XÓA onMouseEnter VÀ onMouseLeave Ở ĐÂY */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStatusSubMenu(!showStatusSubMenu);
                    setShowMoveSubMenu(false); // Bấm cái này thì đóng cái kia
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#E8EAF6] hover:text-[#003d9b] hover:font-bold transition-colors text-[13px] text-left ${showStatusSubMenu ? 'bg-[#E8EAF6] text-[#003d9b] font-bold' : 'text-on-surface'
                    }`}
                >
                  <span>Change status</span>
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>

                {/* Submenu con hiển thị danh sách status (New, In Progress,...) */}
                {showStatusSubMenu && (
                  <div
                    className="absolute top-0 left-full ml-2 bg-white border border-outline-variant shadow-2xl rounded-lg py-2 w-[160px]"
                    style={{ zIndex: 10000 }}
                  >
                    {statuses.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTasks(prev => prev.map(t => t.id === id ? { ...t, status: s } : t));
                          setShowMenu(false);
                          setShowStatusSubMenu(false);
                        }}
                        className="w-full px-4 py-2.5 hover:bg-[#E8EAF6] hover:text-[#003d9b] hover:font-semibold transition-colors text-[13px] text-left text-on-surface"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>,
            document.body
          )}


          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-surface-container text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px]">calendar_month</span>
              <span className="text-[11px] font-semibold">{date}</span>
            </div>
          </div>
          {previewImage ? (
            <div className="mb-3 overflow-hidden rounded-xl">
              <img src={previewImage} alt={`Preview for ${title}`} className="w-full h-28 object-cover rounded-xl" />
            </div>
          ) : null}
          <div className="flex justify-between items-center mt-auto">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] text-outline font-bold uppercase ${status === 'Done' ? 'line-through' : ''}`}>{id}</span>
              {!isEditing ? (
                <span
                  className="px-1 py-0.5 bg-surface-container rounded-sm text-[9px] font-bold text-outline cursor-pointer hover:bg-primary/10 hover:text-primary"
                  onClick={() => setIsEditing(true)}
                >
                  {pts} pts
                </span>
              ) : (
                <div className="flex flex-col gap-1 bg-white border border-primary rounded p-1 shadow-lg absolute z-20 -translate-y-2 translate-x-12">
                  <input
                    type="number"
                    className="w-12 h-6 text-[11px] border border-outline-variant rounded px-1 outline-none focus:border-primary"
                    value={tempPts}
                    onChange={(e) => setTempPts(parseInt(e.target.value))}
                    autoFocus
                  />
                  <div className="flex justify-between border-t border-outline-variant pt-1 mt-1">
                    <button className="hover:bg-green-100 rounded p-0.5" onClick={() => setIsEditing(false)}>
                      <span className="material-symbols-outlined text-[14px] text-green-600">done</span>
                    </button>
                    <button className="hover:bg-red-100 rounded p-0.5" onClick={() => setIsEditing(false)}>
                      <span className="material-symbols-outlined text-[14px] text-red-600">close</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 relative">
              {priority === 'High' ? (
                <span className="material-symbols-outlined text-[#BA1A1A] text-[20px] font-bold">keyboard_arrow_up</span>
              ) : priority === 'Medium' ? (
                <span className="material-symbols-outlined text-orange-500 text-[20px] font-bold">keyboard_double_arrow_up</span>
              ) : (
                <span className="material-symbols-outlined text-[#4C2B74] text-[20px] font-bold">keyboard_arrow_down</span>
              )}
              <button
                ref={assigneeBtnRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAssigneeMenu(prev => !prev);
                }}
                className="w-6 h-6 rounded-full border border-outline-variant flex items-center justify-center text-[10px] font-bold"
                style={{ backgroundColor: getAssigneeProfile(task.assignee).color, color: getAssigneeProfile(task.assignee).textColor || '#111' }}
              >
                {getAssigneeProfile(task.assignee).initials || <span className="material-symbols-outlined">person</span>}
              </button>
              {showAssigneeMenu && (
                <div
                  ref={assigneeMenuRef}
                  className="absolute right-0 top-full mt-2 w-40 bg-white border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {availableAssignees.map(user => (
                    <button
                      key={user.name}
                      type="button"
                      onClick={() => {
                        setTasks(prev => prev.map(t => t.id === id ? { ...t, assignee: user.name === 'Unassigned' ? '' : user.name } : t));
                        setShowAssigneeMenu(false);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 text-[11px] text-left hover:bg-[#EBF0FF] transition-colors"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
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
        </div>
      )}
    </Draggable>
  );
}

function TaskRow({ id, title, assignee, pts, status, date, priority, isSelected, isAnySelected, onToggle, onOpenDetail, onDelete, onUpdateAssignee, isAdmin = true }) {
  const statusClass = status === 'Need Revision'
    ? 'bg-[#FFF0F0] text-[#BA1A1A]'
    : status === 'Done'
      ? 'bg-[#E6FFF0] text-[#006D3A]'
      : status === 'Cancelled' || status === 'New'
        ? 'bg-[#F2F4F7] text-[#475467]'
        : 'bg-[#E0E8FF] text-[#003d9b]';

  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const assigneeBtnRef = useRef(null);
  const assigneeMenuRef = useRef(null);

  useEffect(() => {
    if (!showAssigneeMenu) return;
    const handleClickOutside = (e) => {
      if (assigneeMenuRef.current && !assigneeMenuRef.current.contains(e.target) &&
        assigneeBtnRef.current && !assigneeBtnRef.current.contains(e.target)) {
        setShowAssigneeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAssigneeMenu]);

  return (
    <tr
      className={`hover:bg-surface-container-low/50 transition-colors cursor-pointer ${isSelected ? 'bg-[#e6f0ff]' : ''}`}
      onClick={() => onOpenDetail && onOpenDetail()}
    >
      <td className="px-2 py-2">
        <div className="flex items-center justify-center gap-3">
          <input
            type="checkbox"
            className={`w-3.5 h-3.5 rounded border-outline-variant cursor-pointer accent-primary transition-opacity ${isAnySelected ? 'visible' : 'invisible'}`}
            checked={isSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          />
          <span className="text-[11px] font-medium text-outline">{id}</span>
          <span className="px-1 py-0.5 bg-surface-container rounded text-[9px] font-bold text-outline">{pts}</span>
        </div>
      </td>
      <td className={`px-4 py-2 font-semibold text-[11px] ${isSelected ? 'text-blue-700' : 'text-on-surface'}`}>{title}</td>
      <td className="px-4 py-2">
        <div className="relative inline-flex items-center">
          {(() => {
            const profile = getAssigneeProfile(assignee);
            return (
              <div className="relative">
                <button
                  ref={assigneeBtnRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAssigneeMenu(prev => !prev);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-white px-2 py-1 text-[11px] hover:bg-[#F4F5F7] transition-colors"
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ backgroundColor: profile.color, color: profile.textColor || '#111' }}
                  >
                    {profile.initials}
                  </div>
                  <span>{assignee || 'Unassigned'}</span>
                </button>
                {showAssigneeMenu && (
                  <div
                    ref={assigneeMenuRef}
                    className="absolute left-0 top-full mt-2 w-44 bg-white border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {availableAssignees.map(user => (
                      <button
                        key={user.name}
                        type="button"
                        onClick={() => {
                          onUpdateAssignee && onUpdateAssignee(user.name === 'Unassigned' ? '' : user.name);
                          setShowAssigneeMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] hover:bg-[#EBF0FF] transition-colors"
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
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
            );
          })()}
        </div>
      </td>
      <td className="px-4 py-2 text-center">
        {priority === 'High' ? (
          <span className="material-symbols-outlined text-[#BA1A1A] font-bold text-[16px]">keyboard_arrow_up</span>
        ) : priority === 'Medium' ? (
          <span className="material-symbols-outlined text-orange-500 font-bold text-[16px]">keyboard_double_arrow_up</span>
        ) : (
          <span className="material-symbols-outlined text-[#4C2B74] font-bold text-[16px]">keyboard_arrow_down</span>
        )}
      </td>
      <td className="px-4 py-2">
        <span className={`px-3 py-1 rounded-full ${statusClass} text-[9px] font-bold uppercase`}>{status}</span>
      </td>
      <td className="px-4 py-2 text-[11px] text-outline">{date}</td>
      {isAdmin && (
        <td className="px-4 py-2 text-center">
          <span
            onClick={(e) => {
              e.stopPropagation();
              onDelete && onDelete();
            }}
            className="material-symbols-outlined text-outline hover:text-error cursor-pointer text-[16px]"
          >
            delete
          </span>
        </td>
      )}
    </tr>
  );
}
