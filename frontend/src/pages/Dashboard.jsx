import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';


const userActivities = [
  {
    user: "You",
    initials: "Y",
    avatarColor: "#4C2B74",
    textColor: "white",
    action: "updated status to",
    status: "in_progress",
    statusColor: "bg-blue-50 text-blue-700 border-blue-100",
    target: "SCRUM-13: Design Base Layout",
    time: "2026-06-25 10:45:00",
    labelTitle: "Task",
    group: "Today"
  },
  {
    user: "Trang Nguyễn",
    initials: "TN",
    avatarColor: "#10b981",
    textColor: "white",
    action: "created",
    status: "new",
    statusColor: "bg-gray-100 text-gray-700 border-gray-200",
    target: "SCRUM-12: Design Attachment Section",
    time: "2 hours ago",
    labelTitle: "Task",
    group: "Today"
  },
  {
    user: "Hoa Phan",
    initials: "HP",
    avatarColor: "#3b82f6",
    textColor: "white",
    action: "commented on",
    status: "pending_review",
    statusColor: "bg-amber-50 text-amber-700 border-amber-100",
    target: "SCRUM-5: Product Detail Page",
    time: "5 hours ago",
    labelTitle: "Task",
    group: "Today"
  },
  {
    user: "You",
    initials: "Y",
    avatarColor: "#4C2B74",
    textColor: "white",
    action: "completed",
    status: "done",
    statusColor: "bg-green-50 text-green-700 border-green-100",
    target: "SCRUM-1: Design Login Page",
    time: "1 day ago",
    labelTitle: "Task",
    group: "Yesterday"
  },
  {
    user: "Trang Nguyễn",
    initials: "TN",
    avatarColor: "#10b981",
    textColor: "white",
    action: "updated field \"Priority\" on",
    status: "need_revision",
    statusColor: "bg-red-50 text-red-700 border-red-100",
    target: "SCRUM-7: Task Detail Screen",
    time: "1 day ago",
    labelTitle: "Task",
    group: "Yesterday"
  }
];

const adminActivities = [
  {
    user: "John Doe",
    initials: "JD",
    avatarColor: "#3525cd",
    textColor: "white",
    action: "created user",
    status: "USER",
    statusColor: "bg-blue-50 text-blue-700 border-blue-100",
    time: "2026-06-25 09:15:00",
    labelTitle: "User",
    group: "Today"
  },
  {
    user: "Sarah Lee",
    initials: "SL",
    avatarColor: "#ff0080",
    textColor: "white",
    action: "updated task",
    status: "TASK",
    statusColor: "bg-teal-50 text-teal-700 border-teal-100",
    time: "2026-06-25 09:10:00",
    labelTitle: "Task",
    group: "Today"
  },
  {
    user: "System Bot",
    initials: "SB",
    avatarColor: "#4648d4",
    textColor: "white",
    action: "refreshed token",
    status: "TOKEN",
    statusColor: "bg-slate-100 text-slate-700 border-slate-200",
    time: "2026-06-25 09:02:00",
    labelTitle: "Token",
    group: "Today"
  },
  {
    user: "Emma Wilson",
    initials: "EW",
    avatarColor: "#a44100",
    textColor: "white",
    action: "uploaded file",
    status: "ATTACHMENT",
    statusColor: "bg-blue-50 text-blue-700 border-blue-100",
    time: "2026-06-25 08:58:00",
    labelTitle: "Attachment",
    group: "Yesterday"
  },
  {
    user: "Michael Chen",
    initials: "MC",
    avatarColor: "#718096",
    textColor: "white",
    action: "performed session login",
    status: "SESSION",
    statusColor: "bg-slate-100 text-slate-700 border-slate-200",
    time: "2026-06-25 08:45:00",
    labelTitle: "Session",
    group: "Yesterday"
  },
  {
    user: "John Doe",
    initials: "JD",
    avatarColor: "#3525cd",
    textColor: "white",
    action: "created user",
    status: "USER",
    statusColor: "bg-blue-50 text-blue-700 border-blue-100",
    time: "2026-06-24 16:30:00",
    labelTitle: "User",
    group: "Yesterday"
  },
  {
    user: "Sarah Lee",
    initials: "SL",
    avatarColor: "#ff0080",
    textColor: "white",
    action: "deleted comment",
    status: "COMMENT",
    statusColor: "bg-red-50 text-red-700 border-red-100",
    time: "2026-06-23 11:24:00",
    labelTitle: "Comment",
    group: "Yesterday"
  },
  {
    user: "Emma Wilson",
    initials: "EW",
    avatarColor: "#a44100",
    textColor: "white",
    action: "updated task",
    status: "TASK",
    statusColor: "bg-teal-50 text-teal-700 border-teal-100",
    time: "2026-06-20 14:15:00",
    labelTitle: "Task",
    group: "Yesterday"
  },
  {
    user: "Michael Chen",
    initials: "MC",
    avatarColor: "#718096",
    textColor: "white",
    action: "performed session login",
    status: "SESSION",
    statusColor: "bg-slate-100 text-slate-700 border-slate-200",
    time: "2026-06-18 07:12:00",
    labelTitle: "Session",
    group: "Yesterday"
  },
  {
    user: "John Doe",
    initials: "JD",
    avatarColor: "#3525cd",
    textColor: "white",
    action: "updated task",
    status: "TASK",
    statusColor: "bg-teal-50 text-teal-700 border-teal-100",
    time: "2026-06-15 10:00:00",
    labelTitle: "Task",
    group: "Yesterday"
  }
];

const auditLogsData = [
  {
    id: "AL-02340",
    user: "John Doe",
    initials: "JD",
    avatarBg: "#3525cd",
    role: "Admin",
    event: "Created User",
    labelTitle: "User",
    createdAt: "2026-06-25 09:15:00",
    payload: {
      log_id: "AL-02340",
      user_id: "USR-102",
      action: "CREATE_USER",
      labelTitle: "USER",
      entity_id: "UID-9902",
      payload: {
        email: "new.user@example.com",
        role: "Admin",
        status: "active"
      },
      created_at: "2026-06-25 09:15:00"
    }
  },
  {
    id: "AL-02341",
    user: "Sarah Lee",
    initials: "SL",
    avatarBg: "#ff0080",
    role: "User",
    event: "Updated Task",
    labelTitle: "Task",
    createdAt: "2026-06-25 09:10:00",
    payload: {
      log_id: "AL-02341",
      user_id: "USR-105",
      action: "UPDATE_TASK",
      labelTitle: "TASK",
      entity_id: "TSK-5541",
      payload: {
        title: "API Documentation",
        status: "in_progress",
        priority: "High"
      },
      created_at: "2026-06-25 09:10:00"
    }
  },
  {
    id: "AL-02342",
    user: "System Bot",
    initials: "SB",
    avatarBg: "#4648d4",
    role: "User",
    event: "Refreshed Token",
    labelTitle: "Token",
    createdAt: "2026-06-25 09:02:00",
    payload: {
      log_id: "AL-02342",
      user_id: "SYS-BOT",
      action: "REFRESH_TOKEN",
      labelTitle: "TOKEN",
      entity_id: "TOK-REF-8",
      payload: {
        token_type: "refresh",
        status: "success"
      },
      created_at: "2026-06-25 09:02:00"
    }
  },
  {
    id: "AL-02343",
    user: "Emma Wilson",
    initials: "EW",
    avatarBg: "#a44100",
    role: "User",
    event: "Uploaded File",
    labelTitle: "Attachment",
    createdAt: "2026-06-25 08:58:00",
    payload: {
      log_id: "AL-02343",
      user_id: "USR-108",
      action: "UPLOAD_FILE",
      labelTitle: "ATTACHMENT",
      entity_id: "ATT-992",
      payload: {
        file_name: "invoice_q1_final.pdf",
        size: "2.4 MB",
        mime_type: "application/pdf"
      },
      created_at: "2026-06-25 08:58:00"
    }
  },
  {
    id: "AL-02344",
    user: "Michael Chen",
    initials: "MC",
    avatarBg: "#777587",
    role: "User",
    event: "Session Login",
    labelTitle: "Session",
    createdAt: "2026-06-25 08:45:00",
    payload: {
      log_id: "AL-02344",
      user_id: "USR-112",
      action: "SESSION_LOGIN",
      labelTitle: "SESSION",
      entity_id: "SES-883",
      payload: {
        browser: "Chrome",
        os: "MacOS",
        device: "Desktop"
      },
      created_at: "2026-06-25 08:45:00"
    }
  },
  {
    id: "AL-02345",
    user: "John Doe",
    initials: "JD",
    avatarBg: "#3525cd",
    role: "Admin",
    event: "Create User",
    labelTitle: "User",
    createdAt: "2026-06-24 16:30:00",
    payload: {
      log_id: "AL-02345",
      user_id: "USR-102",
      action: "CREATE_USER",
      labelTitle: "USER",
      entity_id: "UID-9903",
      payload: {
        email: "another.user@example.com",
        role: "User",
        status: "active"
      },
      created_at: "2026-06-24 16:30:00"
    }
  },
  {
    id: "AL-02346",
    user: "Sarah Lee",
    initials: "SL",
    avatarBg: "#ff0080",
    role: "User",
    event: "Delete Comment",
    labelTitle: "Comment",
    createdAt: "2026-06-23 11:24:00",
    payload: {
      log_id: "AL-02346",
      user_id: "USR-105",
      action: "DELETE_COMMENT",
      labelTitle: "COMMENT",
      entity_id: "COM-104",
      payload: {
        comment_id: "COM-104",
        task_id: "TSK-5541",
        author: "Sarah Lee"
      },
      created_at: "2026-06-23 11:24:00"
    }
  },
  {
    id: "AL-02347",
    user: "Emma Wilson",
    initials: "EW",
    avatarBg: "#a44100",
    role: "User",
    event: "Update Task",
    labelTitle: "Task",
    createdAt: "2026-06-20 14:15:00",
    payload: {
      log_id: "AL-02347",
      user_id: "USR-108",
      action: "UPDATE_TASK",
      labelTitle: "TASK",
      entity_id: "TSK-2291",
      payload: {
        title: "Database Migration",
        status: "done"
      },
      created_at: "2026-06-20 14:15:00"
    }
  },
  {
    id: "AL-02349",
    user: "John Doe",
    initials: "JD",
    avatarBg: "#3525cd",
    role: "Admin",
    event: "Update Task",
    labelTitle: "Task",
    createdAt: "2026-06-15 10:00:00",
    payload: {
      log_id: "AL-02349",
      user_id: "USR-102",
      action: "UPDATE_TASK",
      labelTitle: "TASK",
      entity_id: "TSK-3382",
      payload: {
        title: "Refactor Auth Middleware",
        status: "in_review"
      },
      created_at: "2026-06-15 10:00:00"
    }
  },
  {
    id: "AL-02348",
    user: "Michael Chen",
    initials: "MC",
    avatarBg: "#777587",
    role: "User",
    event: "Session Login",
    labelTitle: "Session",
    createdAt: "2026-06-18 07:12:00",
    payload: {
      log_id: "AL-02348",
      user_id: "USR-112",
      action: "SESSION_LOGIN",
      labelTitle: "SESSION",
      entity_id: "SES-884",
      payload: {
        browser: "Safari",
        os: "iOS",
        device: "Mobile"
      },
      created_at: "2026-06-18 07:12:00"
    }
  }
];

