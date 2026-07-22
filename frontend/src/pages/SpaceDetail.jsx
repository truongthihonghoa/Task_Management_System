import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

const LAYOUT_QUERY_KEYS = ['role', 'spaceRole', 'user'];

const getLayoutQueryParams = (search) => {
  const currentParams = new URLSearchParams(search);
  const nextParams = new URLSearchParams();

  LAYOUT_QUERY_KEYS.forEach((key) => {
    const value = currentParams.get(key);
    if (value) {
      nextParams.set(key, value);
    }
  });

  return nextParams;
};

const getErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail || error?.response?.data?.message;
  if (Array.isArray(detail)) {
    return detail.map(item => item?.msg || String(item)).join(', ') || fallback;
  }
  return detail || error?.message || fallback;
};

const parseApiDateTime = (value) => {
  if (typeof value !== 'string') return new Date(value);

  const trimmedValue = value.trim();
  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmedValue);
  const isDateTime = /^\d{4}-\d{2}-\d{2}T/.test(trimmedValue);

  return new Date(isDateTime && !hasTimezone ? `${trimmedValue}Z` : trimmedValue);
};

const formatDateTime = (value) => {
  if (!value) return 'Not set';
  const date = parseApiDateTime(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const normalizeStatus = (status) => String(status || 'Active').trim();

const getStatusTone = (status) => {
  const normalizedStatus = normalizeStatus(status).toLowerCase();

  if (normalizedStatus === 'archived' || normalizedStatus === 'completed') {
    return {
      badge: 'border-amber-200 bg-amber-50 text-amber-800',
      band: 'border-amber-200 bg-amber-50',
      dot: 'bg-amber-500',
      icon: 'inventory_2',
      label: 'Archived',
    };
  }

  if (normalizedStatus === 'deleted') {
    return {
      badge: 'border-red-200 bg-red-50 text-red-700',
      band: 'border-red-200 bg-red-50',
      dot: 'bg-red-500',
      icon: 'delete',
      label: 'Deleted',
    };
  }

  return {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    band: 'border-emerald-200 bg-emerald-50',
    dot: 'bg-emerald-500',
    icon: 'radio_button_checked',
    label: normalizeStatus(status) || 'Active',
  };
};

const mapApiSpace = (space) => ({
  id: space.space_id,
  title: space.name_space || 'Untitled Space',
  description: space.description || '',
  ownerId: space.owner_id || '',
  status: space.status_space || 'Active',
  createdAt: space.created_at,
  updatedAt: space.updated_at,
  archivedAt: space.archived_at,
  reopenUntil: space.reopen_until,
  canReopen: Boolean(space.can_reopen),
  deletedAt: space.deleted_at,
});

const DetailField = ({ label, value, icon }) => (
  <div className="min-w-0 rounded-lg border border-[#ECE7F4] bg-white px-4 py-3 shadow-sm">
    <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase text-[#7B7288]">
      <span className="material-symbols-outlined text-[15px] leading-none text-[#5e4db2]">{icon}</span>
      {label}
    </div>
    <p className="break-all text-[12px] font-semibold text-[#2F253A]" title={value}>{value}</p>
  </div>
);

const LifecycleItem = ({ active, title, text, tone = 'default' }) => {
  const dotClass = active
    ? tone === 'danger'
      ? 'bg-red-500'
      : tone === 'warning'
        ? 'bg-amber-500'
        : 'bg-emerald-500'
    : 'bg-[#D6D0DF]';

  return (
    <div className="relative flex gap-3 pb-5 last:pb-0">
      <div className="flex flex-col items-center">
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <span className="mt-1 h-full w-px bg-[#E8E1F0] last:hidden" />
      </div>
      <div>
        <p className={`text-[12px] font-bold ${active ? 'text-[#2F253A]' : 'text-[#8A8194]'}`}>{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#6B6375]">{text}</p>
      </div>
    </div>
  );
};

export default function SpaceDetail({ routeContext = null } = {}) {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const outletContext = useOutletContext() || {};
  const {
    currentRole = 'ADMIN',
    currentUser = null,
    currentSpaceRole = 'USER',
    isSuperAdmin: layoutIsSuperAdmin = false,
  } = routeContext || outletContext;

  const [space, setSpace] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(null);

  const currentUserId = currentUser?.id || currentUser?.user_id || '';
  const isSuperAdmin = layoutIsSuperAdmin || currentUser?.role === 'SUPER_ADMIN' || currentRole === 'ADMIN';

  useEffect(() => {
    let isMounted = true;

    const loadSpace = async () => {
      setIsLoading(true);
      setError('');
      setErrorStatus(null);

      try {
        const response = await axiosClient.get(`/spaces/${spaceId}`);
        if (isMounted) {
          setSpace(mapApiSpace(response.data));
        }
      } catch (requestError) {
        if (isMounted) {
          setErrorStatus(requestError?.response?.status || null);
          setError(getErrorMessage(requestError, 'Unable to load this space.'));
          setSpace(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSpace();

    return () => {
      isMounted = false;
    };
  }, [spaceId]);

  const roleLabel = useMemo(() => {
    if (!space) return isSuperAdmin ? 'SUPER ADMIN' : null;
    if (space.ownerId && currentUserId && space.ownerId === currentUserId) return 'OWNER';
    if (isSuperAdmin) return 'SUPER ADMIN';
    if (currentSpaceRole === 'OWNER') return 'OWNER';
    return 'MEMBER';
  }, [currentSpaceRole, currentUserId, isSuperAdmin, space]);

  const statusTone = getStatusTone(space?.status);
  const layoutSearch = useMemo(() => {
    const params = getLayoutQueryParams(location.search);
    const query = params.toString();
    return query ? `?${query}` : '';
  }, [location.search]);

  const taskSearch = useMemo(() => {
    const params = getLayoutQueryParams(location.search);
    if (!isSuperAdmin) {
      params.set('role', 'USER');
      params.set('spaceRole', roleLabel === 'OWNER' ? 'OWNER' : 'USER');
    }
    const query = params.toString();
    return query ? `?${query}` : '';
  }, [isSuperAdmin, location.search, roleLabel]);

  const handleBack = () => {
    navigate(`/dashboard/spaces${layoutSearch}`);
  };

  const handleViewTasks = () => {
    navigate(`/dashboard/tasks/${spaceId}${taskSearch}`);
  };

  const isNotFound = errorStatus === 404;
  const isPermissionDenied = errorStatus === 401 || errorStatus === 403;

  if (isLoading) {
    return (
      <div className="min-h-full bg-[#F5F7FA] px-6 pb-8 pt-10">
        <div className="mb-6 h-9 w-36 animate-pulse rounded-lg bg-[#E8E1F0]" />
        <div className="rounded-lg border border-[#ECE7F4] bg-white p-6 shadow-sm">
          <div className="h-7 w-2/5 animate-pulse rounded bg-[#E8E1F0]" />
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            {[1, 2, 3, 4].map(item => (
              <div key={item} className="h-20 animate-pulse rounded-lg bg-[#F6F3FA]" />
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="h-64 animate-pulse rounded-lg bg-[#F6F3FA]" />
            <div className="h-64 animate-pulse rounded-lg bg-[#F6F3FA]" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-[#F5F7FA] px-6 pb-8 pt-10">
        <button
          type="button"
          onClick={handleBack}
          className="mb-5 inline-flex items-center gap-2 rounded-lg border border-[#D9D3F6] bg-white px-3 py-2 text-[12px] font-bold text-[#4C2B74] shadow-sm transition-all hover:bg-[#F4F0FA] focus:outline-none focus:ring-2 focus:ring-[#D9D3F6]"
        >
          <span className="material-symbols-outlined text-[17px] leading-none">arrow_back</span>
          Back to Spaces
        </button>

        <section className="rounded-lg border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <span className="material-symbols-outlined text-[28px]">
              {isNotFound ? 'search_off' : isPermissionDenied ? 'lock' : 'error'}
            </span>
          </div>
          <h1 className="mt-5 text-xl font-bold text-[#2F253A]">
            {isNotFound
              ? 'Space not found'
              : isPermissionDenied
                ? 'You do not have access to this space'
                : 'Unable to load space'}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-[#6B6375]">{error}</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-6 rounded-lg bg-[#4C2B74] px-5 py-2.5 text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#3D225E] active:scale-95"
          >
            Return to Space Management
          </button>
        </section>
      </div>
    );
  }

  return (
    <main className="min-h-full bg-[#F5F7FA] px-6 pb-8 pt-10">
      <button
        type="button"
        onClick={handleBack}
        className="mb-5 inline-flex items-center gap-2 rounded-lg border border-[#D9D3F6] bg-white px-3 py-2 text-[12px] font-bold text-[#4C2B74] shadow-sm transition-all hover:bg-[#F4F0FA] focus:outline-none focus:ring-2 focus:ring-[#D9D3F6]"
      >
        <span className="material-symbols-outlined text-[17px] leading-none">arrow_back</span>
        Back to Spaces
      </button>

      <section className={`overflow-hidden rounded-lg border ${statusTone.band} shadow-sm`}>
        <div className="flex flex-col gap-5 bg-white/80 px-5 py-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase ${statusTone.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusTone.dot}`} />
                {statusTone.label}
              </span>
              {roleLabel && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#D9D3F6] bg-[#F2F0FF] px-2.5 py-1 text-[10px] font-bold uppercase text-[#5e4db2]">
                  <span className="material-symbols-outlined text-[14px] leading-none">admin_panel_settings</span>
                  {roleLabel}
                </span>
              )}
            </div>
            <h1 className="break-words text-2xl font-bold leading-tight text-[#2D1B4E]">{space.title}</h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[#6B6375]">
              Operational overview for this space, including lifecycle timing and direct task access.
            </p>
          </div>

          <button
            type="button"
            onClick={handleViewTasks}
            disabled={normalizeStatus(space.status).toLowerCase() === 'deleted'}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#4C2B74] px-4 text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#3D225E] focus:outline-none focus:ring-2 focus:ring-[#D9D3F6] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#D8D2E2] disabled:text-[#7B7288]"
          >
            <span className="material-symbols-outlined text-[17px] leading-none">task_alt</span>
            View Tasks
          </button>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailField label="Space ID" value={space.id || 'Unknown'} icon="tag" />
        <DetailField label="Owner ID" value={space.ownerId || 'Unknown'} icon="person" />
        <DetailField label="Created" value={formatDateTime(space.createdAt)} icon="event_available" />
        <DetailField label="Updated" value={formatDateTime(space.updatedAt)} icon="update" />
      </section>

      <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <article className="rounded-lg border border-[#ECE7F4] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-[#2F253A]">Description</h2>
                <p className="text-[12px] text-[#7B7288]">What this space is organized around.</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F4F0FA] text-[#4C2B74]">
                <span className="material-symbols-outlined text-[19px] leading-none">notes</span>
              </span>
            </div>
            {space.description ? (
              <p className="whitespace-pre-wrap text-[13px] leading-7 text-[#4B4254]">{space.description}</p>
            ) : (
              <div className="rounded-lg border border-dashed border-[#D9D3F6] bg-[#FBFAFD] px-4 py-8 text-center">
                <p className="text-[13px] font-semibold text-[#4C2B74]">No description provided.</p>
                <p className="mt-1 text-[12px] text-[#7B7288]">The space can still be reviewed and opened from its task board.</p>
              </div>
            )}
          </article>

          <article className="rounded-lg border border-[#ECE7F4] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-[#2F253A]">Lifecycle</h2>
                <p className="text-[12px] text-[#7B7288]">Status signals and important transition dates.</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F4F0FA] text-[#4C2B74]">
                <span className="material-symbols-outlined text-[19px] leading-none">timeline</span>
              </span>
            </div>
            <LifecycleItem
              active
              title="Created"
              text={`Space opened ${formatDateTime(space.createdAt)}.`}
            />
            <LifecycleItem
              active={Boolean(space.updatedAt)}
              title="Last updated"
              text={space.updatedAt ? `Latest recorded update was ${formatDateTime(space.updatedAt)}.` : 'No update timestamp is available yet.'}
            />
            <LifecycleItem
              active={Boolean(space.archivedAt)}
              tone="warning"
              title="Archived"
              text={space.archivedAt ? `Archived on ${formatDateTime(space.archivedAt)}.` : 'This space has not been archived.'}
            />
            <LifecycleItem
              active={Boolean(space.deletedAt)}
              tone="danger"
              title="Deleted"
              text={space.deletedAt ? `Moved to trash on ${formatDateTime(space.deletedAt)}.` : 'This space is not deleted.'}
            />
          </article>
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-[#ECE7F4] bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-bold text-[#2F253A]">Actions</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[#7B7288]">Open the task board for this space without changing task data.</p>

            <button
              type="button"
              onClick={handleViewTasks}
              disabled={normalizeStatus(space.status).toLowerCase() === 'deleted'}
              className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#4C2B74] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#3D225E] focus:outline-none focus:ring-2 focus:ring-[#D9D3F6] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#D8D2E2] disabled:text-[#7B7288]"
            >
              <span className="material-symbols-outlined text-[17px] leading-none">open_in_new</span>
              View Tasks
            </button>

            <button
              type="button"
              onClick={handleBack}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#D9D3F6] bg-white text-[12px] font-bold text-[#4C2B74] transition-all hover:bg-[#F4F0FA] focus:outline-none focus:ring-2 focus:ring-[#D9D3F6] active:scale-95"
            >
              <span className="material-symbols-outlined text-[17px] leading-none">view_list</span>
              Space Management
            </button>
          </section>

          <section className="rounded-lg border border-[#ECE7F4] bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-bold text-[#2F253A]">Status Context</h2>
            <div className={`mt-4 rounded-lg border px-4 py-3 ${statusTone.band}`}>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined mt-0.5 text-[18px] leading-none text-[#4C2B74]">{statusTone.icon}</span>
                <div>
                  <p className="text-[12px] font-bold text-[#2F253A]">{statusTone.label}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#6B6375]">
                    {normalizeStatus(space.status).toLowerCase() === 'deleted'
                      ? 'Deleted spaces are retained for owner recovery and task navigation is disabled from this view.'
                      : normalizeStatus(space.status).toLowerCase() === 'archived'
                        ? 'Archived spaces keep their history visible while limiting active work changes.'
                        : 'Active spaces are available for task review and day-to-day work.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-[12px] text-[#6B6375]">
              <div className="flex items-center justify-between gap-4">
                <span>Can reopen</span>
                <span className={`font-bold ${space.canReopen ? 'text-emerald-700' : 'text-[#8A8194]'}`}>
                  {space.canReopen ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span>Reopen until</span>
                <span className="text-right font-semibold text-[#2F253A]">{formatDateTime(space.reopenUntil)}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span>Archived at</span>
                <span className="text-right font-semibold text-[#2F253A]">{formatDateTime(space.archivedAt)}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span>Deleted at</span>
                <span className="text-right font-semibold text-[#2F253A]">{formatDateTime(space.deletedAt)}</span>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
