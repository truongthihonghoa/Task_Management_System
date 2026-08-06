import React, { useEffect, useMemo, useRef, useState } from 'react';
import axiosClient from '../../api/axiosClient';

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
  const vietnamLocalMatch = trimmedValue.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?$/,
  );

  if (!hasTimezone && vietnamLocalMatch) {
    const [, year, month, day, hour = '00', minute = '00', second = '00', fraction = '0'] = vietnamLocalMatch;
    const millisecond = Number(fraction.padEnd(3, '0').slice(0, 3));
    return new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - 7,
      Number(minute),
      Number(second),
      millisecond,
    ));
  }

  return new Date(trimmedValue);
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

const mapApiSpace = (space) => ({
  id: space.space_id,
  title: space.name_space || 'Untitled Space',
  description: space.description || 'No description provided.',
  ownerId: space.owner_id || '',
  status: space.status_space || 'Active',
  createdAt: space.created_at,
  updatedAt: space.updated_at,
  archivedAt: space.archived_at,
  reopenUntil: space.reopen_until,
  canReopen: Boolean(space.can_reopen),
  deletedAt: space.deleted_at,
});

const normalizeStatus = (status) => String(status || 'Active').trim();

const getStatusTone = (status) => {
  const normalizedStatus = normalizeStatus(status).toLowerCase();

  if (normalizedStatus === 'archived' || normalizedStatus === 'completed') {
    return {
      badge: 'border-amber-200 bg-amber-50 text-amber-800',
      panel: 'border-amber-200 bg-amber-50',
      dot: 'bg-amber-500',
      icon: 'inventory_2',
      label: 'Archived',
    };
  }

  if (normalizedStatus === 'deleted') {
    return {
      badge: 'border-red-200 bg-red-50 text-red-700',
      panel: 'border-red-200 bg-red-50',
      dot: 'bg-red-500',
      icon: 'delete',
      label: 'Deleted',
    };
  }

  return {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    panel: 'border-emerald-200 bg-emerald-50',
    dot: 'bg-emerald-500',
    icon: 'radio_button_checked',
    label: normalizeStatus(status) || 'Active',
  };
};

const DetailTile = ({ icon, label, value }) => (
  <div className="min-w-0 rounded-lg border border-[#ECE7F4] bg-white px-3 py-3 shadow-sm">
    <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase text-[#7B7288]">
      <span className="material-symbols-outlined text-[15px] leading-none text-[#5e4db2]">{icon}</span>
      <span>{label}</span>
    </div>
    <p className="break-words text-[12px] font-semibold leading-relaxed text-[#2F253A]" title={value}>
      {value}
    </p>
  </div>
);

const StatusRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 border-b border-[#F0ECF6] py-2.5 last:border-b-0">
    <span className="text-[12px] font-medium text-[#6B6375]">{label}</span>
    <span className="max-w-[58%] break-words text-right text-[12px] font-bold text-[#2F253A]">{value}</span>
  </div>
);

const LoadingContent = () => (
  <div className="px-5 py-5 sm:px-6">
    <div className="h-5 w-48 animate-pulse rounded bg-[#E8E1F0]" />
    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map(item => (
        <div key={item} className="h-20 animate-pulse rounded-lg bg-[#F4F0FA]" />
      ))}
    </div>
    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
      <div className="h-44 animate-pulse rounded-lg bg-[#F4F0FA]" />
      <div className="h-44 animate-pulse rounded-lg bg-[#F4F0FA]" />
    </div>
  </div>
);

