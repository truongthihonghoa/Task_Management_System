# Repository layer — pure data access only.
# Guide content is stored as static Python dictionaries.
# To migrate to a database or CMS in the future, only this file needs to change.
# The Service, API, and Frontend layers remain unchanged.

from typing import Optional

# ---------------------------------------------------------------------------
# Guide list metadata
# ---------------------------------------------------------------------------

_GUIDE_LIST = [
    {
        "id": "getting-started",
        "title": "Getting Started",
        "slug": "getting-started",
        "description": "A comprehensive walk-through to get you productive in TaskFlow within minutes.",
        "estimated_read_time": "5 min read",
    },
    {
        "id": "user-permissions",
        "title": "User Permissions",
        "slug": "user-permissions",
        "description": "Understand roles, access levels, and how to manage team permissions effectively.",
        "estimated_read_time": "4 min read",
    },
    {
        "id": "dashboard-overview",
        "title": "Dashboard Overview",
        "slug": "dashboard-overview",
        "description": "Get familiar with the TaskFlow dashboard, key metrics, and navigation shortcuts.",
        "estimated_read_time": "3 min read",
    },
    {
        "id": "task-management",
        "title": "Task Management",
        "slug": "task-management",
        "description": "Learn how to create, organize, assign, and track tasks across your spaces.",
        "estimated_read_time": "6 min read",
    },
]

# ---------------------------------------------------------------------------
# Full guide content
# ---------------------------------------------------------------------------

