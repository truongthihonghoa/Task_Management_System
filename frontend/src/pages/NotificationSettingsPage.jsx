import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AtSign,
  Bell,
  CalendarClock,
  CheckSquare,
  Lock,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import {
  getNotificationPreference,
  resetNotificationPreference,
  updateNotificationPreference,
} from "../api/notificationPreferencesApi";
import { useAuth } from "../context/AuthContext";

const MEMBER_NOTIFICATION_GROUPS = [
  {
    title: "Task activity",
    description: "Flexible defaults for task updates across spaces you belong to.",
    items: [
      {
        key: "task_assigned",
        label: "Task assigned to me",
        description: "Notify me when a task is assigned to me.",
        icon: UserPlus,
      },
      {
        key: "status_changed",
        label: "Task status changed",
        description: "Notify me when a task I follow changes workflow status.",
        icon: RefreshCw,
      },
      {
        key: "comment_added",
        label: "Comment added",
        description: "Notify me when someone adds a comment to a task I follow.",
        icon: MessageSquare,
      },
      {
        key: "due_date_changed",
        label: "Due date changed",
        description: "Notify me when a task due date is changed.",
        icon: CalendarClock,
      },
      {
        key: "task_mentioned",
        label: "Mentioned in comment",
        description: "Notify me when someone mentions me in a comment.",
        icon: AtSign,
      },
    ],
  },
  {
    title: "Space activity",
    description: "Space-level changes that matter whether you are a member or an owner.",
    items: [
      {
        key: "space_member_added",
        label: "Space member added",
        description: "Notify me when a member is added to a space I can access.",
        icon: Users,
      },
      {
        key: "space_role_changed",
        label: "Space role changed",
        description: "Notify me when my role or another visible member role changes.",
        icon: ShieldCheck,
      },
      {
        key: "owner_space_update",
        label: "Owner-level space updates",
        description: "Notify me about settings, membership, and control updates in spaces where I am Owner.",
        icon: Lock,
      },
    ],
  },
];

const SUPER_ADMIN_NOTIFICATION_GROUPS = [
  {
    title: "Account lifecycle",
    description: "System-wide account events that require Super Admin visibility.",
    items: [
      {
        key: "user_registered",
        label: "New user registered",
        description: "A new user registers and may need verification.",
        icon: UserPlus,
      },
      {
        key: "account_locked",
        label: "Account locked",
        description: "A user account is locked after failed login attempts.",
        icon: Lock,
      },
      {
        key: "user_verified",
        label: "User verified",
        description: "A user account is verified successfully.",
        icon: UserCheck,
      },
      {
        key: "user_deactivated",
        label: "User deactivated/reactivated",
        description: "A user account is deactivated or reactivated.",
        icon: Users,
      },
      {
        key: "role_changed",
        label: "Role changed",
        description: "A user's system role changes.",
        icon: ShieldCheck,
      },
    ],
  },
  {
    title: "Security and permissions",
    description: "High-signal system notifications for access control and audit trails.",
    items: [
      {
        key: "permission_changed",
        label: "Important permission changes",
        description: "A user or group receives sensitive permission changes.",
        icon: ShieldCheck,
      },
      {
        key: "audit_log_event",
        label: "System audit/security events",
        description: "Security-sensitive events are recorded in audit logs.",
        icon: AlertCircle,
      },
      {
        key: "system_alert",
        label: "System alert",
        description: "A critical system-level alert needs Super Admin visibility.",
        icon: AlertCircle,
      },
    ],
  },
];

const FREQUENCY_OPTIONS = [
  { label: "Instant", value: "INSTANT" },
  { label: "Off", value: "OFF" },
];