const ErrorContent = ({ title, message, onClose }) => (
  <div className="px-5 py-8 text-center sm:px-6">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-red-600">
      <span className="material-symbols-outlined text-[26px] leading-none">error</span>
    </div>
    <h3 className="mt-4 text-base font-bold text-[#2F253A]">{title}</h3>
    <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[#6B6375]">{message}</p>
    <button
      type="button"
      onClick={onClose}
      className="mt-5 rounded-lg border border-[#D8CDE8] bg-white px-4 py-2 text-[12px] font-bold text-[#4C2B74] transition-colors hover:bg-[#F4F0FA]"
    >
      Close
    </button>
  </div>
);

export default function SpaceDetailModal({
  isOpen,
  spaceId,
  previewSpace = null,
  roleLabel = null,
  canEdit = false,
  onClose,
  onUpdateSpace,
  onViewTasks,
}) {
  const dialogRef = useRef(null);
  const [space, setSpace] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));

      if (!focusableElements.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => dialogRef.current?.focus(), 0);

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !spaceId) {
      setSpace(null);
      setError('');
      setErrorStatus(null);
      setIsEditing(false);
      setUpdateError('');
      return undefined;
    }

    let isMounted = true;

    const loadSpace = async () => {
      setIsLoading(true);
      setSpace(null);
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
  }, [isOpen, spaceId]);

  const displaySpace = space || previewSpace;
  const statusTone = getStatusTone(displaySpace?.status);
  const isNotFound = errorStatus === 404;
  const isPermissionDenied = errorStatus === 401 || errorStatus === 403;

  const resolvedRoleLabel = useMemo(() => {
    if (roleLabel) return roleLabel;
    return displaySpace?.ownerId ? 'MEMBER' : null;
  }, [displaySpace?.ownerId, roleLabel]);

  const canOpenTasks = Boolean(space || previewSpace)
    && normalizeStatus(displaySpace?.status).toLowerCase() !== 'deleted';
  const canEditSpace = Boolean(canEdit && displaySpace)
    && normalizeStatus(displaySpace?.status).toLowerCase() === 'active';

  useEffect(() => {
    if (!displaySpace) return;
    setEditName(displaySpace.title || '');
    setEditDescription(displaySpace.description === 'No description provided.' ? '' : displaySpace.description || '');
  }, [displaySpace?.id, displaySpace?.title, displaySpace?.description]);

  if (!isOpen) return null;

  const handleBackdropMouseDown = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleStartEdit = () => {
    if (!displaySpace) return;
    setEditName(displaySpace.title || '');
    setEditDescription(displaySpace.description === 'No description provided.' ? '' : displaySpace.description || '');
    setUpdateError('');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (isUpdating) return;
    setUpdateError('');
    setIsEditing(false);
  };

  const handleSubmitEdit = async (event) => {
    event.preventDefault();
    if (!displaySpace?.id || !onUpdateSpace) return;

    const normalizedName = editName.trim();
    if (!normalizedName) {
      setUpdateError('Space name is required.');
      return;
    }

    setIsUpdating(true);
    setUpdateError('');

    try {
      const updatedSpace = await onUpdateSpace(displaySpace.id, {
        name: normalizedName,
        description: editDescription.trim(),
      });
      setSpace(updatedSpace);
      setIsEditing(false);
    } catch (requestError) {
      setUpdateError(getErrorMessage(requestError, 'Unable to update this space.'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      className="space-detail-modal__backdrop fixed inset-0 z-[10000] flex items-center justify-center bg-[#191326]/45 p-3 backdrop-blur-[2px] sm:p-5"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="space-detail-modal-title"
        tabIndex={-1}
        className="space-detail-modal flex max-h-[90vh] w-full max-w-[960px] flex-col overflow-hidden rounded-xl border border-[#E6DDF1] bg-[#F8F7FB] shadow-[0_24px_70px_rgba(47,37,58,0.26)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#E6DDF1] bg-white px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase ${statusTone.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusTone.dot}`} />
                  {statusTone.label}
                </span>
                {resolvedRoleLabel && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-[#D9D3F6] bg-[#F2F0FF] px-2.5 py-1 text-[10px] font-bold uppercase text-[#5e4db2]">
                    <span className="material-symbols-outlined text-[14px] leading-none">verified_user</span>
                    {resolvedRoleLabel}
                  </span>
                )}
              </div>
              <h2 id="space-detail-modal-title" className="break-words text-xl font-bold leading-tight text-[#3D225E] sm:text-2xl">
                {displaySpace?.title || 'Space details'}
              </h2>
              <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[#6B6375]">
                {displaySpace?.description || 'Loading the latest details for this space.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close space details"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E6DDF1] bg-white text-[#6B6375] transition-all hover:border-[#CFC2E0] hover:bg-[#F4F0FA] hover:text-[#4C2B74] focus:outline-none focus:ring-2 focus:ring-[#D9D3F6]"
            >
              <span className="material-symbols-outlined text-[20px] leading-none">close</span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading && !space && !previewSpace && <LoadingContent />}

          {!isLoading && error && (
            <ErrorContent
              title={isNotFound ? 'Space not found' : isPermissionDenied ? 'You cannot open this space' : 'Unable to load space'}
              message={error}
              onClose={onClose}
            />
          )}

          {displaySpace && (!error || space) && (
            <div className="px-5 py-5 sm:px-6">
              {isLoading && (
                <div className="mb-4 rounded-lg border border-[#E8E1F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#5e4db2]">
                  Refreshing details...
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailTile icon="tag" label="Space ID" value={displaySpace.id || 'Not set'} />
                <DetailTile icon="person" label="Owner ID" value={displaySpace.ownerId || 'Not set'} />
                <DetailTile icon="event_available" label="Created" value={formatDateTime(displaySpace.createdAt || previewSpace?.date)} />
                <DetailTile icon="update" label="Updated" value={formatDateTime(displaySpace.updatedAt)} />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <section className="rounded-lg border border-[#ECE7F4] bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-[#2F253A]">Description</h3>
                      <p className="mt-1 text-[12px] text-[#7B7288]">What this space is organized around.</p>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F4F0FA] text-[#4C2B74]">
                      <span className="material-symbols-outlined text-[20px] leading-none">notes</span>
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#4A4055]">
                    {displaySpace.description || 'No description provided.'}
                  </p>
                </section>

                <aside className="rounded-lg border border-[#ECE7F4] bg-white p-5 shadow-sm">
                  <h3 className="text-base font-bold text-[#2F253A]">Actions</h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#7B7288]">
                    Open the task board or update active space details.
                  </p>
                  <button
                    type="button"
                    disabled={!canOpenTasks}
                    onClick={() => onViewTasks(displaySpace, resolvedRoleLabel === 'OWNER')}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#4C2B74] px-4 py-2.5 text-[12px] font-bold text-white shadow-md transition-all hover:bg-[#3D225E] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[17px] leading-none">task_alt</span>
                    View Tasks
                  </button>
                  {canEditSpace && (
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      disabled={isEditing}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#D9D3F6] bg-white px-4 py-2.5 text-[12px] font-bold text-[#4C2B74] transition-all hover:bg-[#F4F0FA] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[17px] leading-none">edit_square</span>
                      Edit Details
                    </button>
                  )}
                </aside>
              </div>

              {isEditing && (
                <form
                  onSubmit={handleSubmitEdit}
                  className="mt-5 rounded-lg border border-[#D9D3F6] bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-bold text-[#2F253A]">Edit Space</h3>
                      <p className="mt-1 text-[12px] text-[#7B7288]">Changes are saved with the Space update API.</p>
                    </div>
                    <span className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700 sm:mt-0">
                      <span className="material-symbols-outlined text-[14px] leading-none">sync_alt</span>
                      PATCH
                    </span>
                  </div>

                  <label className="block text-[11px] font-bold uppercase text-[#6B6375]" htmlFor="space-edit-name">
                    Space name
                  </label>
                  <input
                    id="space-edit-name"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    maxLength={255}
                    disabled={isUpdating}
                    className="mt-2 h-10 w-full rounded-lg border border-[#D9D3F6] bg-white px-3 text-[13px] font-semibold text-[#2F253A] outline-none transition focus:border-[#4C2B74] focus:ring-2 focus:ring-[#D9D3F6] disabled:cursor-not-allowed disabled:bg-[#F8F7FB]"
                  />

                  <label className="mt-4 block text-[11px] font-bold uppercase text-[#6B6375]" htmlFor="space-edit-description">
                    Description
                  </label>
                  <textarea
                    id="space-edit-description"
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    rows={4}
                    disabled={isUpdating}
                    className="mt-2 w-full resize-none rounded-lg border border-[#D9D3F6] bg-white px-3 py-2 text-[13px] leading-relaxed text-[#2F253A] outline-none transition focus:border-[#4C2B74] focus:ring-2 focus:ring-[#D9D3F6] disabled:cursor-not-allowed disabled:bg-[#F8F7FB]"
                  />

                  {updateError && (
                    <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
                      {updateError}
                    </div>
                  )}

                  <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isUpdating}
                      className="rounded-lg border border-[#D9D3F6] bg-white px-4 py-2.5 text-[12px] font-bold text-[#4C2B74] transition-all hover:bg-[#F4F0FA] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="rounded-lg bg-[#4C2B74] px-4 py-2.5 text-[12px] font-bold text-white shadow-md transition-all hover:bg-[#3D225E] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUpdating ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              )}

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <section className="rounded-lg border border-[#ECE7F4] bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-[#2F253A]">Lifecycle</h3>
                      <p className="mt-1 text-[12px] text-[#7B7288]">Status signals and important transition dates.</p>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F4F0FA] text-[#4C2B74]">
                      <span className="material-symbols-outlined text-[20px] leading-none">timeline</span>
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <div>
                        <p className="text-[12px] font-bold text-[#2F253A]">Created</p>
                        <p className="mt-1 text-[12px] text-[#6B6375]">Space opened {formatDateTime(displaySpace.createdAt || previewSpace?.date)}.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <div>
                        <p className="text-[12px] font-bold text-[#2F253A]">Last updated</p>
                        <p className="mt-1 text-[12px] text-[#6B6375]">Latest recorded update was {formatDateTime(displaySpace.updatedAt)}.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${displaySpace.archivedAt ? 'bg-amber-500' : 'bg-[#D6D0DF]'}`} />
                      <div>
                        <p className={`text-[12px] font-bold ${displaySpace.archivedAt ? 'text-[#2F253A]' : 'text-[#8A8194]'}`}>Archived</p>
                        <p className="mt-1 text-[12px] text-[#6B6375]">
                          {displaySpace.archivedAt ? `Archived at ${formatDateTime(displaySpace.archivedAt)}.` : 'This space has not been archived.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${displaySpace.deletedAt ? 'bg-red-500' : 'bg-[#D6D0DF]'}`} />
                      <div>
                        <p className={`text-[12px] font-bold ${displaySpace.deletedAt ? 'text-[#2F253A]' : 'text-[#8A8194]'}`}>Deleted</p>
                        <p className="mt-1 text-[12px] text-[#6B6375]">
                          {displaySpace.deletedAt ? `Deleted at ${formatDateTime(displaySpace.deletedAt)}.` : 'This space is not deleted.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <aside className="rounded-lg border border-[#ECE7F4] bg-white p-5 shadow-sm">
                  <h3 className="text-base font-bold text-[#2F253A]">Status Context</h3>
                  <div className={`mt-4 rounded-lg border px-4 py-3 ${statusTone.panel}`}>
                    <div className="flex items-center gap-2 text-[13px] font-bold text-[#2F253A]">
                      <span className="material-symbols-outlined text-[18px] leading-none">{statusTone.icon}</span>
                      {statusTone.label}
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#6B6375]">
                      {statusTone.label === 'Archived'
                        ? 'Archived spaces are read-only until they are reopened inside the allowed window.'
                        : statusTone.label === 'Deleted'
                          ? 'Deleted spaces live in trash until they are restored or removed permanently.'
                          : 'Active spaces are available for task review and day-to-day work.'}
                    </p>
                  </div>
                  <div className="mt-3">
                    <StatusRow label="Can reopen" value={displaySpace.canReopen ? 'Yes' : 'No'} />
                    <StatusRow label="Reopen until" value={formatDateTime(displaySpace.reopenUntil)} />
                    <StatusRow label="Archived at" value={formatDateTime(displaySpace.archivedAt)} />
                    <StatusRow label="Deleted at" value={formatDateTime(displaySpace.deletedAt)} />
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
