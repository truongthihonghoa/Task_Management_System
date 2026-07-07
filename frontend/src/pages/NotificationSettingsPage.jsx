import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  CheckSquare,
  Clock,
  FileText,
  Lock,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

const USER_NOTIFICATION_GROUPS = [
  {
    title: "Work assigned to you",
    description: "Notifications for tasks where you are directly involved.",
    items: [
      {
        key: "task_assigned",
        label: "You're assigned to a task",
        description: "A task is assigned to you in a space.",
        icon: UserPlus,
      },
      {
        key: "task_mentioned",
        label: "You're mentioned on a task",
        description: "Someone mentions you in a task description or comment.",
        icon: Users,
      },
    ],
  },
  {
    title: "Task updates",
    description: "Changes that matter to tasks you follow or work on.",
    items: [
      {
        key: "task_created",
        label: "A task is created in your space",
        description: "A new task is added to a space you can access.",
        icon: CheckSquare,
      },
      {
        key: "status_changed",
        label: "A task status changes",
        description: "A task moves between workflow states such as In Progress or Done.",
        icon: RefreshCw,
      },
      {
        key: "priority_changed",
        label: "A task priority changes",
        description: "A task priority is changed to High, Medium, or Low.",
        icon: AlertCircle,
      },
      {
        key: "due_today",
        label: "A task is due today",
        description: "Reminder for tasks reaching their due date today.",
        icon: Clock,
      },
      {
        key: "task_overdue",
        label: "A task is overdue",
        description: "A task misses its due date.",
        icon: AlertCircle,
      },
    ],
  },
  {
    title: "Comments and files",
    description: "Collaboration activity inside task details.",
    items: [
      {
        key: "comment_added",
        label: "A comment is added",
        description: "Someone comments on a task you are involved in.",
        icon: MessageSquare,
      },
      {
        key: "comment_edited",
        label: "A comment is edited",
        description: "Someone updates an existing task comment.",
        icon: MessageSquare,
      },
      {
        key: "comment_deleted",
        label: "A comment is deleted",
        description: "Someone removes a comment from a task.",
        icon: MessageSquare,
      },
      {
        key: "attachment_added",
        label: "An attachment is added",
        description: "A file is uploaded to a task.",
        icon: FileText,
      },
    ],
  },
];

const ADMIN_NOTIFICATION_GROUPS = [
  {
    title: "User management",
    description: "Account lifecycle events managed by administrators.",
    items: [
      {
        key: "user_registered",
        label: "New user registered",
        description: "A new user registers and may need verification.",
        icon: UserPlus,
      },
      {
        key: "user_verified",
        label: "User verified",
        description: "A user account is verified successfully.",
        icon: UserCheck,
      },
      {
        key: "account_locked",
        label: "Account locked",
        description: "A user account is locked after failed login attempts.",
        icon: Lock,
      },
      {
        key: "user_deactivated",
        label: "User deactivated",
        description: "An account is deactivated or removed from active use.",
        icon: Users,
      },
      {
        key: "role_changed",
        label: "Role or permission changed",
        description: "A user's role or access level is updated.",
        icon: ShieldCheck,
      },
    ],
  },
  {
    title: "Task oversight",
    description: "Operational changes across tasks and workflows.",
    items: [
      {
        key: "task_created",
        label: "A task is created",
        description: "A task is created in any managed space.",
        icon: CheckSquare,
      },
      {
        key: "task_updated",
        label: "A task is edited",
        description: "Task summary, assignee, status, priority, or dates are changed.",
        icon: RefreshCw,
      },
      {
        key: "task_deleted",
        label: "A task is deleted",
        description: "A task is removed from the system.",
        icon: AlertCircle,
      },
      {
        key: "comment_added",
        label: "A comment is added",
        description: "A new comment is added to a task.",
        icon: MessageSquare,
      },
      {
        key: "attachment_added",
        label: "An attachment is added",
        description: "A file is uploaded to a task.",
        icon: FileText,
      },
    ],
  },
  {
    title: "Spaces, audit, and security",
    description: "System-level activity that admins usually need to monitor.",
    items: [
      {
        key: "space_created",
        label: "A space is created",
        description: "A new workspace, board, or project space is created.",
        icon: FileText,
      },
      {
        key: "space_updated",
        label: "A space is updated",
        description: "A workspace, board, or project space settings are changed.",
        icon: FileText,
      },
      {
        key: "audit_log_event",
        label: "Audit log event recorded",
        description: "A security-sensitive action appears in audit logs.",
        icon: ShieldCheck,
      },
      {
        key: "system_alert",
        label: "System alert",
        description: "Critical system events and warnings.",
        icon: AlertCircle,
      },
    ],
  },
];