const NotificationSettingsPage = () => {
  const { user: authUser } = useAuth();
  const isSuperAdmin = authUser?.role === "SUPER_ADMIN";
  const scope = isSuperAdmin ? "SUPER_ADMIN" : "USER_ACCOUNT";

  const notificationGroups = useMemo(() => {
    if (isSuperAdmin) return SUPER_ADMIN_NOTIFICATION_GROUPS;
    return MEMBER_NOTIFICATION_GROUPS;
  }, [isSuperAdmin]);

  const notificationItems = useMemo(
    () => notificationGroups.flatMap((group) => group.items),
    [notificationGroups]
  );

  const initialChannelState = useMemo(
    () => notificationItems.reduce((acc, item) => ({ ...acc, [item.key]: true }), {}),
    [notificationItems]
  );

  const frequencyOptions = FREQUENCY_OPTIONS;

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailFrequency, setEmailFrequency] = useState("INSTANT");
  const [emailSettings, setEmailSettings] = useState(initialChannelState);
  const [appSettings, setAppSettings] = useState(initialChannelState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!errorMessage && !successMessage) return undefined;

    const timerId = window.setTimeout(() => {
      setErrorMessage("");
      setSuccessMessage("");
    }, 4000);

    return () => window.clearTimeout(timerId);
  }, [errorMessage, successMessage]);

  const applyPreference = (preference) => {
    setEmailEnabled(preference.email_enabled ?? true);
    setEmailFrequency(
      frequencyOptions.some((option) => option.value === preference.email_frequency)
        ? preference.email_frequency
        : "INSTANT",
    );
    setEmailSettings({ ...initialChannelState, ...(preference.email_settings || {}) });
    setAppSettings({ ...initialChannelState, ...(preference.app_settings || {}) });
  };

  useEffect(() => {
    let isMounted = true;

    async function loadPreference() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const preference = await getNotificationPreference(scope);
        if (!isMounted) return;
        applyPreference(preference);
      } catch (error) {
        if (!isMounted) return;
        const detail = error?.response?.data?.detail || error?.response?.data?.message;
        setErrorMessage(typeof detail === "string" ? detail : "Unable to load notification preferences.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPreference();

    return () => {
      isMounted = false;
    };
  }, [scope, initialChannelState]);

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

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const preference = await updateNotificationPreference(scope, {
        email_enabled: emailEnabled,
        email_frequency: emailFrequency,
        email_settings: emailSettings,
        app_settings: appSettings,
      });
      applyPreference(preference);
      setSuccessMessage("Notification preferences saved.");
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.response?.data?.message;
      setErrorMessage(typeof detail === "string" ? detail : "Unable to save notification preferences.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const preference = await resetNotificationPreference(scope);
      applyPreference(preference);
      setSuccessMessage("Notification preferences reset to defaults.");
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.response?.data?.message;
      setErrorMessage(typeof detail === "string" ? detail : "Unable to reset notification preferences.");
    } finally {
      setIsSaving(false);
    }
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
          {isSuperAdmin
            ? "Manage Super Admin alerts for accounts, permissions, audit logs, and security events."
            : "Manage one notification setting shared across all spaces where you are a member or an owner."}
        </p>
      </div>

      {(isLoading || errorMessage || successMessage) && (
        <div className="mb-4 flex-shrink-0 space-y-2">
          {isLoading && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
              Loading notification preferences...
            </div>
          )}
          {errorMessage && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              {successMessage}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Mail className="w-6 h-6 text-[#4C2B74]" />
              <h2 className="text-lg font-bold text-[#170338]">Email preferences</h2>
            </div>
            <p className="text-sm text-gray-500 mt-2 max-w-3xl">
              {isSuperAdmin
                ? "Control email delivery for system-level alerts only."
                : "Tell us what kind of email updates you want to receive, and how often we should send them."}
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            <div className="px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800">
                  {isSuperAdmin ? "Send me system email alerts" : "Send me emails for space and task activity"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isSuperAdmin
                    ? "Applies only to account lifecycle, permission, audit, and security events."
                    : "Applies to task, comment, mention, member, role, and owner-level space updates across your account."}
                </p>
              </div>
              <ToggleSwitch checked={emailEnabled} onChange={() => setEmailEnabled((prev) => !prev)} />
            </div>

            <div className="px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Email frequency</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isSuperAdmin
                    ? "System alerts can be sent immediately or turned off."
                    : "Choose whether emails are sent immediately or turned off."}
                </p>
              </div>
              <select
                value={emailFrequency}
                disabled={!emailEnabled}
                onChange={(event) => setEmailFrequency(event.target.value)}
                className="w-full sm:w-48 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4C2B74]/20 disabled:bg-gray-50 disabled:text-gray-400"
              >
                {frequencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-[#4C2B74]" />
              <h2 className="text-lg font-bold text-[#170338]">
                {isSuperAdmin ? "System notification channels" : "Default notifications"}
              </h2>
            </div>
            <p className="text-sm text-gray-500 mt-2 max-w-4xl">
              {isSuperAdmin
                ? "Only Super Admin account, permission, audit, and security settings are shown here."
                : "Set default channels once for every space. Owner-level options only apply to spaces where you are Owner."}
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
                      disabled={!emailEnabled || emailFrequency === "OFF"}
                      onChange={(event) => setGroupChannel("email", group.items, event.target.checked)}
                      label={`${group.title} email`}
                    />
                    <span>Email</span>
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {group.items.map((item) => {
                    const IconComponent = item.icon;
                    const emailDisabled = !emailEnabled || emailFrequency === "OFF";
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

      <div className="mt-10 flex justify-end gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={handleResetDefaults}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-lg bg-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reset defaults
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 bg-[#2D1B4E] text-white text-sm font-bold rounded-lg hover:bg-[#3E225F] transition-all shadow-md shadow-[#4C2B74]/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Change"}
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