const userStats = [
  { icon: 'assignment', label: 'Total Tasks', value: 47, colorClass: 'text-[#2d1b4e]', gradientClass: 'gradient-purple', delay: '0.1s' },
  { icon: 'check_circle', label: 'Completed Tasks', value: 28, colorClass: 'text-green-600', gradientClass: 'gradient-green', delay: '0.2s' },
  { icon: 'sync', label: 'In Progress', value: 10, colorClass: 'text-blue-600', gradientClass: 'gradient-blue', delay: '0.3s' },
  { icon: 'warning', label: 'Overdue Tasks', value: 4, colorClass: 'text-red-600', gradientClass: 'gradient-red', delay: '0.4s' }
];

const adminStats = [
  { icon: 'group', label: 'Total Users', value: 156, colorClass: 'text-indigo-600', gradientClass: 'gradient-indigo', delay: '0.05s' },
  { icon: 'assignment', label: 'Total Tasks', value: 882, colorClass: 'text-[#2d1b4e]', gradientClass: 'gradient-purple', delay: '0.1s' },
  { icon: 'check_circle', label: 'Completed Tasks', value: 612, colorClass: 'text-green-600', gradientClass: 'gradient-green', delay: '0.2s' },
  { icon: 'sync', label: 'In Progress', value: 184, colorClass: 'text-blue-600', gradientClass: 'gradient-blue', delay: '0.3s' },
  { icon: 'warning', label: 'Overdue Tasks', value: 46, colorClass: 'text-red-600', gradientClass: 'gradient-red', delay: '0.4s' }
];

const userViewedTasks = [
  { title: "Design Task List Screen", subtitle: "SCRUM-7", icon: "check_box", type: "task", group: "Today" },
  { title: "SCRUM board", subtitle: "Board", icon: "dashboard", type: "board", group: "Today" },
  { title: "Design Base Layout", subtitle: "SCRUM-13", icon: "check_box", type: "task", group: "Today" },
  { title: "Design Task Assignment History Screen", subtitle: "SCRUM-17", icon: "check_box", type: "task", group: "Yesterday" }
];

const userWorkedOnTasks = [
  { title: "Design Dashboard Screen - Admin Dashboard and Design Global Search on Header (Main Layout)", subtitle: "SCRUM-14 · Task Management System", status: "in_progress", group: "TODAY", time: "2H AGO" },
  { title: "Design Base Layout (Header & Navigation Menu) and User Dashboard", subtitle: "SCRUM-13 · Task Management System", status: "in_progress", group: "YESTERDAY", time: "1D AGO" },
  { title: "Design Notifications Screen", subtitle: "SCRUM-16 · Task Management System", status: "new", group: "IN THE LAST WEEK", time: "3D AGO" },
  { title: "Design Task Assignment History Screen and Audit Logs Screen", subtitle: "SCRUM-17 · Task Management System", status: "done", group: "IN THE LAST WEEK", time: "5D AGO" },
  { title: "Design Task Assignees Screen", subtitle: "SCRUM-15 · Task Management System", status: "in_testing", group: "IN THE LAST WEEK", time: "6D AGO" }
];

const adminViewedTasks = [
  { title: "User Management Module", subtitle: "ADM-5", icon: "group", type: "task", group: "Today" },
  { title: "Audit Logs Dashboard", subtitle: "ADM-10", icon: "security", type: "task", group: "Today" },
  { title: "Role Permission Settings", subtitle: "ADM-12", icon: "lock", type: "task", group: "Yesterday" },
  { title: "Security Settings", subtitle: "ADM-15", icon: "shield", type: "task", group: "Yesterday" }
];

const userAssignedTasks = [
  { title: "Design Dashboard Screen - Admin Dashboard and Design Global Search on Header (Main Layout)", subtitle: "SCRUM-14 · Task Management System", status: "In Progress", group: "IN PROGRESS" },
  { title: "Design Base Layout (Header & Navigation Menu) and User Dashboard", subtitle: "SCRUM-13 · Task Management System", status: "In Review", group: "IN REVIEW" },
  { title: "Design Task Assignment History Screen and Audit Logs Screen", subtitle: "SCRUM-17 · Task Management System", status: "To Do", group: "TO DO" },
  { title: "Design Notifications Screen", subtitle: "SCRUM-16 · Task Management System", status: "To Do", group: "TO DO" },
  { title: "Design Task Assignees Screen", subtitle: "SCRUM-15 · Task Management System", status: "To Do", group: "TO DO" }
];

const adminWorkedOnTasks = [
  {
    title: "Review Security Audit Report",
    subtitle: "ADM-101 · Security Module",
    status: "in_testing",
    group: "TODAY",
    operation: "Security Logs",
    time: "15M AGO",
    assignees: [
      { name: "Hoa Phan", initials: "HP", color: "#4C2B74" },
      { name: "Trang Nguyen", initials: "TN", color: "#10b981" },
      { name: "Admin", initials: "AD", color: "#4f46e5" }
    ]
  },
  {
    title: "Configure Permission Matrix",
    subtitle: "ADM-102 · Permissions",
    status: "in_progress",
    group: "YESTERDAY",
    operation: "Permissions",
    time: "1D AGO",
    assignees: [
      { name: "Trang Nguyen", initials: "TN", color: "#10b981" },
      { name: "Hoa Phan", initials: "HP", color: "#4C2B74" }
    ]
  },
  {
    title: "Onboard New Engineering Team",
    subtitle: "ADM-103 · User Management",
    status: "done",
    group: "TODAY",
    operation: "User Management",
    time: "4H AGO",
    assignees: [
      { name: "Admin", initials: "AD", color: "#4f46e5" },
      { name: "Trang Nguyen", initials: "TN", color: "#10b981" }
    ]
  },
  {
    title: "Audit DB Access Tokens",
    subtitle: "ADM-104 · Security Logs",
    status: "in_review",
    group: "TODAY",
    operation: "Security Logs",
    time: "6H AGO",
    assignees: [
      { name: "Hoa Phan", initials: "HP", color: "#4C2B74" }
    ]
  },
  {
    title: "Update Global Policy",
    subtitle: "ADM-105 · Permissions",
    status: "new",
    group: "YESTERDAY",
    operation: "Permissions",
    time: "1D AGO",
    assignees: [
      { name: "Admin", initials: "AD", color: "#4f46e5" }
    ]
  },
  {
    title: "Batch User Deletion - Inactive",
    subtitle: "ADM-106 · User Management",
    status: "done",
    group: "IN THE LAST WEEK",
    operation: "User Management",
    time: "3D AGO",
    assignees: [
      { name: "Hoa Phan", initials: "HP", color: "#4C2B74" },
      { name: "Trang Nguyen", initials: "TN", color: "#10b981" }
    ]
  },
  {
    title: "Review Security Audit Report",
    subtitle: "ADM-107 · User Management",
    status: "in_progress",
    group: "TODAY",
    operation: "User Management",
    time: "2H AGO",
    assignees: [
      { name: "Admin", initials: "AD", color: "#4f46e5" },
      { name: "Hoa Phan", initials: "HP", color: "#4C2B74" },
      { name: "Trang Nguyen", initials: "TN", color: "#10b981" }
    ]
  },
  {
    title: "Update User Access Level",
    subtitle: "ADM-108 · User Management",
    status: "in_review",
    group: "YESTERDAY",
    operation: "User Management",
    time: "1D AGO",
    assignees: [
      { name: "Trang Nguyen", initials: "TN", color: "#10b981" },
      { name: "Alice Blue", initials: "AB", color: "#3b82f6" },
      { name: "Bob Red", initials: "BR", color: "#ef4444" },
      { name: "Charlie Green", initials: "CG", color: "#10b981" }
    ]
  }
];