const FREQUENCY_OPTIONS = ["Instant", "Daily digest", "Weekly digest", "Off"];

const NotificationSettingsPage = () => {
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get("role")?.toUpperCase();
  const currentRole = roleParam === "USER" ? "USER" : "ADMIN";
  const isAdmin = currentRole === "ADMIN";

  const notificationGroups = isAdmin ? ADMIN_NOTIFICATION_GROUPS : USER_NOTIFICATION_GROUPS;
  const notificationItems = useMemo(
    () => notificationGroups.flatMap((group) => group.items),
    [notificationGroups]
  );

  const initialChannelState = useMemo(
    () => notificationItems.reduce((acc, item) => ({ ...acc, [item.key]: true }), {}),
    [notificationItems]
  );

  const storageKey = `notification-preferences-${currentRole.toLowerCase()}`;

  const getSavedPreferences = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  };

  const getSavedChannelSettings = (type) => {
    const saved = getSavedPreferences();
    return saved[type] ? { ...initialChannelState, ...saved[type] } : initialChannelState;
  };

  const [emailEnabled, setEmailEnabled] = useState(() => getSavedPreferences().emailEnabled ?? true);
  const [emailFrequency, setEmailFrequency] = useState(() => getSavedPreferences().emailFrequency || "Instant");
  const [emailSettings, setEmailSettings] = useState(() => getSavedChannelSettings("emailSettings"));
  const [appSettings, setAppSettings] = useState(() => getSavedChannelSettings("appSettings"));

  useEffect(() => {
    const saved = getSavedPreferences();
    setEmailEnabled(saved.emailEnabled ?? true);
    setEmailFrequency(saved.emailFrequency || "Instant");
    setEmailSettings(getSavedChannelSettings("emailSettings"));
    setAppSettings(getSavedChannelSettings("appSettings"));
  }, [storageKey, initialChannelState]);

  const toggleChannel = (channel, key) => {
    const setter = channel === "email" ? setEmailSettings : setAppSettings;
    setter((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setGroupChannel = (channel, items, checked) => {
    const setter = channel === "email" ? setEmailSettings : setAppSettings;
    setter((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        next[item.key] = checked;
      });
      return next;
    });
  };

  const isGroupChecked = (channelSettings, items) => items.every((item) => channelSettings[item.key]);

  const handleSave = () => {
    const preferences = {
      role: currentRole,
      emailEnabled,
      emailFrequency,
      emailSettings,
      appSettings,
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(storageKey, JSON.stringify(preferences));
    console.log("Notification preferences saved", preferences);
  };

  const ToggleSwitch = ({ checked, onChange, disabled = false }) => (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-[#4C2B74]" : "bg-gray-200"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );

  const ChannelCheckbox = ({ checked, disabled, onChange, label }) => (
    <label className={`inline-flex items-center justify-center ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
        className="h-4 w-4 rounded border-gray-300 accent-[#4C2B74]"
      />
    </label>
  );

  return (
    <div className="p-8 w-full h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="mb-8 flex-shrink-0">
        <h1 className="text-2xl font-bold text-[#4C2B74]">Notification Settings</h1>
        <p className="text-sm text-gray-500">
          {isAdmin
            ? "Manage admin alerts for users, tasks, spaces, audit logs, and system events."
            : "Choose how and when you want to be notified about your task work."}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Mail className="w-6 h-6 text-[#4C2B74]" />
              <h2 className="text-lg font-bold text-[#170338]">Email preferences</h2>
            </div>
            <p className="text-sm text-gray-500 mt-2 max-w-3xl">
              Tell us what kind of email updates you want to receive, and how often we should send them.
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            <div className="px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800">
                  {isAdmin ? "Send me admin email notifications" : "Send me emails for work item activity"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isAdmin
                    ? "Applies to user management, security, audit, system, and task oversight events."
                    : "Applies to assignments, mentions, task updates, comments, due dates, and attachments."}
                </p>
              </div>
              <ToggleSwitch checked={emailEnabled} onChange={() => setEmailEnabled((prev) => !prev)} />
            </div>

            <div className="px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Email frequency</h3>
                <p className="text-xs text-gray-500 mt-0.5">Choose whether emails are sent immediately or grouped into a digest.</p>
              </div>
              <select
                value={emailFrequency}
                disabled={!emailEnabled}
                onChange={(event) => setEmailFrequency(event.target.value)}
                className="w-full sm:w-48 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4C2B74]/20 disabled:bg-gray-50 disabled:text-gray-400"
              >
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-[#4C2B74]" />
              <h2 className="text-lg font-bold text-[#170338]">Default notifications</h2>
            </div>
            <p className="text-sm text-gray-500 mt-2 max-w-4xl">
              Set default notification channels for activity across your spaces.
            </p>
          </div>

          <div className="p-6 space-y-6 bg-gray-50/50">
            {notificationGroups.map((group) => (
              <div key={group.title} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="grid grid-cols-[1fr_96px_96px] items-center border-b border-gray-100 bg-white px-4 py-3 gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#170338]">{group.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{group.description}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1 text-[11px] font-bold text-gray-600">
                    <ChannelCheckbox
                      checked={isGroupChecked(appSettings, group.items)}
                      onChange={(event) => setGroupChannel("app", group.items, event.target.checked)}
                      label={`${group.title} in product`}
                    />
                    <span>In product</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 text-[11px] font-bold text-gray-600">
                    <ChannelCheckbox
                      checked={isGroupChecked(emailSettings, group.items)}
                      disabled={!emailEnabled || emailFrequency === "Off"}
                      onChange={(event) => setGroupChannel("email", group.items, event.target.checked)}
                      label={`${group.title} email`}
                    />
                    <span>Email</span>
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {group.items.map((item) => {
                    const IconComponent = item.icon;
                    const emailDisabled = !emailEnabled || emailFrequency === "Off";
                    return (
                      <div key={item.key} className="grid grid-cols-[1fr_96px_96px] items-center gap-3 px-4 py-4 hover:bg-[#FAF8FF]/60 transition-colors">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 rounded-lg bg-gray-50 p-2 shrink-0">
                            <IconComponent className="h-4 w-4 text-gray-500" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-gray-800">{item.label}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                          </div>
                        </div>
                        <ChannelCheckbox
                          checked={!!appSettings[item.key]}
                          onChange={() => toggleChannel("app", item.key)}
                          label={`${item.label} in product`}
                        />
                        <ChannelCheckbox
                          checked={!!emailSettings[item.key]}
                          disabled={emailDisabled}
                          onChange={() => toggleChannel("email", item.key)}
                          label={`${item.label} email`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-10 flex justify-end flex-shrink-0">
        <button
          onClick={handleSave}
          className="px-5 py-2.5 bg-[#2D1B4E] text-white text-sm font-bold rounded-lg hover:bg-[#3E225F] transition-all shadow-md shadow-[#4C2B74]/20"
        >
          Save Change
        </button>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E4E4E7;
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D4D4D8;
        }
      `}</style>
    </div>
  );
};

export default NotificationSettingsPage;