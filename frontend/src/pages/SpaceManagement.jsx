import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import CreateSpaceModal from '../components/tasks/CreateSpaceModal';
 
const SpaceManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentRole = 'ADMIN', currentUser = null } = useOutletContext() || {};
  const isAdmin = currentRole === 'ADMIN';
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('Recently Created');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
 
  // Sample data based on image
  const spaces = [
    {
      id: 'SP-001',
      title: 'Task Management System',
      description: 'Final project for task management system integration with enterprise...',
      tasksCount: 25,
      date: '2026-06-01',
      status: 'Active',
      assignedUsers: ['admin-demo-user', '8ce04f65-ea2c-4279-8350-7c1f0e81c9f5']
    },
    {
      id: 'SP-002',
      title: 'E-Commerce Platform',
      description: 'Headless commerce rebuild with Next.js and high-performance API...',
      tasksCount: 18,
      date: '2026-05-15',
      status: 'Active',
      assignedUsers: ['admin-demo-user', '8ce04f65-ea2c-4279-8350-7c1f0e81c9f5']
    },
    {
      id: 'SP-003',
      title: 'CRM System',
      description: 'Legacy customer relationship management maintenance and data...',
      tasksCount: 12,
      date: '2026-04-20',
      status: 'Archived',
      assignedUsers: ['admin-demo-user']
    }
  ];
 
  const filteredAndSortedSpaces = spaces
    .filter(space => {
      const matchesSearch = space.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        space.description.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (selectedDate) {
        const spaceDate = new Date(space.date);
        return spaceDate.getFullYear() === selectedDate.getFullYear() &&
               spaceDate.getMonth() === selectedDate.getMonth() &&
               spaceDate.getDate() === selectedDate.getDate();
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'Alpha-numeric') {
        return a.title.localeCompare(b.title);
      }
      if (sortOrder === 'Oldest') {
        return new Date(a.date) - new Date(b.date);
      }
      // Recently Created
      return new Date(b.date) - new Date(a.date);
    });
 
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, []);
 
  return (
    <div className="px-6 pb-6 pt-10 bg-[#F5F7FA] min-h-full">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
          <div>
          <h1 className="text-2xl font-bold text-[#4C2B74]">Space Management</h1>
          <p className="text-gray-500 text-sm">Manage and organize your team's project ecosystems.</p>
          </div>
        {isAdmin && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#4C2B74] text-white px-4 py-2 rounded-lg flex items-center text-sm font-semibold hover:bg-opacity-90 transition-all shadow-md active:scale-95"
          >
            <i data-lucide="plus" className="w-4 h-4 mr-2"></i>
            Create Space
          </button>
        )}
        </div>
 
      {/* Search and Filter Section */}
      <div className="bg-white p-5 rounded-lg border border-outline-variant shadow-sm mb-8 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-outline uppercase mb-1.5 ml-0.5">Search Spaces</label>
          <div className="relative flex items-center">
            <i data-lucide="search" className="w-4 h-4 absolute left-3 text-outline"></i>
            <input
              type="text"
              placeholder="Search by name or description..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-outline-variant rounded text-[11px] outline-none focus:ring-2 focus:ring-[#4C2B74] focus:border-[#4C2B74] transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="w-43">
          <div className="relative group">
            <button className="w-full flex items-center justify-between px-3 py-1.5 bg-white border border-outline-variant rounded hover:bg-surface-container transition-colors shadow-sm cursor-pointer hover:border-[#5e4db2] group-hover:border-[#5e4db2]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#5e4db2] text-[18px]">calendar_month</span>
                <span className="text-[11px] font-bold text-[#5e4db2]">
                  {selectedDate ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date'}
                </span>
              </div>
              <span className="material-symbols-outlined text-outline text-[16px]">expand_more</span>
            </button>
 
            {/* Calendar Dropdown */}
            <div className="absolute top-full right-0 mt-2 w-[280px] bg-white border border-outline-variant rounded-xl shadow-2xl hidden group-hover:block z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
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
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
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
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
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
                        className={`h-7 w-7 flex items-center justify-center rounded-lg text-[10px] transition-all ${isSelected
                          ? 'bg-[#5e4db2] text-white font-bold shadow-sm scale-110'
                          : isToday
                            ? 'border border-[#5e4db2] text-[#5e4db2] font-semibold'
                            : 'hover:bg-[#f0edff] hover:text-[#5e4db2] text-on-surface'
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
 
      {/* Grid of Space Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedSpaces.map(space => {
          const isAssigned = isAdmin || (space.assignedUsers && space.assignedUsers.includes(currentUser?.id));
          return (
            <div key={space.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
              <div className="p-6 flex-1">
                <h3 className="text-[15px] font-bold text-[#5e4db2] mb-2">{space.title}</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed mb-6">{space.description}</p>
   
                <div className="flex items-center gap-6 text-gray-500">
                  <div className="flex items-center">
                    <i data-lucide="check-circle-2" className="w-4 h-4 mr-2 text-[#4C2B74]"></i>
                    <span className="text-[12px] font-medium">{space.tasksCount} Tasks</span>
                  </div>
                  <div className="flex items-center">
                    <i data-lucide="calendar" className="w-4 h-4 mr-2 text-[#4C2B74]"></i>
                    <span className="text-[12px] font-medium">{space.date}</span>
                  </div>
                </div>
              </div>
   
              <div className="p-4 bg-gray-50/50 border-t border-gray-100">
                <button
                  disabled={!isAssigned}
                  onClick={() => {
                    if (isAssigned) {
                      navigate(`/dashboard/tasks/${space.id}${location.search}`);
                    }
                  }}
                  className={`w-full py-2.5 rounded-lg font-bold text-[12px] transition-all shadow-sm ${
                    !isAssigned
                      ? 'bg-[#f0edff] text-[#5e4db2] border border-[#e6e1ff] opacity-50 cursor-not-allowed'
                      : space.status === 'Active'
                        ? 'bg-[#4C2B74] text-white hover:bg-[#3D225E]'
                        : 'bg-[#f0edff] text-[#5e4db2] border border-[#e6e1ff] hover:bg-[#e6e1ff]'
                  }`}
                >
                  View Tasks
                </button>
              </div>
            </div>
          );
        })}
      </div>
 
      <CreateSpaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={(data) => {
          console.log('New Space Data:', data);
          // Handle space creation logic here
        }}
      />
    </div>
  );
};
 
export default SpaceManagement;
 
 