const adminAssignedTasks = [
  { title: "User Assignment - Alice to SCRUM-13", subtitle: "HIST-001", status: "done", group: "Assignment" },
  { title: "Role Change - Bob to Developer", subtitle: "HIST-002", status: "done", group: "Role" },
  { title: "New Task - SCRUM-14 Created", subtitle: "HIST-003", status: "done", group: "System" }
];

const userStatusData = [
  { label: 'Done', count: 28, color: '#4C2B74', dash: 59.6, offset: 0, tPos: { left: '95%', top: '35%' } },
  { label: 'In Progress', count: 10, color: '#3b82f6', dash: 21.3, offset: -59.6, tPos: { left: '10%', top: '25%' } },
  { label: 'New', count: 5, color: '#10b981', dash: 10.6, offset: -80.9, tPos: { left: '20%', top: '5%' } },
  { label: 'Overdue', count: 4, color: '#9d2a2aff', dash: 8.5, offset: -91.5, tPos: { left: '45%', top: '-2%' } }
];

const adminStatusData = [
  { label: 'Done', count: 612, color: '#4C2B74', dash: 69.4, offset: 0, tPos: { left: '95%', top: '35%' } },
  { label: 'In Progress', count: 184, color: '#3b82f6', dash: 20.9, offset: -69.4, tPos: { left: '10%', top: '25%' } },
  { label: 'New', count: 40, color: '#10b981', dash: 4.5, offset: -90.3, tPos: { left: '25%', top: '5%' } },
  { label: 'Overdue', count: 46, color: '#ff4d4d', dash: 5.2, offset: -94.8, tPos: { left: '50%', top: '10%' } }
];

const teamWorkloadData = [
  { name: "Phạm Thị Cẩm Tiên", initials: "PT", color: "#ef4444", percentage: 35, tasks: 6, total: 17, avatar: null },
  { name: "Hồng Hoa", initials: "HH", color: "#06b6d4", percentage: 29, tasks: 5, total: 17, avatar: null },
  { name: "Trang Nguyễn", initials: "TN", color: "#10b981", percentage: 29, tasks: 5, total: 17, avatar: null },
  { name: "Unassigned", initials: null, color: "#d1d5db", percentage: 7, tasks: 1, total: 17, avatar: "person" }
];

const userAccountData = [
  { label: "Active Users", count: 120, total: 156, percentage: 77, color: "#10b981", gradient: "linear-gradient(90deg, #10b981 0%, #34d399 100%)", glow: "rgba(16, 185, 129, 0.2)", icon: "check_circle" },
  { label: "Pending Verification", count: 11, total: 156, percentage: 7, color: "#f59e0b", gradient: "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)", glow: "rgba(245, 158, 11, 0.2)", icon: "pending" },
  { label: "Locked Accounts", count: 5, total: 156, percentage: 3, color: "#ef4444", gradient: "linear-gradient(90deg, #ef4444 0%, #f87171 100%)", glow: "rgba(239, 68, 68, 0.2)", icon: "lock" },
  { label: "Inactive Users", count: 20, total: 156, percentage: 13, color: "#64748b", gradient: "linear-gradient(90deg, #64748b 0%, #94a3b8 100%)", glow: "rgba(100, 116, 139, 0.1)", icon: "person_off" }
];





// Reusable Sub-components for cleaner structure
const StatCard = ({ icon, label, value, colorClass, gradientClass, delay }) => (
  <div className={`${gradientClass} p-6 rounded-2xl border border-white shadow-sm flex items-center gap-4 interactive-card animate-card`} style={{ animationDelay: delay }}>
    <div className={`w-12 h-12 rounded-xl bg-white/60 flex items-center justify-center ${colorClass} shadow-sm`}>
      <span className="material-symbols-outlined text-[24px]">{icon}</span>
    </div>
    <div>
      <p className="text-[10px] font-bold text-[#5e636e] uppercase tracking-widest">{label}</p>
      <h3 className={`text-2xl font-black ${label === 'Total Tasks' ? 'text-[#2d1b4e]' : 'text-[#170338]'}`}>{value}</h3>
    </div>
  </div>
);