_GUIDE_DETAILS = {
    "getting-started": 
    {
        "title": "Getting Started",
        "introduction": (
            "Welcome to TaskFlow — a modern project and task management platform designed to help "
            "teams plan, track, and deliver work efficiently. This guide walks you through everything "
            "you need to know to get up and running, from creating your account to completing your "
            "first task."
        ),
        "estimated_read_time": "5 min read",
        "table_of_contents": [
            {"id": "overview", "title": "Overview"},
            {"id": "creating-your-account", "title": "Creating Your Account"},
            {"id": "logging-in", "title": "Logging In"},
            {"id": "navigating-the-interface", "title": "Navigating the Interface"},
            {"id": "your-first-task", "title": "Completing Your First Task"},
        ],
        "sections": [
            {
                "id": "overview",
                "title": "Overview",
                "content": (
                    "TaskFlow organises work around three core concepts: Spaces, Sprints, and Tasks. "
                    "A Space represents a project or team area. Within each Space, work is broken into "
                    "time-boxed Sprints. Tasks live inside Sprints and represent individual units of work "
                    "that can be assigned, tracked, and completed.\n\n"
                    "Your experience in TaskFlow depends on your role. Super Admins manage the entire "
                    "platform and all users. Space Owners manage their own project spaces and members. "
                    "Users participate in spaces they have been invited to."
                ),
                "steps": None,
                "tip": (
                    "TaskFlow adapts its navigation based on your role. Super Admins see a Dashboard "
                    "and Users menu; Space Owners and Members are taken directly to their Space on login."
                ),
            },
            {
                "id": "creating-your-account",
                "title": "Creating Your Account",
                "content": (
                    "New accounts are created via the Register page. Fill in your details and submit "
                    "the form. TaskFlow will send a verification email to the address you provided."
                ),
                "steps": [
                    {
                        "step": 1,
                        "title": "Open the Register page",
                        "description": (
                            "Navigate to the TaskFlow URL and click the 'Register' link on the Login page."
                        ),
                    },
                    {
                        "step": 2,
                        "title": "Fill in your details",
                        "description": (
                            "Enter your full name, email address, and a strong password. "
                            "The password must meet the minimum security requirements shown on screen."
                        ),
                    },
                    {
                        "step": 3,
                        "title": "Submit the registration form",
                        "description": (
                            "Click the 'Create Account' button. A verification email will be sent "
                            "to the address you provided."
                        ),
                    },
                    {
                        "step": 4,
                        "title": "Verify your email address",
                        "description": (
                            "Open the verification email and click the confirmation link. "
                            "Your account will be activated and you will be redirected to the Login page."
                        ),
                    },
                ],
                "tip": (
                    "Check your spam or junk folder if the verification email does not arrive within "
                    "a few minutes. The link expires after 24 hours."
                ),
            },
            {
                "id": "logging-in",
                "title": "Logging In",
                "content": (
                    "Use the Login page to access your TaskFlow account. If you forget your password, "
                    "you can reset it at any time using the Forgot Password flow."
                ),
                "steps": [
                    {
                        "step": 1,
                        "title": "Navigate to the Login page",
                        "description": "Open the TaskFlow URL in your browser.",
                    },
                    {
                        "step": 2,
                        "title": "Enter your credentials",
                        "description": "Type your registered email address and password.",
                    },
                    {
                        "step": 3,
                        "title": "Click Sign In",
                        "description": (
                            "You will be redirected to your default landing page — the Dashboard "
                            "for Super Admins, or the Spaces page for all other roles."
                        ),
                    },
                ],
                "tip": (
                    "If your account is locked after too many failed login attempts, contact your "
                    "Super Admin to unlock it. Admins can do this from the User Management page."
                ),
            },
            {
                "id": "navigating-the-interface",
                "title": "Navigating the Interface",
                "content": (
                    "The TaskFlow interface consists of a left sidebar for primary navigation, "
                    "a top header bar with search and notifications, and a main content area.\n\n"
                    "The sidebar contains links to Dashboard (Super Admin only), Tasks/Spaces, "
                    "Users (Super Admin only), and at the bottom: Help and Settings. "
                    "You can collapse the sidebar using the menu icon (☰) in the top-left corner "
                    "of the header to maximise your workspace."
                ),
                "steps": None,
                "tip": (
                    "Use the global search bar in the top header to quickly find spaces, tasks, "
                    "or users by name, ID, or status — without leaving your current page."
                ),
            },
            {
                "id": "your-first-task",
                "title": "Completing Your First Task",
                "content": (
                    "Tasks are the core unit of work in TaskFlow. Once you have been added to a "
                    "Space, you can view, create, and update tasks within that Space."
                ),
                "steps": [
                    {
                        "step": 1,
                        "title": "Open a Space",
                        "description": (
                            "Click 'Tasks' in the sidebar to go to the Spaces list. "
                            "Click on the Space you want to work in."
                        ),
                    },
                    {
                        "step": 2,
                        "title": "Select a Sprint",
                        "description": (
                            "Inside the Space, choose an active Sprint from the Sprint selector "
                            "to view its task board."
                        ),
                    },
                    {
                        "step": 3,
                        "title": "Create a task",
                        "description": (
                            "Click the '+ Create Task' button (or use the global Create button in "
                            "the header). Fill in the task title, description, priority, assignees, "
                            "and due date, then click Save."
                        ),
                    },
                    {
                        "step": 4,
                        "title": "Update the task status",
                        "description": (
                            "Move the task through the workflow by changing its status: "
                            "New → In Progress → In Testing → Pending Review → Done."
                        ),
                    },
                ],
                "tip": None,
            },
        ],
        "tips": [
            "Use the global search (Ctrl + K shortcut concept) to navigate to any space or task instantly.",
            "Bookmark the direct URL of your most-used Space for faster daily access.",
            "Set your notification preferences in Settings → Notification Settings so you only receive alerts that matter to you.",
            "Your profile avatar and display name are visible to all team members — keep them up to date in the Profile page.",
        ],
        "related_guides": [
            {
                "slug": "dashboard-overview",
                "title": "Dashboard Overview",
                "description": "Understand the key metrics and widgets available on your Dashboard.",
            },
            {
                "slug": "task-management",
                "title": "Task Management",
                "description": "Learn advanced task management — statuses, assignees, attachments, and sprints.",
            },
        ],
    },

    # ------------------------------------------------------------------
    "user-permissions": {
        "title": "User Permissions",
        "introduction": (
            "TaskFlow uses a role-based access control (RBAC) model to ensure every team member "
            "sees and can do exactly what their role requires — no more, no less. "
            "This guide explains the three roles in the system, what each role can do, "
            "and how Super Admins manage user accounts and permissions."
        ),
        "estimated_read_time": "4 min read",
        "table_of_contents": [
            {"id": "role-overview", "title": "Role Overview"},
            {"id": "super-admin", "title": "Super Admin"},
            {"id": "space-owner", "title": "Space Owner"},
            {"id": "user", "title": "User (Member)"},
            {"id": "managing-permissions", "title": "Managing User Accounts"},
        ],
        "sections": [
            {
                "id": "role-overview",
                "title": "Role Overview",
                "content": (
                    "TaskFlow defines three distinct roles. Each role is assigned system-wide "
                    "and determines which pages, actions, and data a person can access.\n\n"
                    "| Role | Scope | Key Capabilities |\n"
                    "|------|-------|------------------|\n"
                    "| Super Admin | Platform-wide | Full access to all users, spaces, and settings |\n"
                    "| Space Owner | Within their Space | Manage space members, tasks, and sprints |\n"
                    "| User | Within assigned Spaces | View and update tasks they are assigned to |"
                ),
                "steps": None,
                "tip": (
                    "A user can be a Space Owner in one space and a regular Member in another — "
                    "ownership is per-space, not platform-wide."
                ),
            },
            {
                "id": "super-admin",
                "title": "Super Admin",
                "content": (
                    "The Super Admin role provides complete, unrestricted access to the entire "
                    "TaskFlow platform. Super Admins are responsible for user lifecycle management "
                    "and platform-level oversight.\n\n"
                    "Super Admins can:\n"
                    "• View and access the full Dashboard with platform-wide metrics.\n"
                    "• Access the Users page to view, search, and manage all registered accounts.\n"
                    "• Activate, deactivate, lock, or unlock any user account.\n"
                    "• View and access all Spaces across the platform.\n"
                    "• Receive platform-level notifications (e.g., new registrations, account locks, permission changes).\n"
                    "• Access audit logs for security-sensitive actions."
                ),
                "steps": None,
                "tip": (
                    "Super Admin accounts should be kept to the minimum necessary. "
                    "Each Super Admin action is audit-logged for security and compliance."
                ),
            },
            {
                "id": "space-owner",
                "title": "Space Owner",
                "content": (
                    "A Space Owner manages a specific project Space. They are responsible for "
                    "configuring the Space, managing its members, and overseeing task and sprint work "
                    "within it.\n\n"
                    "Space Owners can:\n"
                    "• Create, edit, and archive their Space.\n"
                    "• Add or remove members from their Space.\n"
                    "• Create and manage Sprints within their Space.\n"
                    "• Create, assign, and update all tasks in their Space.\n"
                    "• Receive Space-level notifications (member added, sprint changes, task updates).\n\n"
                    "Space Owners cannot:\n"
                    "• Access the platform-wide Users management page.\n"
                    "• View or modify other users' accounts."
                ),
                "steps": None,
                "tip": None,
            },
            {
                "id": "user",
                "title": "User (Member)",
                "content": (
                    "The User role (also referred to as Member) is the default role for anyone "
                    "invited to a Space. Members participate in project work but have a limited "
                    "administrative scope.\n\n"
                    "Users can:\n"
                    "• View all tasks and sprints within Spaces they are members of.\n"
                    "• Create tasks within their Space (if permitted by the Space Owner).\n"
                    "• Update the status and details of tasks assigned to them.\n"
                    "• Add comments and attachments to tasks.\n"
                    "• View and update their own profile and notification preferences.\n\n"
                    "Users cannot:\n"
                    "• Access the Dashboard (redirected to their Space on login).\n"
                    "• Manage other users or user accounts.\n"
                    "• Add or remove Space members.\n"
                    "• Access Spaces they have not been added to."
                ),
                "steps": None,
                "tip": (
                    "Members only see the Spaces and tasks relevant to them — "
                    "ensuring a focused, clutter-free workspace."
                ),
            },
            {
                "id": "managing-permissions",
                "title": "Managing User Accounts",
                "content": (
                    "Super Admins manage all user accounts from the Users page "
                    "(/dashboard/users). The following actions are available."
                ),
                "steps": [
                    {
                        "step": 1,
                        "title": "Open the Users page",
                        "description": (
                            "Log in as a Super Admin and click 'Users' in the left sidebar."
                        ),
                    },
                    {
                        "step": 2,
                        "title": "Search for a user",
                        "description": (
                            "Use the search bar to find users by name, email, or status. "
                            "You can also filter by Active, Inactive, or Locked status."
                        ),
                    },
                    {
                        "step": 3,
                        "title": "View user details",
                        "description": (
                            "Click on a user row to open their profile, including their role, "
                            "registration date, last login, and account status."
                        ),
                    },
                    {
                        "step": 4,
                        "title": "Take an action",
                        "description": (
                            "Use the action buttons to Activate, Deactivate, Lock, or Unlock "
                            "the account as needed. All actions are logged in the audit trail."
                        ),
                    },
                ],
                "tip": (
                    "Locking an account immediately prevents the user from logging in — "
                    "useful for security incidents. Deactivating is a softer action for "
                    "off-boarding team members."
                ),
            },
        ],
        "tips": [
            "Assign the Super Admin role only to trusted administrators — it grants unrestricted platform access.",
            "Review user account statuses regularly. Deactivate accounts for team members who have left the project.",
            "Space Owners should keep their member list updated to ensure notifications and task assignments are accurate.",
            "When a user reports they cannot access a Space, check that they have been added as a member by the Space Owner.",
        ],
        "related_guides": [
            {
                "slug": "getting-started",
                "title": "Getting Started",
                "description": "New to TaskFlow? Start here to set up your account and learn the basics.",
            },
            {
                "slug": "dashboard-overview",
                "title": "Dashboard Overview",
                "description": "Explore the Super Admin Dashboard and its platform-wide metrics.",
            },
        ],
    },

    # ------------------------------------------------------------------
    "dashboard-overview": {
        "title": "Dashboard Overview",
        "introduction": (
            "The TaskFlow Dashboard is the central hub for Super Admins to monitor the health "
            "of the entire platform at a glance. It surfaces key metrics, recent activity, "
            "and quick-access shortcuts — so you can stay informed and act fast without "
            "navigating deep into the app."
        ),
        "estimated_read_time": "3 min read",
        "table_of_contents": [
            {"id": "who-sees-the-dashboard", "title": "Who Sees the Dashboard"},
            {"id": "key-metrics", "title": "Key Metrics"},
            {"id": "recent-activity", "title": "Recent Activity & Notifications"},
            {"id": "quick-navigation", "title": "Quick Navigation"},
            {"id": "search-bar", "title": "Using the Global Search"},
        ],
        "sections": [
            {
                "id": "who-sees-the-dashboard",
                "title": "Who Sees the Dashboard",
                "content": (
                    "The Dashboard is exclusively available to Super Admins. "
                    "When a Super Admin logs in, they land on the Dashboard page (/dashboard). "
                    "Space Owners and regular Users are redirected to the Spaces page (/dashboard/spaces) "
                    "on login, as their work is scoped to specific project spaces rather than the "
                    "platform as a whole."
                ),
                "steps": None,
                "tip": (
                    "You can switch between the Super Admin view and a User view for testing "
                    "by appending '?role=USER' or '?role=ADMIN' to the URL."
                ),
            },
            {
                "id": "key-metrics",
                "title": "Key Metrics",
                "content": (
                    "The top section of the Dashboard displays summary cards with platform-wide statistics:\n\n"
                    "• **Total Users** — The number of registered accounts on the platform, with a "
                    "breakdown of Active vs. Inactive.\n"
                    "• **Active Spaces** — How many project Spaces are currently active.\n"
                    "• **Total Tasks** — The total number of tasks across all Spaces.\n"
                    "• **Tasks In Progress** — Tasks currently marked as 'In Progress' or 'In Testing'.\n\n"
                    "These numbers update in real time as your team works, giving you an accurate "
                    "snapshot of platform activity."
                ),
                "steps": None,
                "tip": None,
            },
            {
                "id": "recent-activity",
                "title": "Recent Activity & Notifications",
                "content": (
                    "The notification bell icon in the top-right corner of the header shows a "
                    "badge with your unread notification count. Clicking it opens a dropdown with "
                    "your most recent notifications, grouped by time (Today, Yesterday, Earlier).\n\n"
                    "Super Admins receive platform-level notifications including:\n"
                    "• New user registrations\n"
                    "• Account lock events (failed login attempts)\n"
                    "• User email verifications\n"
                    "• Permission or role changes\n"
                    "• Audit log security events\n\n"
                    "Click 'View All Notifications' within the dropdown to open the full Notifications "
                    "modal, where you can filter by type, mark items as read, or delete notifications."
                ),
                "steps": None,
                "tip": (
                    "Mark all notifications as read in one click using the 'Mark all as read' button "
                    "at the top of the notification dropdown."
                ),
            },
            {
                "id": "quick-navigation",
                "title": "Quick Navigation",
                "content": (
                    "The left sidebar provides one-click access to all major sections of TaskFlow:\n\n"
                    "• **Dashboard** (Super Admin only) — Platform overview\n"
                    "• **Tasks** — Spaces and task boards\n"
                    "• **Users** (Super Admin only) — User management\n"
                    "• **Help** — Help Center and guides\n"
                    "• **Settings** — Notification preferences\n\n"
                    "The sidebar can be collapsed using the hamburger menu (☰) in the top header "
                    "to give the main content area more room."
                ),
                "steps": None,
                "tip": None,
            },
            {
                "id": "search-bar",
                "title": "Using the Global Search",
                "content": (
                    "The search bar in the top header lets you find anything across the platform "
                    "without leaving your current page. As you type, a dropdown shows matching results "
                    "grouped by category."
                ),
                "steps": [
                    {
                        "step": 1,
                        "title": "Click the search bar",
                        "description": (
                            "The search bar is located in the top-left area of the header. "
                            "Click it or start typing to activate it."
                        ),
                    },
                    {
                        "step": 2,
                        "title": "Type your query",
                        "description": (
                            "Enter a space name, task ID (e.g., TM-3), task title, "
                            "or user name. Results appear instantly as you type."
                        ),
                    },
                    {
                        "step": 3,
                        "title": "Click a result",
                        "description": (
                            "Click any result in the dropdown to navigate directly to that "
                            "Space, Task, or User — the page loads immediately."
                        ),
                    },
                ],
                "tip": (
                    "Super Admins can search for users by name or email directly from the global "
                    "search bar. Regular users can search for spaces and tasks only."
                ),
            },
        ],
        "tips": [
            "Keep the Dashboard open in a pinned browser tab for an always-on view of platform activity.",
            "Use the notification bell regularly — Super Admin alerts often require prompt action (e.g., locked accounts).",
            "Collapse the sidebar on smaller screens to maximise the Dashboard content area.",
            "The global search is the fastest way to navigate — use it before clicking through the sidebar.",
        ],
        "related_guides": [
            {
                "slug": "user-permissions",
                "title": "User Permissions",
                "description": "Learn about roles and how Super Admins manage user accounts.",
            },
            {
                "slug": "task-management",
                "title": "Task Management",
                "description": "Dive into spaces, sprints, tasks, and the full task lifecycle.",
            },
        ],
    },

    # ------------------------------------------------------------------
    "task-management": {
        "title": "Task Management",
        "introduction": (
            "Tasks are at the heart of TaskFlow. They represent the individual units of work "
            "your team needs to complete to deliver a project. This guide covers how to "
            "organise your work using Spaces and Sprints, create and update tasks, manage "
            "assignees, and collaborate through comments and attachments."
        ),
        "estimated_read_time": "6 min read",
        "table_of_contents": [
            {"id": "spaces-and-sprints", "title": "Spaces & Sprints"},
            {"id": "creating-tasks", "title": "Creating Tasks"},
            {"id": "task-statuses", "title": "Task Statuses"},
            {"id": "managing-assignees", "title": "Managing Assignees"},
            {"id": "comments-and-attachments", "title": "Comments & Attachments"},
            {"id": "filtering-and-sorting", "title": "Filtering & Sorting Tasks"},
        ],
        "sections": [
            {
                "id": "spaces-and-sprints",
                "title": "Spaces & Sprints",
                "content": (
                    "Work in TaskFlow is organised into Spaces (projects) and Sprints (time-boxed "
                    "iterations within a project).\n\n"
                    "A **Space** is a dedicated area for a project or team. Each Space has an owner, "
                    "a list of members, and a status (Active or Archived). Spaces can be created "
                    "and managed from the Space Management page (/dashboard/spaces).\n\n"
                    "A **Sprint** groups tasks into a defined time period. Sprints help teams focus "
                    "on a specific set of work before moving on. Within each Space, you can create "
                    "multiple sprints with statuses: Planned, Active, Completed."
                ),
                "steps": [
                    {
                        "step": 1,
                        "title": "Open the Spaces page",
                        "description": "Click 'Tasks' in the left sidebar to open the Spaces list.",
                    },
                    {
                        "step": 2,
                        "title": "Select or create a Space",
                        "description": (
                            "Click an existing Space card to open it, or click 'Create Space' "
                            "to start a new project (Super Admin or Space Owner only)."
                        ),
                    },
                    {
                        "step": 3,
                        "title": "Navigate to a Sprint",
                        "description": (
                            "Inside the Space, use the Sprint selector at the top of the task board "
                            "to choose an active sprint. The task board refreshes to show tasks "
                            "belonging to the selected sprint."
                        ),
                    },
                ],
                "tip": (
                    "Archive a Space when a project is complete — it hides it from the active list "
                    "but preserves all tasks and history for future reference."
                ),
            },
            {
                "id": "creating-tasks",
                "title": "Creating Tasks",
                "content": (
                    "Tasks can be created from two places: the global 'Create' button in the "
                    "header, or the sprint-level '+ Add Task' button within a task board column."
                ),
                "steps": [
                    {
                        "step": 1,
                        "title": "Open the Create Task form",
                        "description": (
                            "Click the '+ Create' button in the top-right area of the header, "
                            "or click the '+ Add Task' button at the bottom of any status column "
                            "on the task board."
                        ),
                    },
                    {
                        "step": 2,
                        "title": "Enter the task details",
                        "description": (
                            "Provide a task title (required) and an optional description. "
                            "Use the rich text editor to format the description with headings, "
                            "bullet points, or code blocks."
                        ),
                    },
                    {
                        "step": 3,
                        "title": "Set priority and due date",
                        "description": (
                            "Choose a priority level — High, Medium, or Low. "
                            "Optionally set a due date to surface the task in deadline views."
                        ),
                    },
                    {
                        "step": 4,
                        "title": "Assign team members",
                        "description": (
                            "Select one or more assignees from the Space's member list. "
                            "Assigned users will receive a notification when the task is saved."
                        ),
                    },
                    {
                        "step": 5,
                        "title": "Save the task",
                        "description": (
                            "Click 'Save' or 'Create Task'. The task appears on the board "
                            "under the 'New' status column."
                        ),
                    },
                ],
                "tip": (
                    "Write clear, actionable task titles. Instead of 'Fix bug', use "
                    "'Fix login redirect bug on mobile Safari' — this helps assignees "
                    "understand the work without opening the task."
                ),
            },
            {
                "id": "task-statuses",
                "title": "Task Statuses",
                "content": (
                    "Every task moves through a defined workflow. TaskFlow uses the following "
                    "status stages:\n\n"
                    "• **New** — The task has been created but work has not started.\n"
                    "• **In Progress** — A team member is actively working on the task.\n"
                    "• **In Testing** — The work is complete and is being tested or reviewed.\n"
                    "• **Pending Review** — The task is waiting for a final review or sign-off.\n"
                    "• **Need Revision** — Feedback has been given; the task requires rework.\n"
                    "• **Done** — The task is fully complete and accepted.\n"
                    "• **Cancelled** — The task has been cancelled and will not be completed.\n\n"
                    "You can change a task's status by opening the task detail panel and "
                    "selecting a new status from the status dropdown, or by dragging the task "
                    "card between columns on the Kanban board."
                ),
                "steps": None,
                "tip": (
                    "Use 'Need Revision' instead of reopening a Done task — it preserves the "
                    "history of the review cycle and makes reporting more accurate."
                ),
            },
            {
                "id": "managing-assignees",
                "title": "Managing Assignees",
                "content": (
                    "Tasks in TaskFlow support multiple assignees — useful for pair work "
                    "or tasks that span across roles. Assignee management is available "
                    "in the task detail panel."
                ),
                "steps": [
                    {
                        "step": 1,
                        "title": "Open the task detail panel",
                        "description": "Click on any task card on the board to open its detail view.",
                    },
                    {
                        "step": 2,
                        "title": "Add an assignee",
                        "description": (
                            "In the Assignees section, click the '+ Assign' button and select "
                            "a member from the Space's member list. Each new assignee receives "
                            "a notification."
                        ),
                    },
                    {
                        "step": 3,
                        "title": "Reassign or remove an assignee",
                        "description": (
                            "To reassign, select a different team member as a replacement. "
                            "To remove, click the remove icon next to the assignee's name. "
                            "Optionally, provide a reason for the change."
                        ),
                    },
                ],
                "tip": (
                    "Keep the assignee list focused — too many assignees on a single task "
                    "often signals the task needs to be broken down into smaller sub-tasks."
                ),
            },
            {
                "id": "comments-and-attachments",
                "title": "Comments & Attachments",
                "content": (
                    "Collaboration happens directly on the task. The task detail panel includes "
                    "a comments thread and an attachments section — keeping all context in one place."
                ),
                "steps": [
                    {
                        "step": 1,
                        "title": "Add a comment",
                        "description": (
                            "Scroll to the Comments section in the task detail panel. "
                            "Type your comment in the input field and click 'Send' or "
                            "press Enter to post it. All Space members will be notified."
                        ),
                    },
                    {
                        "step": 2,
                        "title": "Attach a file",
                        "description": (
                            "Click the 'Attach File' button in the Attachments section. "
                            "Select a file from your device. Supported file types include "
                            "images, PDFs, and common document formats."
                        ),
                    },
                    {
                        "step": 3,
                        "title": "View or download attachments",
                        "description": (
                            "All attached files are listed in the Attachments section. "
                            "Click a file name to preview or download it."
                        ),
                    },
                ],
                "tip": (
                    "Use comments to document decisions made during a task — "
                    "this creates a searchable audit trail that helps future team members "
                    "understand why certain choices were made."
                ),
            },
            {
                "id": "filtering-and-sorting",
                "title": "Filtering & Sorting Tasks",
                "content": (
                    "When a sprint contains many tasks, filters and sorting help you focus on "
                    "what matters. The task board and list view both support filtering."
                ),
                "steps": [
                    {
                        "step": 1,
                        "title": "Open the filter panel",
                        "description": (
                            "Click the 'Filter' button near the top of the task board. "
                            "A filter panel will appear with available filter options."
                        ),
                    },
                    {
                        "step": 2,
                        "title": "Apply filters",
                        "description": (
                            "Filter tasks by: Status, Priority, Assignee, or Due Date. "
                            "Multiple filters can be applied simultaneously."
                        ),
                    },
                    {
                        "step": 3,
                        "title": "Sort the task list",
                        "description": (
                            "Use the sort dropdown to order tasks by Newest, Oldest, "
                            "Priority, or Due Date."
                        ),
                    },
                    {
                        "step": 4,
                        "title": "Clear filters",
                        "description": (
                            "Click 'Clear Filters' to reset the board and show all tasks "
                            "in the selected sprint."
                        ),
                    },
                ],
                "tip": (
                    "Filter by your own name in the Assignee filter to create a personal "
                    "view of just the tasks assigned to you — great for daily stand-ups."
                ),
            },
        ],
        "tips": [
            "Break large tasks into smaller, focused tasks. Smaller tasks are easier to estimate, assign, and track.",
            "Set due dates on high-priority tasks so they surface in deadline views and trigger timely notifications.",
            "Use the task description to include acceptance criteria — this removes ambiguity and speeds up the review process.",
            "Keep the Kanban board up to date by moving tasks as soon as their status changes — stale boards reduce team trust in the tool.",
            "Attach relevant design files, specs, or screenshots directly to tasks to avoid hunting through emails or chat messages.",
        ],
        "related_guides": [
            {
                "slug": "getting-started",
                "title": "Getting Started",
                "description": "New to TaskFlow? Start here to learn the basics and set up your account.",
            },
            {
                "slug": "user-permissions",
                "title": "User Permissions",
                "description": "Understand what Space Owners and Members can do within a Space.",
            },
        ],
    },
}


# ---------------------------------------------------------------------------
# Public accessor functions
# ---------------------------------------------------------------------------

def get_all_guides() -> list[dict]:
    """Return a list of all guide metadata dictionaries."""
    return list(_GUIDE_LIST)


def get_guide_by_slug(slug: str) -> Optional[dict]:
    """Return the full guide content dictionary for the given slug, or None if not found."""
    return _GUIDE_DETAILS.get(slug)