const ActivityItem = ({ activity, isCompact = true }) => (
  <div className="flex gap-4 group">
    <div
      className={`rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border border-white shadow-sm ${isCompact ? 'w-10 h-10' : 'w-10 h-10 rounded-full'}`}
      style={{ backgroundColor: activity.avatarColor, color: activity.textColor }}
    >
      {activity.initials}
    </div>
    <div className="flex-1">
      <div className={`flex flex-wrap items-center gap-x-1 behavior-relaxed ${isCompact ? 'text-[13px]' : 'text-[13px]'}`}>
        <span className={`font-bold ${isCompact ? 'text-[#170338]' : 'text-[#4C2B74] hover:underline cursor-pointer'}`}>{activity.user}</span>
        {!isCompact && <span className="text-[#5e636e] mx-1.5">{activity.action}</span>}
        {isCompact && <span className="text-[#5e636e] mx-1">{activity.action}</span>}
        <span className={`status-pill px-2 py-0.5 rounded ${isCompact ? 'rounded-full text-[9px]' : 'text-[10px]'} ${activity.statusColor} font-bold uppercase border whitespace-nowrap`}>
          {activity.status}
        </span>
        {activity.target && (
          <>
            <span className="text-[#5e636e] mx-1">{isCompact ? 'on' : 'on'}</span>
            {!isCompact ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-[14px]">check_box</span> {activity.target}
              </span>
            ) : (
              <span className="font-semibold text-[#1a1c1e] cursor-pointer hover:text-[#4C2B74] underline decoration-gray-200">
                {activity.target}
              </span>
            )}
          </>
        )}
      </div>
      <p className="text-[11px] text-[#5e636e] mt-0.5">{activity.time}</p>
    </div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isBoardDropdownOpen, setIsBoardDropdownOpen] = useState(false);
  const [hoveredPriority, setHoveredPriority] = useState(null);
  const [hoveredWorkload, setHoveredWorkload] = useState(null);
  const [hoveredAccount, setHoveredAccount] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");



  const [activeFilter, setActiveFilter] = useState("All");

  // Modal specific filters
  const [modalSearch, setModalSearch] = useState("");
  const [modalEventType, setModalEventType] = useState("All Events");
  const [modalTimeRange, setModalTimeRange] = useState("Last 7 days");
  const [modalSortOrder, setModalSortOrder] = useState("Newest First");
  const [selectedOperation, setSelectedOperation] = useState("User Management");
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedDate, setSelectedDate] = useState("All Dates");

  // Custom Audit Logs specific states
  const [modalLabelTitle, setModalLabelTitle] = useState("All Labels");
  const [modalRowsPerPage, setModalRowsPerPage] = useState(25);
  const [modalPage, setModalPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);


  // Define tabs based on role
  const roleParam = searchParams.get('role')?.toUpperCase();
  const isAdmin = roleParam !== "USER"; // Default to ADMIN unless role=user is specified
  const user = { role: isAdmin ? "ADMIN" : "USER" };

  const priorityBreakdownData = isAdmin
    ? [
      { label: 'High', value: 245, color: '#FF8B00', icon: 'keyboard_arrow_up' },
      { label: 'Medium', value: 412, color: '#DE350B', icon: 'drag_handle' },
      { label: 'Low', value: 225, color: '#4C2B74', icon: 'keyboard_arrow_down' }
    ]
    : [
      { label: 'High', value: 12, color: '#FF8B00', icon: 'keyboard_arrow_up' },
      { label: 'Medium', value: 25, color: '#DE350B', icon: 'drag_handle' },
      { label: 'Low', value: 10, color: '#4C2B74', icon: 'keyboard_arrow_down' }
    ];

  const maxPriorityValue = isAdmin ? 500 : 30;
  const yAxisTicks = isAdmin
    ? [500, 400, 300, 200, 100, 0]
    : [30, 24, 18, 12, 6, 0];

  const taskTabs = isAdmin
    ? ['Worked on', 'Viewed', 'Assign History']
    : ['Worked on', 'Viewed', 'Assigned to me'];

  const [activeTaskTab, setActiveTaskTab] = useState(taskTabs[0]);

  // Sync tab when role changes
  useEffect(() => {
    setActiveTaskTab(taskTabs[0]);
  }, [isAdmin]);

  const stats = isAdmin ? adminStats : userStats;
  const currentActivities = isAdmin ? adminActivities : userActivities;
  const currentWorkedOnTasks = isAdmin ? adminWorkedOnTasks : userWorkedOnTasks;
  const currentViewedTasks = isAdmin ? adminViewedTasks : userViewedTasks;
  const currentAssignedTasks = isAdmin ? adminAssignedTasks : userAssignedTasks;
  const statusData = isAdmin ? adminStatusData : userStatusData;
  const totalTasksCount = isAdmin ? 882 : 47;

  // Filtering logic for Admin section
  const getFilteredData = (data) => {
    if (!isAdmin) return data;
    return data.filter(item => {
      const matchSearch = item.title.toLowerCase().includes(modalSearch.toLowerCase()) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(modalSearch.toLowerCase()));

      // Filter by operation card selection
      const matchOp = !item.operation || item.operation === selectedOperation;

      // Filter by Status dropdown
      const matchStatus = selectedStatus === "All Status" || item.status?.replace('_', ' ').toLowerCase() === selectedStatus.toLowerCase();

      // Filter by Date dropdown
      const matchDate = selectedDate === "All Dates" || item.group?.toLowerCase() === selectedDate.toLowerCase();

      return matchSearch && matchStatus && matchDate && matchOp;
    });
  };

  const filteredWorkedOn = getFilteredData(currentWorkedOnTasks);
  const filteredViewed = getFilteredData(currentViewedTasks);
  const filteredAssigned = getFilteredData(currentAssignedTasks);

  // Modal Filtering Logic
  const filteredModalActivities = (isAdmin ? adminActivities : userActivities).filter(log => {
    const matchSearch = log.user.toLowerCase().includes(modalSearch.toLowerCase()) ||
      log.target.toLowerCase().includes(modalSearch.toLowerCase()) ||
      log.action.toLowerCase().includes(modalSearch.toLowerCase());
    const matchType = modalEventType === "All Events" || log.labelTitle.toLowerCase() === modalEventType.toLowerCase();

    // Time range filtering (simplified for mock)
    const matchTime = modalTimeRange === "All Time" ||
      (modalTimeRange === "Today" && log.group === "Today") ||
      (modalTimeRange === "Yesterday" && log.group === "Yesterday");

    return matchSearch && matchType && matchTime;
  }).sort((a, b) => {
    return modalSortOrder === "Newest First" ? b.time.localeCompare(a.time) : a.time.localeCompare(b.time);
  });

  // Custom Audit Logs Filtering & Sorting Logic
  const filteredAuditLogs = auditLogsData.filter(log => {
    // 1. Search text filter
    const normalizedSearch = modalSearch.toLowerCase();
    const matchSearch = !modalSearch ||
      log.user.toLowerCase().includes(normalizedSearch) ||
      log.event.toLowerCase().includes(normalizedSearch) ||
      log.id.toLowerCase().includes(normalizedSearch);

    // 2. Date Range filter
    let matchDate = true;
    if (modalTimeRange === "Today") {
      matchDate = log.createdAt.startsWith("2026-06-25");
    } else if (modalTimeRange === "Yesterday") {
      matchDate = log.createdAt.startsWith("2026-06-24");
    } else if (modalTimeRange === "Last 7 days") {
      const dateVal = new Date(log.createdAt.replace(' ', 'T')).getTime();
      const cutoff = new Date("2026-06-18T00:00:00").getTime();
      matchDate = dateVal >= cutoff;
    } else if (modalTimeRange === "Last 30 days") {
      const dateVal = new Date(log.createdAt.replace(' ', 'T')).getTime();
      const cutoff = new Date("2026-05-26T00:00:00").getTime();
      matchDate = dateVal >= cutoff;
    }

    // 3. Event Type filter
    let matchEvent = true;
    if (modalEventType !== "All Events") {
      const opt = modalEventType.toLowerCase().replace(' ', '');
      const ev = log.event.toLowerCase().replace(' ', '');
      matchEvent = ev === opt || log.event.toLowerCase() === modalEventType.toLowerCase();
    }

    // 4. Label Title filter
    let matchEntity = true;
    if (modalLabelTitle !== "All Labels") {
      matchEntity = log.labelTitle.toLowerCase() === modalLabelTitle.toLowerCase();
    }

    return matchSearch && matchDate && matchEvent && matchEntity;
  }).sort((a, b) => {
    if (modalSortOrder === "Newest First") {
      return b.createdAt.localeCompare(a.createdAt);
    } else if (modalSortOrder === "Oldest First") {
      return a.createdAt.localeCompare(b.createdAt);
    } else if (modalSortOrder === "User A-Z") {
      return a.user.localeCompare(b.user);
    } else if (modalSortOrder === "Action A-Z") {
      return a.event.localeCompare(b.event);
    }
    return 0;
  });

  // Pagination calculations
  const totalAuditLogs = filteredAuditLogs.length;
  const maxAuditPages = Math.max(1, Math.ceil(totalAuditLogs / modalRowsPerPage));
  const currentAuditPage = Math.min(modalPage, maxAuditPages);
  const auditStartIndex = (currentAuditPage - 1) * modalRowsPerPage;
  const auditEndIndex = Math.min(auditStartIndex + modalRowsPerPage, totalAuditLogs);
  const paginatedAuditLogs = filteredAuditLogs.slice(auditStartIndex, auditEndIndex);

  return (
    <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 md:px-8 md:pt-5 md:pb-8 space-y-6 custom-scrollbar bg-[#FAFBFF]">
      {/* CSS Styles extracted from the snippet */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;900&display=swap');

        .dashboard-container {
        }

        .glass-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7));
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.03);
          transition: all 0.3s ease;
        }

        .glass-card:hover {
          box-shadow: 0 8px 30px -4px rgba(0, 0, 0, 0.06);
          transform: translateY(-2px);
        }

        .interactive-card {
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          cursor: pointer;
        }

        .interactive-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 30px -5px rgba(0, 0, 0, 0.1);
        }

        .interactive-card:active {
          transform: scale(0.96);
        }

        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .animate-card {
          animation: fadeInScale 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        .donut-segment {
          transition: stroke-width 0.3s ease, opacity 0.3s ease;
          cursor: pointer;
        }

        .donut-segment:hover {
          stroke-width: 6;
          opacity: 0.8;
        }

        .status-pill {
          transition: all 0.2s ease;
          cursor: pointer;
          letter-spacing: 0.02em;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cdd5deff;
          border-radius: 10px;
        }

        .gradient-purple { background: linear-gradient(135deg, #f3ebf7 0%, #ffffff 100%); }
        .gradient-blue { background: linear-gradient(135deg, #e3f2fd 0%, #ffffff 100%); }
        .gradient-green { background: linear-gradient(135deg, #e8f5e9 0%, #ffffff 100%); }
        .gradient-red { background: linear-gradient(135deg, #ffebee 0%, #ffffff 100%); }
        .gradient-indigo { background: linear-gradient(135deg, #e8eaf6 0%, #ffffff 100%); }
        .gradient-amber { background: linear-gradient(135deg, #fff8e1 0%, #ffffff 100%); }

        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /* Audit Log Styles */
        .mb-stack-lg { margin-bottom: 1.5rem; }
        .py-stack-lg { padding-top: 1.5rem; padding-bottom: 1.5rem; }
        .gap-stack-lg { gap: 1.5rem; }
        .px-margin-page { padding-left: 2rem; padding-right: 2rem; }
        .max-w-container-max { max-width: 1440px; }
        
        /* Font styles */
        .font-headline-md { font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 600; line-height: 32px; letter-spacing: -0.01em; }
        .font-body-md { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 400; line-height: 20px; }
        .font-body-sm { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 400; line-height: 18px; }
        .font-label-sm { font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; line-height: 16px; letter-spacing: 0.05em; }
        .font-label-md { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; line-height: 20px; }
        
        /* Border and Colors */
        .border-outline-variant { border: 1px solid #c7c4d8; }
        .border-r-outline-variant { border-right: 1px solid #c7c4d8; }
        .border-b-outline-variant { border-bottom: 1px solid #c7c4d8; }
        .bg-surface-container-low { background-color: #f5f2ff; }
        .bg-surface-container-lowest { background-color: #ffffff; }
        .text-on-surface-variant { color: #464555; }
        
        .divide-outline-variant\/30 > :not([hidden]) ~ :not([hidden]) {
          border-color: rgba(199, 196, 216, 0.3);
        }
        
        th.border-r, td.border-r {
          border-right-width: 1px;
          border-right-color: #c7c4d8;
        }

        .table-row-hover:hover {
          background-color: rgba(245, 242, 255, 0.4);
        }
      `}</style>

      {/* Activity Modal / Audit Log Table */}
      {isActivityModalOpen && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-[#170338]/40 backdrop-blur-sm animate-in fade-in duration-300">
          {isAdmin ? (
            <div className="bg-white w-full max-w-[1240px] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 relative">
              {/* TOP CLOSE BUTTON */}
              <div className="absolute top-6 right-6 z-50">
                <button
                  type="button"
                  onClick={() => setIsActivityModalOpen(false)}
                  className="w-10 h-10 rounded-xl hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[24px]">close</span>
                </button>
              </div>

              {/* MAIN CONTENT */}
              <div className="flex-1 flex flex-col overflow-hidden p-5 lg:p-6">
                {/* Header & Description */}
                <div className="mb-4 pr-12">
                  <h2 className="font-headline-md text-on-surface font-bold text-[30px] text-black">Audit Logs</h2>
                  <p className="font-body-md text-on-surface-variant mt-1">Stay up to date with what's happening across the space.</p>
                </div>

                {/* Filter & Search Section */}
                <section className="border border-outline-variant rounded-xl p-4 mb-4 shadow-sm bg-slate-100 lg:p-5">
                  <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end justify-between">
                    {/* Search Bar */}
                    <div className="w-full flex flex-col gap-1 flex-grow">
                      <label className="font-label-sm px-1 text-black font-bold">Search Logs</label>
                      <div className="relative group">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline transition-colors group-focus-within:text-[#0052CC]">search</span>
                        <input
                          value={modalSearch}
                          onChange={(e) => { setModalSearch(e.target.value); setModalPage(1); }}
                          type="text"
                          placeholder="Search by User, Action, or Log ID..."
                          className="w-full pl-10 pr-4 py-2 bg-white border border-outline-variant rounded-lg focus:border-slate-600 focus:ring-0 transition-all font-body-md"
                        />
                      </div>
                    </div>
                    {/* Refresh Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRefreshing(true);
                        setModalSearch("");
                        setModalEventType("All Events");
                        setModalTimeRange("Last 7 days");
                        setModalSortOrder("Newest First");
                        setModalLabelTitle("All Labels");
                        setModalPage(1);
                        setTimeout(() => setIsRefreshing(false), 500);
                      }}
                      className="flex items-center justify-center gap-2 px-5 py-2 text-white rounded-lg active:scale-[0.98] transition-all font-label-md shadow-sm w-full lg:w-auto bg-[#2D1B4E] hover:bg-[#2D1B4E]/90 cursor-pointer"
                    >
                      <span className={`material-symbols-outlined text-[20px] ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
                      Refresh
                    </button>
                  </div>

                  {/* Secondary Filters */}
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-4">
                    {/* Date Range Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm px-1 text-black font-bold">Date Range</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">calendar_today</span>
                        <select
                          value={modalTimeRange}
                          onChange={(e) => { setModalTimeRange(e.target.value); setModalPage(1); }}
                          className="w-full appearance-none bg-white border border-outline-variant rounded-lg py-2 pl-10 pr-10 font-body-md focus:border-slate-600 focus:ring-0 transition-all cursor-pointer hover:bg-slate-100"
                        >
                          <option value="Last 7 days">Last 7 days</option>
                          <option value="Today">Today</option>
                          <option value="Yesterday">Yesterday</option>
                          <option value="Last 30 days">Last 30 days</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">expand_more</span>
                      </div>
                    </div>
                    {/* Event Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm px-1 text-black font-bold">Event Type</label>
                      <div className="relative">
                        <select
                          value={modalEventType}
                          onChange={(e) => { setModalEventType(e.target.value); setModalPage(1); }}
                          className="w-full appearance-none bg-white border border-outline-variant rounded-lg py-2 pl-4 pr-10 font-body-md focus:border-slate-600 focus:ring-0 transition-all cursor-pointer hover:bg-slate-100"
                        >
                          <option value="All Events">All Events</option>
                          <option value="Created User">Create User</option>
                          <option value="Updated Task">Update Task</option>
                          <option value="Delete Comment">Delete Comment</option>
                          <option value="Uploaded File">File Attachment</option>
                          <option value="Session Login">Session Login</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">expand_more</span>
                      </div>
                    </div>
                    {/* Entity Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm px-1 text-black font-bold">Label Title</label>
                      <div className="relative">
                        <select
                          value={modalLabelTitle}
                          onChange={(e) => { setModalLabelTitle(e.target.value); setModalPage(1); }}
                          className="w-full appearance-none bg-white border border-outline-variant rounded-lg py-2 pl-4 pr-10 font-body-md focus:border-slate-600 focus:ring-0 transition-all cursor-pointer hover:bg-slate-100"
                        >
                          <option value="All Labels">All Labels</option>
                          <option value="User">User</option>
                          <option value="Task">Task</option>
                          <option value="Comment">Comment</option>
                          <option value="Token">Token</option>
                          <option value="Attachment">Attachment</option>
                          <option value="Session">Session</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">expand_more</span>
                      </div>
                    </div>
                    {/* Sort Filter */}
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm px-1 text-black font-bold">Sort Order</label>
                      <div className="relative">
                        <select
                          value={modalSortOrder}
                          onChange={(e) => { setModalSortOrder(e.target.value); setModalPage(1); }}
                          className="w-full appearance-none bg-white border border-outline-variant rounded-lg py-2 pl-4 pr-10 font-body-md focus:border-slate-600 focus:ring-0 transition-all cursor-pointer hover:bg-slate-100"
                        >
                          <option value="Newest First">Newest First</option>
                          <option value="Oldest First">Oldest First</option>
                          <option value="User A-Z">User A-Z</option>
                          <option value="Action A-Z">Action A-Z</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">expand_more</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Audit Table Section */}
                <section className="border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col bg-white flex-1 min-h-0">
                  <div className="flex-1 overflow-auto relative custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead className="border-b border-outline-variant sticky top-0 z-20 bg-slate-200">
                        <tr>
                          <th className="px-6 py-2 pb-2.5 font-label-sm tracking-wider uppercase whitespace-nowrap text-black font-bold border-r text-center">ID</th>
                          <th className="px-6 py-2 pb-2.5 font-label-sm tracking-wider uppercase whitespace-nowrap text-black font-bold border-r text-center">User</th>
                          <th className="px-6 py-2 pb-2.5 font-label-sm tracking-wider uppercase whitespace-nowrap text-black font-bold border-r text-center">Role</th>
                          <th className="px-6 py-2 pb-2.5 font-label-sm tracking-wider uppercase whitespace-nowrap text-black font-bold border-r text-center">Event</th>
                          <th className="px-6 py-2 pb-2.5 font-label-sm tracking-wider uppercase whitespace-nowrap text-black font-bold border-r text-center">Label Title</th>
                          <th className="px-6 py-2 pb-2.5 font-label-sm tracking-wider uppercase whitespace-nowrap text-black font-bold border-r text-center">CREATED AT</th>
                          <th className="px-6 py-2 pb-2.5 font-label-sm tracking-wider uppercase whitespace-nowrap text-black font-bold text-center">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/30">
                        {paginatedAuditLogs.map((log) => {
                          const isExpanded = expandedLogId === log.id;
                          return (
                            <React.Fragment key={log.id}>
                              <tr className="table-row-hover transition-colors group border-b-0">
                                <td className="px-6 font-mono text-body-sm whitespace-nowrap py-2 border-r text-black">{log.id}</td>
                                <td className="px-6 whitespace-nowrap py-2 border-r">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs" style={{ backgroundColor: log.avatarBg }}>
                                      {log.initials}
                                    </div>
                                    <div className="font-body-md font-semibold text-black">{log.user}</div>
                                  </div>
                                </td>
                                <td className="px-6 font-body-sm whitespace-nowrap py-2 border-r text-black">{log.role}</td>
                                <td className="px-6 font-body-md text-on-surface font-medium whitespace-nowrap py-2 border-r">
                                  <span className="text-[#3525cd] font-semibold">{log.event}</span>
                                </td>
                                <td className="px-6 whitespace-nowrap py-2 border-r">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-tight ${log.labelTitle === 'User' ? 'bg-blue-100 text-blue-700' :
                                    log.labelTitle === 'Task' ? 'bg-teal-100 text-teal-700' :
                                      log.labelTitle === 'Token' ? 'bg-slate-200 text-slate-700' :
                                        log.labelTitle === 'Attachment' ? 'bg-blue-100 text-blue-700' :
                                          'bg-slate-200 text-slate-700'
                                    }`}>
                                    {log.labelTitle}
                                  </span>
                                </td>
                                <td className="px-6 font-mono text-body-sm whitespace-nowrap py-2 border-r text-black">{log.createdAt}</td>
                                <td className="px-6 text-center whitespace-nowrap py-2">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded bg-surface-container-low border border-outline-variant text-[#3525cd] font-label-sm transition-colors hover:bg-slate-200 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">
                                      {isExpanded ? 'visibility_off' : 'visibility'}
                                    </span>
                                    {isExpanded ? 'Hide' : 'View'}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-surface-container-lowest">
                                  <td className="px-6 py-4" colSpan={7}>
                                    <div className="rounded-lg border border-outline-variant bg-slate-100 p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-label-md text-black font-semibold">Log Payload</h4>
                                        <span className="text-[11px] font-mono text-on-surface-variant">{log.id}</span>
                                      </div>
                                      <pre className="font-mono text-xs text-on-surface-variant bg-white p-4 rounded border border-outline-variant overflow-x-auto leading-relaxed shadow-sm">
                                        {JSON.stringify(log.payload, null, 2)}
                                      </pre>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer / Pagination */}
                  <div className="px-6 py-4 border-t border-outline-variant flex flex-col md:flex-row items-center gap-6 bg-white md:justify-end">
                    <div className="flex items-center gap-6 text-black">
                      <div className="flex items-center gap-3">
                        <span className="font-label-md text-on-surface-variant text-sm font-medium">Rows per page</span>
                        <div className="relative">
                          <select
                            value={modalRowsPerPage}
                            onChange={(e) => {
                              setModalRowsPerPage(parseInt(e.target.value));
                              setModalPage(1);
                            }}
                            className="bg-surface-container-lowest border border-[#c7c4d8] rounded-lg py-1 pl-2 pr-4 font-body-sm text-on-surface focus:border-slate-600 focus:ring-0 transition-all cursor-pointer hover:bg-slate-100 text-sm"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 border-l border-[#c7c4d8]/40 pl-6">
                        <span className="font-label-md text-on-surface-variant text-sm font-medium">Page</span>
                        <input
                          type="number"
                          min={1}
                          max={maxAuditPages}
                          value={currentAuditPage}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val >= 1 && val <= maxAuditPages) {
                              setModalPage(val);
                            }
                          }}
                          className="w-12 text-center bg-surface-container-lowest border border-[#c7c4d8] rounded-lg py-1 px-1.5 font-body-sm text-on-surface focus:border-slate-600 focus:ring-0 transition-all appearance-none"
                        />
                        <span className="font-label-md text-on-surface-variant text-sm font-medium">of {maxAuditPages}</span>
                      </div>
                      <span className="font-body-sm text-on-surface-variant border-l border-[#c7c4d8]/40 pl-6 text-sm">
                        Showing <span className="font-semibold text-on-surface">{totalAuditLogs === 0 ? 0 : auditStartIndex + 1}-{auditEndIndex}</span> of <span className="font-semibold text-on-surface">{totalAuditLogs}</span> logs
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h3 className="text-2xl font-bold text-[#170338] tracking-tight">
                    Recent Activity</h3>
                  <p className="text-sm text-[#5e636e] font-medium mt-1 opacity-90">
                    Stay up to date with what's happening across the space.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActivityModalOpen(false)}
                  className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center text-[#5e636e] transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-6">
                <div className="space-y-6">
                  {["Today", "Yesterday"].map((group) => (
                    <div key={group} className="space-y-3">
                      <p className="text-[10px] font-black text-[#5e636e] uppercase tracking-widest bg-gray-100/50 px-3 py-1.5 rounded-lg inline-block">{group}</p>
                      <div className="flex flex-col gap-3">
                        {currentActivities.filter(a => a.group === group).map((activity, idx) => (
                          <div key={idx} className="p-3.5 rounded-2xl border border-gray-100 hover:border-[#4C2B74]/30 hover:shadow-md transition-all group cursor-pointer bg-white">
                            <ActivityItem activity={activity} isCompact={true} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      <div className="dashboard-container space-y-6">
        {/* Page Title & KPI Banner */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-[#4C2B74]">Dashboard</h2>
            <p className="text-sm text-[#5e636e] font-medium">Track task progress, monitor task status, and stay updated with recent activities.</p>
          </div>

          {/* KPI Cards */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-6`}>
            {stats.map((kpi, idx) => (
              <StatCard key={idx} {...kpi} />
            ))}
          </div>
        </div>

        {/* 2x2 Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Overview (Top Left) */}
          <div className="glass-card p-8 rounded-2xl flex flex-col h-full">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-[#170338]">Status Overview</h4>
                <Link to={`/dashboard/spaces${location.search}`} className="text-[#170338] text-xs font-bold hover:underline">View all</Link>
              </div>
              <p className="text-[#5e636e] text-sm mt-1">Snapshot of your work item statuses.</p>
            </div>
            <div className="flex flex-col lg:flex-row items-center justify-around gap-6 py-4 flex-1">
              <div className="relative w-56 h-56 cursor-pointer">
                {/* Tooltip Overlay - Absolute to this container */}
                {hoveredSegment !== null && (
                  <div
                    className="absolute z-[100] bg-white border border-gray-200 shadow-[0_8px_24px_rgba(0,0,0,0.12)] rounded-[4px] px-3 py-2 flex items-center gap-2.5 whitespace-nowrap pointer-events-none"
                    style={{
                      left: statusData[hoveredSegment].tPos.left,
                      top: statusData[hoveredSegment].tPos.top,
                      transform: 'translate(-50%, -100%)'
                    }}
                  >
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: statusData[hoveredSegment].color }}></div>
                    <span className="text-sm font-semibold text-[#42526E]">{statusData[hoveredSegment].label} &nbsp; {statusData[hoveredSegment].count}</span>
                  </div>
                )}

                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 36 36"
                >
                  <circle cx="18" cy="18" fill="transparent" r="15.915" stroke="#F1F5F9" strokeWidth="4"></circle>
                  {statusData.map((item, index) => (
                    <circle
                      key={index}
                      className={`donut-segment cursor-pointer transition-all duration-300 ${hoveredSegment === index ? 'opacity-100 scale-[1.02]' : (hoveredSegment !== null ? 'opacity-30' : 'opacity-100')}`}
                      cx="18"
                      cy="18"
                      fill="transparent"
                      r="15.915"
                      stroke={item.color}
                      strokeDasharray={`${item.dash} 100`}
                      strokeDashoffset={item.offset}
                      strokeLinecap="butt"
                      strokeWidth="4.5"
                      onMouseEnter={() => setHoveredSegment(index)}
                      onMouseLeave={() => setHoveredSegment(null)}
                      style={{ transformOrigin: 'center' }}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-4xl text-[#1a1c1e] font-bold tracking-tight">{totalTasksCount}</span>
                  <p className="text-[11px] text-[#5e636e] font-bold mt-1 text-center leading-tight">Total tasks</p>
                </div>
              </div>
              <div className="space-y-3">
                {statusData.map((item, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 cursor-pointer p-1.5 rounded-lg transition-all ${hoveredSegment === index ? 'bg-gray-50 translate-x-1' : ''}`}
                    onMouseEnter={() => setHoveredSegment(index)}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    <div className="w-3 h-3 rounded-full transition-transform shadow-sm" style={{ backgroundColor: item.color, transform: hoveredSegment === index ? 'scale(1.25)' : 'scale(1)' }}></div>
                    <span className={`text-xs font-bold transition-colors ${hoveredSegment === index ? 'text-[#4C2B74]' : 'text-[#5e636e]'}`}>
                      {item.label}: {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Audit Logs (ADMIN) / Recent Activity (USER) */}
          <div className="glass-card p-8 rounded-2xl flex flex-col h-full">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h4 className="text-lg font-bold text-[#170338]">{isAdmin ? "Audit Logs" : "Recent Activity"}</h4>
                <p className="text-[#5e636e] text-sm mt-1">
                  {isAdmin ? "Track user actions, security events, and system changes." : "Stay up to date with what's happening across the space."}
                </p>
              </div>
              <button
                onClick={() => setIsActivityModalOpen(true)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-[#5e636e] transition-colors"
              >
                <span className="material-symbols-outlined text-lg">open_in_full</span>
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-2 max-h-[400px]">
              {["Today", "Yesterday"].map((group) => {
                const groupActivities = currentActivities.filter(a => a.group === group);
                if (groupActivities.length === 0) return null;
                return (
                  <div key={group} className="space-y-4">
                    <p className="text-[10px] font-bold text-[#5e636e] uppercase tracking-widest">{group === "Today" ? "Today" : "Yesterday"}</p>
                    {groupActivities.map((activity, idx) => (
                      <ActivityItem key={idx} activity={activity} isCompact={true} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="glass-card p-8 rounded-2xl flex flex-col w-full">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h4 className="text-lg font-bold text-[#170338]">Priority breakdown</h4>
              <p className="text-[#5e636e] text-sm mt-1">Get a holistic view of how work is being prioritized.</p>
            </div>
          </div>

          <div className="relative flex-1 mt-6">
            <div className="flex h-64 relative">
              {/* Y-Axis */}
              <div className="flex flex-col justify-between text-[11px] font-bold text-[#5e636e]/60 pr-6 pb-8 border-r border-[#170338]/10 h-full">
                {yAxisTicks.map((tick, i) => (
                  <span key={i} className={i === yAxisTicks.length - 1 ? "mb-[-2px]" : ""}>{tick}</span>
                ))}
              </div>

              <div className="flex-1 relative ml-1 h-full">
                {/* 1. Vùng lưới và trục ngang (Plot Area) */}
                <div className="absolute inset-0 bottom-8 border-b border-[#170338]/40">
                  {/* Các đường kẻ ngang */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className={`w-full border-t border-[#170338]/5`}></div>
                    ))}
                  </div>

                  {/* 2. Container chứa các cột ('HIGH','MEDIUM','LOW')*/}
                  <div className="absolute inset-x-0 bottom-0 h-full flex items-end justify-around px-2">
                    {priorityBreakdownData.map((item, idx) => (
                      <div
                        key={idx}
                        className="group relative flex flex-col items-center w-full h-full justify-end"
                        onMouseEnter={() => setHoveredPriority(item)}
                        onMouseLeave={() => setHoveredPriority(null)}
                      >
                        {/* Cột dữ liệu - Bây giờ chứa Tooltip để căn chỉnh chuẩn xác */}
                        <div
                          className={`w-14 sm:w-16 transition-all duration-300 rounded-t-sm shadow-sm cursor-pointer bg-[#888995] relative ${hoveredPriority?.label === item.label ? 'scale-x-105 bg-[#4C2B74]' : 'opacity-80 hover:opacity-100'
                            }`}
                          style={{
                            height: `${(item.value / maxPriorityValue) * 100}%`,
                          }}
                        >
                          {/* Popover khi hover - Gắn trực tiếp vào đầu cột */}
                          {hoveredPriority?.label === item.label && item.value > 0 && (
                            <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in zoom-in slide-in-from-bottom-1 duration-200 pointer-events-none">
                              <div className="bg-white border border-gray-100 rounded-xl shadow-2xl p-3 min-w-[90px] flex flex-col items-center gap-1 relative">
                                <span className="text-[9px] font-bold text-[#5e636e] uppercase tracking-wider">{item.label}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: item.color }}></div>
                                  <span className="text-lg font-black text-[#170338]">{item.value}</span>
                                </div>
                                <div className="absolute top-[99%] left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-white"></div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Vạch nhỏ dưới chân cột */}
                        <div className="absolute top-full mt-2 w-0.5 h-3 bg-[#170338]/10"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Legend / X-Axis Labels ('HIGH','MEDIUM','LOW')*/}
            <div className="flex justify-around pl-14 mt-6">
              {priorityBreakdownData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-[#5e636e] group cursor-pointer hover:text-[#170338] transition-colors">
                  <span className="material-symbols-outlined text-[16px] font-bold" style={{ color: item.color }}>{item.icon}</span>
                  <span className="text-[11px] font-bold">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Conditionally render User Account Overview */}
        {isAdmin && (
          <div className="glass-card p-8 rounded-2xl flex flex-col w-full">
            {/* User Account Overview (ADMIN ONLY) */}
            <div className="mb-8">
              <h4 className="text-lg font-bold text-[#1a1c1e]">User Account Overview</h4>
              <p className="text-sm text-[#5e636e] mt-1 font-medium">
                Monitor the current status and health of user accounts across the system.
              </p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-[1.5fr,2.5fr] gap-4 px-2">
                <span className="text-[11px] font-black text-[#5e636e] uppercase tracking-widest">Account Status</span>
                <span className="text-[11px] font-black text-[#5e636e] uppercase tracking-widest">User Distribution</span>
              </div>

              <div className="space-y-4">
                {userAccountData.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1.5fr,2.5fr] gap-4 items-center group cursor-pointer relative"
                    onMouseEnter={() => setHoveredAccount(idx)}
                    onMouseLeave={() => setHoveredAccount(null)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm shrink-0 border-2 border-white ring-1 ring-gray-100 group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: item.color }}
                      >
                        <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                      </div>
                      <span className="text-sm font-bold text-[#1a1c1e] group-hover:text-[#4C2B74] transition-colors truncate">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 relative">
                      <div className="flex-1 h-9 bg-gray-50 rounded-lg overflow-hidden relative shadow-inner border border-gray-100/50">
                        <div
                          className="absolute h-full transition-all duration-1000 ease-out flex items-center justify-end px-3 shadow-lg"
                          style={{
                            width: `${item.percentage}%`,
                            background: item.gradient,
                            boxShadow: `4px 0 12px ${item.glow}`
                          }}
                        >
                          <span className="text-[11px] font-black text-white drop-shadow-sm">{item.count}</span>
                        </div>
                      </div>


                      {/* Account Tooltip */}
                      {hoveredAccount === idx && (
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-[100] animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200 pointer-events-none">
                          <div className="bg-[#1a1c1e] text-white text-[11px] font-bold px-3 py-2 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2 border border-white/10">
                            <span className="text-white/70">{item.percentage}%</span>
                            <span className="w-1 h-1 rounded-full bg-white/30"></span>
                            <span>({item.count}/{item.total} users)</span>
                          </div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-[#1a1c1e]"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}



        <div className="glass-card rounded-2xl overflow-hidden flex flex-col w-full min-h-[600px]">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isAdmin ? (
              <div className="p-8 pb-4 border-b border-gray-100 bg-white sticky top-0 z-20">
                <div className="flex flex-col gap-8">
                  {/* Header: Title + Search/Filter */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-[#170338]">Recent Activities</h3>


                    <div className="flex items-center gap-3">
                      <div className="relative group w-64">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-lg group-focus-within:text-[#4C2B74]">search</span>
                        <input
                          type="text"
                          placeholder="Search operations..."
                          value={modalSearch}
                          onChange={(e) => setModalSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#4C2B74] hover:border-gray-400 outline-none transition-all text-sm font-medium"
                        />
                      </div>

                      {/* Status Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => {
                            setShowStatusFilter(!showStatusFilter);
                            setShowDateFilter(false);
                          }}
                          className={`flex items-center justify-between gap-2 min-w-[140px] px-4 py-2.5 rounded-xl border transition-all text-sm font-bold ${selectedStatus !== "All Status"
                            ? "border-[#4C2B74] text-[#4C2B74] bg-purple-50"
                            : "border-gray-200 text-[#5e636e] hover:border-[#4C2B74] hover:text-[#4C2B74] hover:bg-purple-50/10 bg-white"
                            }`}
                        >
                          <span className="truncate">{selectedStatus}</span>
                          <span className={`material-symbols-outlined text-gray-400 transition-transform ${showStatusFilter ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>
                        {showStatusFilter && (
                          <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl z-[100] p-2 animate-in fade-in zoom-in-95 duration-200">
                            {['All Status', 'New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done', 'Cancelled'].map(st => (
                              <button
                                key={st}
                                onClick={() => { setSelectedStatus(st); setShowStatusFilter(false); }}
                                className="flex items-center gap-3 w-full p-2.5 hover:bg-gray-50 rounded-xl text-sm font-bold text-[#5e636e] transition-colors"
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Date Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => {
                            setShowDateFilter(!showDateFilter);
                            setShowStatusFilter(false);
                          }}
                          className={`flex items-center justify-between gap-2 min-w-[140px] px-4 py-2.5 rounded-xl border transition-all text-sm font-bold ${selectedDate !== "All Dates"
                            ? "border-[#4C2B74] text-[#4C2B74] bg-purple-50"
                            : "border-gray-200 text-[#5e636e] hover:border-[#4C2B74] hover:text-[#4C2B74] hover:bg-purple-50/10 bg-white"
                            }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="material-symbols-outlined text-gray-400 text-lg">calendar_today</span>
                            {selectedDate}
                          </div>
                          <span className={`material-symbols-outlined text-gray-400 transition-transform ${showDateFilter ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>
                        {showDateFilter && (
                          <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl z-[100] p-2 animate-in fade-in zoom-in-95 duration-200">
                            {['All Dates', 'Today', 'Yesterday', 'In the last week'].map(d => (
                              <button
                                key={d}
                                onClick={() => { setSelectedDate(d); setShowDateFilter(false); }}
                                className="flex items-center gap-3 w-full p-2.5 hover:bg-gray-50 rounded-xl text-sm font-bold text-[#5e636e] transition-colors"
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Operation Cards */}
                  <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2">

                    {[
                      { id: 'User Management', label: 'User Management', sub: '156 Active Members', color: 'bg-indigo-500' },
                      { id: 'Permissions', label: 'Permissions', sub: '8 Global Roles', color: 'bg-purple-500' },
                      { id: 'Security Logs', label: 'Security Logs', sub: 'Live Audit Channel', color: 'bg-amber-500' }
                    ].map(op => (
                      <button
                        key={op.id}
                        onClick={() => setSelectedOperation(op.id)}
                        className={`min-w-[180px] max-w-[180px] p-4 rounded-xl border transition-all text-left relative overflow-hidden group border-l-[4px] ${selectedOperation === op.id ? 'bg-white border-[#4C2B74] shadow-md ring-1 ring-purple-100' : 'bg-white/60 border-gray-100 opacity-80 hover:opacity-100 hover:shadow-sm'}`}
                        style={{ borderLeftColor: op.id === 'User Management' ? '#6366f1' : op.id === 'Permissions' ? '#a855f7' : '#f59e0b' }}
                      >
                        <div className="flex flex-col gap-1">
                          <h4 className="text-[13px] font-bold text-[#170338] truncate">{op.label}</h4>
                          <p className="text-[10px] text-[#5e636e] font-medium truncate">{op.sub}</p>
                        </div>
                      </button>

                    ))}
                  </div>

                </div>
              </div>
            ) : (
              <>
                <div className="px-8 py-5 border-b border-gray-100 bg-white sticky top-0 z-20">
                  <h3 className="text-lg font-bold text-[#170338]">Recent Tasks</h3>
                </div>

                <div className="p-8 bg-[#fafbfc]/50 flex gap-4 overflow-x-auto custom-scrollbar no-scrollbar scroll-smooth">
                  <>
                    <div className="min-w-[150px] max-w-[150px] bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer relative group border-l-[4px] border-l-[#fbc02d]">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-[#fbc02d] rounded-lg flex items-center justify-center text-white shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">bolt</span>
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-[11px] font-bold text-[#170338] truncate leading-tight">Task Management...</h5>
                            <p className="text-[9px] text-[#5e636e] truncate">Team-managed</p>
                          </div>
                        </div>
                        <div className="mt-1 pt-2 border-t border-gray-50 flex items-center justify-between text-[10px] text-[#5e636e] font-bold relative">
                          <div
                            className="flex items-center gap-1 hover:text-[#4C2B74] transition-colors cursor-pointer group/btn"
                            onClick={(e) => { e.stopPropagation(); setIsBoardDropdownOpen(!isBoardDropdownOpen); }}
                          >
                            <span className="material-symbols-outlined text-[12px]">dashboard</span>
                            1 board
                            <span className={`material-symbols-outlined text-[14px] transition-transform ${isBoardDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                          </div>
                          {isBoardDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-lg shadow-xl py-2 min-w-[120px] z-30 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="px-3 py-1.5 hover:bg-purple-50 hover:text-[#4C2B74] transition-colors cursor-pointer">SCRUM Board</div>
                              <div className="px-3 py-1.5 hover:bg-purple-50 hover:text-[#4C2B74] transition-colors cursor-pointer text-gray-400">Backlog</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-[150px] max-w-[150px] bg-white/60 border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group border-l-[4px] border-l-blue-400 opacity-80 hover:opacity-100">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-400 rounded-lg flex items-center justify-center text-white shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">brush</span>
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-[11px] font-bold text-[#170338] truncate leading-tight">Design System</h5>
                            <p className="text-[9px] text-[#5e636e] truncate">Company-managed</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                </div>
              </>
            )}

            {/* Role-based Interactive Tabs */}
            <div className="px-8 border-b border-gray-100 flex gap-6 bg-white sticky top-[72px] z-10 overflow-x-auto no-scrollbar">
              {taskTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTaskTab(tab)}
                  className={`py-4 text-[13px] transition-all relative whitespace-nowrap ${activeTaskTab === tab
                    ? 'font-bold text-[#4C2B74]'
                    : 'font-medium text-[#5e636e] hover:text-[#2d1b4e]'
                    }`}
                >
                  {tab}
                  {(tab === 'Assigned to me' || tab === 'Assign History') && (
                    <span className="ml-1.5 bg-gray-100/80 text-gray-400 text-[10px] px-1.5 py-0.5 rounded-full font-black">
                      3
                    </span>
                  )}
                  {activeTaskTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#4C2B74] rounded-t-full shadow-[0_-2px_8px_rgba(76,43,116,0.15)] animate-in fade-in slide-in-from-bottom-2 duration-300"></div>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content Body */}
            <div className="min-h-[500px]">
              {/* 1. Worked On Tab */}
              {activeTaskTab === 'Worked on' && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                  {["TODAY", "YESTERDAY", "IN THE LAST WEEK"].map(group => {
                    const groupTasks = filteredWorkedOn.filter(t => t.group === group);
                    if (groupTasks.length === 0) return null;
                    return (
                      <div key={group}>
                        <div className="px-8 py-3 bg-gray-50/50 border-b border-gray-50/50">
                          <p className="text-[10px] font-black text-[#5e636e] uppercase tracking-widest">{group}</p>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {groupTasks.map((task, idx) => (
                            <div key={idx} className="px-8 py-6 flex items-center justify-between hover:bg-[#f9f1fc]/40 transition-all cursor-pointer group/item">
                              <div className="flex items-center gap-4">
                                <div className="w-7 h-7 rounded-lg bg-[#eef2ff] border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm group-hover/item:scale-110 transition-transform">
                                  <span className="material-symbols-outlined text-[18px] font-bold">check_box</span>
                                </div>
                                <div className="min-w-0 pr-4">
                                  <h5 className="font-bold text-[#170338] text-[14px] group-hover/item:text-[#4C2B74] transition-colors line-clamp-1">{task.title}</h5>
                                  <p className="text-[11px] text-[#5e636e] mt-1 font-medium">{task.subtitle}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-8 shrink-0">
                                <div className="text-right whitespace-nowrap">
                                  <p className="text-[10px] text-[#5e636e] font-medium">Updated</p>
                                  <p className="text-[10px] font-black text-[#170338] uppercase tracking-tight">{task.time || "2H AGO"}</p>
                                </div>
                                <div className="flex items-center">
                                  {isAdmin && task.assignees ? (
                                    <div className="flex -space-x-3 hover:space-x-1 transition-all duration-300">
                                      {task.assignees.map((assignee, aIdx) => (
                                        <div
                                          key={aIdx}
                                          className="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-md transition-transform hover:scale-110 hover:z-10"
                                          style={{ backgroundColor: assignee.color }}
                                          title={assignee.name}
                                        >
                                          {assignee.initials}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="w-9 h-9 rounded-full bg-[#10b981] flex items-center justify-center text-[10px] font-bold text-white shadow-sm border-2 border-white ring-1 ring-gray-100">TN</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. Viewed Tab */}
              {activeTaskTab === 'Viewed' && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                  {["Today", "Yesterday"].map(group => {
                    const groupTasks = filteredViewed.filter(t => t.group === group);
                    if (groupTasks.length === 0) return null;
                    return (
                      <div key={group}>
                        <div className="px-8 py-3 bg-gray-50/50 border-b border-gray-50">
                          <p className="text-[10px] font-black text-[#5e636e] uppercase tracking-widest">{group}</p>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {groupTasks.map((task, idx) => (
                            <div key={idx} className="px-8 py-5 flex items-center gap-4 hover:bg-[#f9f1fc]/40 transition-all cursor-pointer group">
                              <div className="w-6 h-6 rounded-md bg-[#eef2ff] border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-[16px] font-bold">{task.icon}</span>
                              </div>
                              <div>
                                <h5 className="font-bold text-[#170338] text-[13.5px] group-hover:text-[#4C2B74] transition-colors">{task.title}</h5>
                                <p className="text-[11px] text-[#5e636e] mt-0.5 font-medium">{task.subtitle}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3. Assign History (Admin) / Assigned to me (User) */}
              {(activeTaskTab === 'Assigned to me' || activeTaskTab === 'Assign History') && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                  {isAdmin ? (
                    <div className="divide-y divide-gray-50">
                      <div className="px-8 py-3 bg-gray-50/50">
                        <p className="text-[10px] font-black text-[#8c8c8c] uppercase tracking-widest">TASK ASSIGNMENT HISTORY</p>
                      </div>

                      {filteredAssigned.map((task, idx) => (
                        <div key={idx} className="px-8 py-5 flex items-center justify-between hover:bg-[#f9f1fc]/40 transition-all cursor-pointer group">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-sm group-hover:scale-110 transition-transform bg-amber-50 text-amber-600 border-amber-100">
                              <span className="material-symbols-outlined text-[20px]">history</span>
                            </div>
                            <div>
                              <h5 className="font-bold text-[#170338] text-[13.5px] group-hover:text-[#4C2B74] transition-colors">{task.title}</h5>
                              <p className="text-[11px] text-[#5e636e] mt-0.5 font-medium">{task.subtitle}</p>
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded text-[9px] font-black bg-[#f4f5f7] text-[#5e636e] border border-[#dfe1e6] uppercase">DONE</span>
                        </div>

                      ))}
                    </div>
                  ) : (
                    ["IN PROGRESS", "IN REVIEW", "TO DO"].map(group => {
                      const groupTasks = filteredAssigned.filter(t => t.group === group);
                      if (groupTasks.length === 0) return null;
                      return (
                        <div key={group}>
                          <div className="px-8 py-3 bg-gray-50/50 border-b border-gray-50/50">
                            <p className="text-[10px] font-black text-[#5e636e] uppercase tracking-widest">{group}</p>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {groupTasks.map((task, idx) => (
                              <div key={idx} className="px-8 py-5 flex items-center justify-between hover:bg-[#f9f1fc]/40 transition-all cursor-pointer group/item">
                                <div className="flex items-center gap-4">
                                  <div className="w-6 h-6 rounded-md bg-[#eef2ff] border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm group-hover/item:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-[16px] font-bold">check_box</span>
                                  </div>
                                  <div className="min-w-0 pr-4">
                                    <h5 className="font-bold text-[#170338] text-[13.5px] group-hover/item:text-[#4C2B74] transition-colors line-clamp-1">{task.title}</h5>
                                    <p className="text-[11px] text-[#5e636e] mt-1 font-medium">{task.subtitle}</p>
                                  </div>
                                </div>
                                <span className="text-[12px] font-medium text-[#5e636e] shrink-0">{task.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div> </div>
  );
};
export default Dashboard;