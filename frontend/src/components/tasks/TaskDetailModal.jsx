import React, { useEffect, useMemo, useState, useRef } from 'react';
import '../../styles/CreateTaskModal.css';
import axiosClient, { API_BASE_URL } from '../../api/axiosClient';
import RichTextEditor from './RichTextEditor';

const getCompletedDateValue = (task = {}) => task.completed_at || task.completedAt || task.date;
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const formatCompletedDate = (value, fallback = 'Jun 26, 2026') => {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTimelineDateTime = (value, fallback = '2 mins ago') => {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return `${date.toLocaleDateString('en-US', {
    timeZone: VIETNAM_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} ${date.toLocaleTimeString('en-US', {
    timeZone: VIETNAM_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  })}`;
};

const normalizeAvatarUrl = (avatarUrl) => {
  if (!avatarUrl) return '';
  if (/^(blob:|data:|https?:\/\/)/i.test(avatarUrl)) return avatarUrl;
  const path = avatarUrl.startsWith('media/') ? `/${avatarUrl}` : avatarUrl;
  if (/^https?:\/\//i.test(API_BASE_URL)) {
    try {
      return `${new URL(API_BASE_URL).origin}${path}`;
    } catch {
      return avatarUrl;
    }
  }
  return path;
};

const isCompletedDateOverdue = (value, status, apiOverdue = undefined) => {
  if (!value) return false;

  const normalizedStatus = String(status || '').toLowerCase();
  if (['done', 'cancelled'].includes(normalizedStatus)) return false;
  if (typeof apiOverdue === 'boolean') return apiOverdue;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  const completedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return completedDate < todayDate;
};

const isCompletedDateDueToday = (value, status, apiDueToday = undefined) => {
  if (!value) return false;

  const normalizedStatus = String(status || '').toLowerCase();
  if (['done', 'cancelled'].includes(normalizedStatus)) return false;
  if (typeof apiDueToday === 'boolean') return apiDueToday;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  const completedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return completedDate.getTime() === todayDate.getTime();
};

const DUE_TODAY_COLOR = '#92400E';
const DUE_TODAY_BACKGROUND = '#FEF3C7';

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (/^(blob:|data:|https?:\/\/)/i.test(url)) return url;
  if (!url.startsWith('/media/')) return url;

  if (/^https?:\/\//i.test(API_BASE_URL)) {
    try {
      return `${new URL(API_BASE_URL).origin}${url}`;
    } catch {
      return url;
    }
  }

  return url;
};

const normalizeApiDateValue = (value) => {
  return value;
};

const formatApiDate = (value, fallback = '') => {
  if (!value) return fallback;
  const date = new Date(normalizeApiDateValue(value));
  if (Number.isNaN(date.getTime())) return fallback || value;
  return date.toLocaleDateString('en-US', {
    timeZone: VIETNAM_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getApiErrorMessage = (error, fallback) => {
  const responseData = error?.response?.data;
  const detail = responseData?.detail;
  if (Array.isArray(detail)) return detail.map(item => item.msg || item.message).filter(Boolean).join(', ') || fallback;
  if (typeof detail === 'string') return detail;
  if (typeof responseData === 'string') return responseData;
  if (typeof responseData?.message === 'string') return responseData.message;
  if (typeof responseData?.error === 'string') return responseData.error;
  return error?.message || fallback;
};

const isImageAttachment = (attachment = {}) => {
  const mimeType = attachment.mime_type || attachment.mimeType || '';
  const name = attachment.file_name || attachment.name || '';
  return mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
};

const mapApiAttachment = (attachment = {}) => {
  const name = attachment.file_name || attachment.name || attachment.fileName || 'attachment';
  const isImage = isImageAttachment(attachment);
  const fileUrl = resolveMediaUrl(attachment.url || attachment.previewUrl || attachment.storage_url || attachment.file_url || '');
  const sizeLabel = attachment.size || (typeof attachment.file_size === 'number' ? formatFileSizeValue(attachment.file_size) : '');

  return {
    ...attachment,
    id: attachment.attachment_id || attachment.id || `${name}-${attachment.uploaded_at || Date.now()}`,
    attachmentId: attachment.attachment_id || attachment.id,
    name,
    size: sizeLabel,
    date: formatApiDate(attachment.uploaded_at || attachment.created_at, ''),
    icon: name.endsWith('.zip') ? 'folder_zip' : name.endsWith('.pdf') ? 'picture_as_pdf' : isImage ? 'image' : 'upload_file',
    color: name.endsWith('.zip') ? '#4C2B74' : name.endsWith('.pdf') ? '#DE350B' : '#4C2B74',
    bg: name.endsWith('.zip') ? '#EBF5FF' : name.endsWith('.pdf') ? '#FFF5F5' : '#EEF3FF',
    type: isImage ? 'image' : 'file',
    previewUrl: isImage ? fileUrl : '',
    url: fileUrl,
    uploadedBy: attachment.uploaded_by || attachment.uploadedBy || attachment.uploaderId || '',
    uploaderId: attachment.uploaded_by || attachment.uploaderId || '',
    usage: attachment.usage || 'attachment',
    cloudinaryPublicId: attachment.cloudinary_public_id || attachment.public_id || attachment.cloudinaryPublicId || '',
    raw: attachment,
  };
};

const hydrateInitialAttachments = (attachmentList = []) => {
  return attachmentList.map((attachment) => {
    const mapped = mapApiAttachment(attachment);
    if (mapped.type === 'image' && !mapped.previewUrl && mapped.url) {
      return { ...mapped, previewUrl: mapped.url };
    }
    return mapped;
  });
};

const mapApiComment = (comment = {}) => {
  const user = comment.user || {};
  const author = user.full_name || user.name || comment.author || 'Unknown User';

  return {
    ...comment,
    id: comment.comment_id || comment.id,
    commentId: comment.comment_id || comment.id,
    taskId: comment.task_id || comment.taskId,
    author,
    authorId: comment.user_id || comment.authorId || user.user_id || user.id || '',
    date: formatTimelineDateTime(comment.updated_at || comment.created_at, ''),
    text: comment.comment || comment.text || '',
    parentId: comment.parent_comment_id || comment.parentId || null,
    isEdited: Boolean(comment.is_edited || comment.isEdited),
    createdAt: comment.created_at || comment.createdAt,
    updatedAt: comment.updated_at || comment.updatedAt,
    raw: comment,
  };
};

function formatFileSizeValue(bytes = 0) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function TaskDetailModal({
  task,
  onClose,
  tasks = [],
  assigneeOptions = [],
  onUpdateTask,
  onAddAssignee,
  onRemoveAssignee,
  currentRole = 'ADMIN',
  currentSpaceRole = 'USER',
  currentUser = null,
  readOnly = false,
}) {
  const [activeTab, setActiveTab] = useState('comments');
  const [commentText, setCommentText] = useState('');
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [isCreatedOpen, setIsCreatedOpen] = useState(false);
  const [isStoryPointsOpen, setIsStoryPointsOpen] = useState(false);
  const [localTask, setLocalTask] = useState(task || {});
  const [isDescriptionEditing, setIsDescriptionEditing] = useState(false);
  const [tempDescription, setTempDescription] = useState(task?.description || '');
  const [pendingDescriptionAttachments, setPendingDescriptionAttachments] = useState([]);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [baseMax, setBaseMax] = useState({ w: Math.max(600, window.innerWidth * 0.7), h: Math.max(400, window.innerHeight * 0.7) });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [baseWidth, setBaseWidth] = useState(null);
  const previewImgRef = React.useRef(null);
  const [isCommentEditing, setIsCommentEditing] = useState(false);
  const [tempComment, setTempComment] = useState('');
  const [replyToCommentId, setReplyToCommentId] = useState(null);
  const [editCommentId, setEditCommentId] = useState(null);
  const [deleteConfirmCommentId, setDeleteConfirmCommentId] = useState(null);
  const [isUploadAreaOpen, setIsUploadAreaOpen] = useState(false);
  const [attachments, setAttachments] = useState(hydrateInitialAttachments(task?.attachments || []));
  const [comments, setComments] = useState((task?.comments || []).map(mapApiComment));
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(task?.title || '');
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [assignHistory, setAssignHistory] = useState([]);

  const availableAssignees = assigneeOptions;
  const localAssignedUsers = useMemo(() => {
    const users = (localTask.assignees || [])
      .map(entry => entry.user)
      .filter(user => user?.user_id || user?.id || user?.name);
    if (users.length > 0) return users;
    if (localTask.assignee || localTask.assigneeId) {
      return [{
        id: localTask.assigneeId || '',
        user_id: localTask.assigneeId || '',
        name: localTask.assignee || '',
        initials: (localTask.assignee || 'Unassigned').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'UN',
        color: '#9CA3AF',
        textColor: '#FFFFFF',
      }];
    }
    return [];
  }, [localTask]);

  const [completedMonth, setCompletedMonth] = useState(5);
  const [completedYear, setCompletedYear] = useState(2026);
  const [createdMonth, setCreatedMonth] = useState(5);
  const [createdYear, setCreatedYear] = useState(2026);
  const uploadInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const [replaceTargetId, setReplaceTargetId] = useState(null);
  const [commentError, setCommentError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);

  const currentUserId = currentUser?.id || currentUser?.user_id || null;
  const currentUserName = currentUser?.name || currentUser?.authorName || 'Unknown User';
  const isAdmin = currentRole === 'ADMIN';
  const isSpaceOwner = currentSpaceRole === 'OWNER';
  const canModifyTask = !isAdmin && !readOnly;
  const currentUserNames = useMemo(() => [currentUser?.name, currentUser?.fullName, currentUser?.username].filter(Boolean), [currentUser]);
  const statusOptions = isSpaceOwner
    ? ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done', 'Cancelled']
    : ['New', 'In Progress', 'In Testing', 'Pending Review', 'Need Revision', 'Done'];
  const canEditTaskContent = useMemo(() => {
    if (!canModifyTask) return false;
    if (currentRole === 'USER') return true;
    if (!currentUserId || !localTask) return false;
    return (
      localTask.creatorId === currentUserId ||
      localTask.reporterId === currentUserId ||
      localTask.assigneeId === currentUserId ||
      localAssignedUsers.some(user => (user.user_id || user.id) === currentUserId) ||
      currentUserNames.includes(localTask.creator) ||
      currentUserNames.includes(localTask.reporter) ||
      currentUserNames.includes(localTask.assignee) ||
      localAssignedUsers.some(user => currentUserNames.includes(user.name))
    );
  }, [canModifyTask, currentRole, currentUserId, currentUserNames, localAssignedUsers, localTask]);
  const canManageAdminFields = canModifyTask;

  const isCommentOwner = (comment) => {
    if (!comment || !currentUserId) return false;
    return comment.authorId === currentUserId || comment.author === currentUserName;
  };

  const formatFileSize = (bytes) => {
    return formatFileSizeValue(bytes);
  };

  const syncComments = (nextComments, options = { notifyParent: true }) => {
    setComments(nextComments);
    setLocalTask(prev => {
      const nextTask = { ...prev, comments: nextComments };
      if (options.notifyParent && onUpdateTask) onUpdateTask(nextTask);
      return nextTask;
    });
  };

  const syncAttachments = (nextAttachments, options = { notifyParent: true }) => {
    setAttachments(nextAttachments);
    setLocalTask(prev => {
      const nextTask = { ...prev, attachments: nextAttachments };
      if (options.notifyParent && onUpdateTask) onUpdateTask(nextTask);
      return nextTask;
    });
  };

  const createAttachmentFromFile = (file, index = 0, uploaderId = null) => {
    const isImage = file.type.startsWith('image/');
    const url = isImage ? URL.createObjectURL(file) : null;
    return {
      id: Date.now() + index,
      name: file.name,
      size: formatFileSize(file.size),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      icon: file.name.endsWith('.zip') ? 'folder_zip' : file.name.endsWith('.pdf') ? 'picture_as_pdf' : isImage ? 'image' : 'upload_file',
      color: file.name.endsWith('.zip') ? '#4C2B74' : file.name.endsWith('.pdf') ? '#DE350B' : '#4C2B74',
      bg: file.name.endsWith('.zip') ? '#EBF5FF' : file.name.endsWith('.pdf') ? '#FFF5F5' : '#EEF3FF',
      type: isImage ? 'image' : 'file',
      previewUrl: url,
      url,
      uploadedBy: uploaderId
    };
  };

  const isAttachmentOwner = (attachment) => {
    if (!attachment || !currentUserId) return false;
    return attachment.uploadedBy === currentUserId || attachment.authorId === currentUserId || attachment.uploaderId === currentUserId;
  };

  const syncTask = (updates) => {
    if (readOnly) return;
    setLocalTask(prev => {
      const next = { ...prev, ...updates };
      if (onUpdateTask) onUpdateTask(next);
      return next;
    });
  };

  const hydrateAttachments = (attachmentList = []) => {
    return attachmentList.map((attachment) => mapApiAttachment(attachment)).map((att) => {
      if (att && att.type === 'image' && !att.previewUrl && att.url) {
        return { ...att, previewUrl: att.url };
      }
      return att;
    });
  };

  const addAttachments = (newAttachments, options = { persistImmediately: true }) => {
    const next = [...attachments, ...newAttachments];
    if (options.persistImmediately) {
      syncAttachments(next);
      return;
    }
    setAttachments(next);
  };

  const getTaskId = () => localTask.task_id || localTask.taskId || localTask.id || task?.task_id || task?.taskId || task?.id;

  const loadComments = async (taskId) => {
    if (!taskId) return;
    setIsLoadingComments(true);
    setCommentError('');
    try {
      const response = await axiosClient.get(`/tasks/${taskId}/comments`, {
        params: { page: 1, page_size: 100 },
      });
      syncComments((response.data?.items || []).map(mapApiComment), { notifyParent: false });
    } catch (error) {
      setCommentError(getApiErrorMessage(error, 'Unable to load comments.'));
    } finally {
      setIsLoadingComments(false);
    }
  };

  const loadAttachments = async (taskId) => {
    if (!taskId) return;
    setIsLoadingAttachments(true);
    setAttachmentError('');
    try {
      const response = await axiosClient.get(`/tasks/${taskId}/attachments`, {
        params: { page: 1, page_size: 100 },
      });
      syncAttachments((response.data?.items || []).map(mapApiAttachment), { notifyParent: false });
    } catch (error) {
      setAttachmentError(getApiErrorMessage(error, 'Unable to load attachments.'));
    } finally {
      setIsLoadingAttachments(false);
    }
  };

  const createComment = async (text, parentId = null) => {
    if (!canModifyTask) return false;
    const taskId = getTaskId();
    if (!taskId || !text.trim()) return false;

    setCommentError('');
    try {
      const response = await axiosClient.post(`/tasks/${taskId}/comments`, {
        comment: text,
        parent_comment_id: parentId,
      });
      const createdComment = mapApiComment(response.data);
      syncComments([createdComment, ...comments.filter(comment => comment.id !== createdComment.id)]);
      return true;
    } catch (error) {
      setCommentError(getApiErrorMessage(error, 'Unable to save comment.'));
      return false;
    }
  };

  const updateComment = async (commentId, text) => {
    if (!canModifyTask) return false;
    if (!commentId || !text.trim()) return false;

    setCommentError('');
    try {
      const response = await axiosClient.patch(`/comments/${commentId}`, { comment: text });
      const updatedComment = mapApiComment(response.data);
      syncComments(comments.map(comment => comment.id === commentId ? updatedComment : comment));
      return true;
    } catch (error) {
      setCommentError(getApiErrorMessage(error, 'Unable to update comment.'));
      return false;
    }
  };

  const removeComment = async (commentId) => {
    if (!canModifyTask) return false;
    if (!commentId) return false;

    setCommentError('');
    try {
      await axiosClient.delete(`/comments/${commentId}`);
      syncComments(comments.filter(comment => comment.id !== commentId));
      return true;
    } catch (error) {
      setCommentError(getApiErrorMessage(error, 'Unable to delete comment.'));
      return false;
    }
  };

  const uploadAttachmentFile = async (file, usage = 'attachment') => {
    if (!canModifyTask) return null;
    const taskId = getTaskId();
    if (!taskId || !file) return null;

    const formData = new FormData();
    formData.append('usage', usage);
    formData.append('file', file);

    const uploadResponse = await axiosClient.post(`/tasks/${taskId}/media`, formData);
    const attachmentId = uploadResponse.data?.attachment_id;
    if (attachmentId) {
      const attachmentResponse = await axiosClient.get(`/attachments/${attachmentId}`);
      return mapApiAttachment(attachmentResponse.data);
    }

    return mapApiAttachment({
      file_name: uploadResponse.data?.file_name || file.name,
      file_path: uploadResponse.data?.file_path,
      storage_url: uploadResponse.data?.file_url,
      mime_type: uploadResponse.data?.mime_type || file.type,
      file_size: uploadResponse.data?.file_size || file.size,
      uploaded_by: currentUserId,
      uploaded_at: new Date().toISOString(),
    });
  };

  const triggerReplace = (id) => {
    if (!canModifyTask) return;
    setReplaceTargetId(id);
    replaceInputRef.current?.click();
  };

  const handleReplaceFile = async (e) => {
    if (!canModifyTask) return;
    const file = e.target.files?.[0];
    if (!file || replaceTargetId == null) return;

    const currentAttachment = attachments.find(attachment => attachment.id === replaceTargetId);
    const attachmentId = currentAttachment?.attachmentId || currentAttachment?.attachment_id || currentAttachment?.id;
    if (!attachmentId) {
      const newAtt = createAttachmentFromFile(file);
      syncAttachments(attachments.map(attachment => (
        attachment.id === replaceTargetId ? { ...attachment, ...newAtt, id: attachment.id } : attachment
      )));
      setReplaceTargetId(null);
      e.target.value = '';
      return;
    }

    setAttachmentError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axiosClient.put(`/attachments/${attachmentId}`, formData);
      const updatedAttachment = mapApiAttachment(response.data);
      syncAttachments(attachments.map(attachment => (
        attachment.id === replaceTargetId ? updatedAttachment : attachment
      )));
    } catch (error) {
      setAttachmentError(getApiErrorMessage(error, 'Unable to replace attachment.'));
    } finally {
      setReplaceTargetId(null);
      e.target.value = '';
    }
  };

  const deleteAttachment = async (id) => {
    if (!canModifyTask) return;
    const currentAttachment = attachments.find(attachment => attachment.id === id);
    const attachmentId = currentAttachment?.attachmentId || currentAttachment?.attachment_id || currentAttachment?.id;
    if (!attachmentId) return;

    setAttachmentError('');
    try {
      await axiosClient.delete(`/attachments/${attachmentId}`);
      syncAttachments(attachments.filter(attachment => attachment.id !== id));
    } catch (error) {
      setAttachmentError(getApiErrorMessage(error, 'Unable to delete attachment.'));
    }
  };

  const downloadAttachment = (att, e) => {
    e?.stopPropagation();
    if (!att) return;
    // If previewUrl exists (client-side file), trigger download
    if (att.previewUrl) {
      try {
        const a = document.createElement('a');
        a.href = att.previewUrl;
        a.download = att.name || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (err) {
        // fallback: open in new tab
        window.open(att.previewUrl, '_blank');
      }
    } else {
      // No client preview URL available — attempt to open file URL if present
      if (att.url) window.open(att.url, '_blank');
    }
  };

  const handleFileUpload = async (event) => {
    if (!canModifyTask) return;
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setAttachmentError('');
    try {
      const uploadedAttachments = await Promise.all(files.map(file => uploadAttachmentFile(file, 'attachment')));
      syncAttachments([...uploadedAttachments.filter(Boolean), ...attachments]);
      setIsUploadAreaOpen(false);
    } catch (error) {
      setAttachmentError(getApiErrorMessage(error, 'Unable to upload attachment.'));
    } finally {
      event.target.value = '';
    }
  };

  const handleFileUploadObject = async (file, usageOverride = null) => {
    if (!canModifyTask) return null;
    if (!file) return null;
    const usage = usageOverride || (isDescriptionEditing ? 'description' : isCommentEditing ? 'comment' : 'attachment');
    setAttachmentError('');
    try {
      const attachment = await uploadAttachmentFile(file, usage);
      if (!attachment) return null;

      if (usage === 'description') {
        setPendingDescriptionAttachments(prev => [...prev, attachment]);
      } else if (usage === 'attachment') {
        syncAttachments([attachment, ...attachments]);
      }
      return attachment;
    } catch (error) {
      setAttachmentError(getApiErrorMessage(error, 'Unable to upload file.'));
      throw error;
    }
  };

  const openUploadDialog = () => {
    if (!canModifyTask) return;
    setIsUploadAreaOpen(true);
    uploadInputRef.current?.click();
  };


  const getDaysInMonth = (year, month) => {
    const days = [];
    const startDay = new Date(year, month, 1).getDay();
    const numDays = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= numDays; d++) days.push(d);
    return days;
  };


  const monthAbbrs = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];


  useEffect(() => {
    if (task) {
      setLocalTask(task);
      setAssignHistory(sortAssignHistory(task.assignmentHistory || []));
      setTempDescription(task.description || '');
      setTempTitle(task.title || '');
      setComments((task.comments || []).map(mapApiComment));
      setAttachments(hydrateAttachments(task.attachments || []));
      setCommentError('');
      setAttachmentError('');
      setPendingDescriptionAttachments([]);
      setReplyToCommentId(null);
      setEditCommentId(null);
      setIsDescriptionEditing(false);
      setIsTitleEditing(false);

      const taskId = task.task_id || task.taskId || task.id;
      if (taskId) {
        loadComments(taskId);
        loadAttachments(taskId);
      }


      const completedDateValue = getCompletedDateValue(task);
      if (completedDateValue) {
        const d = new Date(completedDateValue);
        if (!isNaN(d.getTime())) {
          setCompletedMonth(d.getMonth());
          setCompletedYear(d.getFullYear());
        }
      }
      if (task.createdAt) {
        const d = new Date(task.createdAt);
        if (!isNaN(d.getTime())) {
          setCreatedMonth(d.getMonth());
          setCreatedYear(d.getFullYear());
        }
      }
    }
  }, [task]);

  // Update baseMax on resize so image fits the viewport nicely
  useEffect(() => {
    const update = () => {
      const w = Math.max(600, window.innerWidth * 0.7);
      const h = Math.max(400, window.innerHeight * 0.7);
      setBaseMax({ w, h });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);


  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);


  if (!task) return null;

  const completedDateValue = getCompletedDateValue(localTask);
  const completedDateLabel = formatCompletedDate(completedDateValue);
  const isCompletedOverdue = isCompletedDateOverdue(
    completedDateValue,
    localTask.status || localTask.task_status,
    localTask.is_overdue
  );
  const isCompletedDueToday = !isCompletedOverdue && isCompletedDateDueToday(
    completedDateValue,
    localTask.status || localTask.task_status,
    localTask.is_due_today
  );
  const completedDateColor = isCompletedOverdue ? '#BA1A1A' : isCompletedDueToday ? DUE_TODAY_COLOR : '#172B4D';
  const completedDateBackground = isCompletedOverdue ? '#FFF0F0' : isCompletedDueToday ? DUE_TODAY_BACKGROUND : 'transparent';
  const completedDateIconColor = isCompletedOverdue ? '#BA1A1A' : isCompletedDueToday ? DUE_TODAY_COLOR : '#6B778C';


  // Get initials from name
  const getInitials = (name) => {
    const displayName = typeof name === 'string'
      ? name
      : name?.full_name || name?.name || name?.email || '';
    if (!displayName) return 'UN';
    const parts = displayName.split(' ').filter(Boolean);
    if (parts.length === 0) return 'UN';
    return parts.map(n => n ? n[0] : '').join('').toUpperCase().substring(0, 2);
  };

  const getReplies = (parentId) => comments.filter(comment => comment.parentId === parentId);


  const renderComment = (comment, level = 0) => (
    <div key={comment.id} className="flex flex-col gap-3 relative" style={{ paddingLeft: `${level * 36}px` }}>
      <div className="flex gap-3">
        <div
          className="shrink-0 flex items-center justify-center"
          style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#DFE1E6', fontSize: '11px', fontWeight: 700, color: '#42526E' }}
        >
          {comment.author.split(' ').map(n => n ? n[0] : '').join('').toUpperCase().substring(0, 2)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#172B4D' }}>{comment.author}</span>
            <span style={{ fontSize: '11px', color: '#6B778C' }}>{comment.date}</span>
          </div>
          <p style={{ fontSize: '13px', color: '#172B4D', lineHeight: '1.5' }} dangerouslySetInnerHTML={{ __html: comment.text }} />
          {canEditTaskContent && (
          <div className="flex gap-4" style={{ marginTop: '6px' }}>
            <button
              style={{ fontSize: '11px', fontWeight: 500, color: '#6B778C', background: 'none', border: 'none', cursor: 'pointer' }}
              className="hover:text-[#4C2B74]"
              onClick={() => {
                setReplyToCommentId(comment.id);
                setTempComment(`@${comment.author} `);
                setIsCommentEditing(true);
              }}
            >
              Reply
            </button>
            {isCommentOwner(comment) && (
              <>
                <button
                  style={{ fontSize: '11px', fontWeight: 500, color: '#6B778C', background: 'none', border: 'none', cursor: 'pointer' }}
                  className="hover:text-[#4C2B74]"
                  onClick={() => {
                    setTempComment(comment.text);
                    setReplyToCommentId(null);
                    setEditCommentId(comment.id);
                    setIsCommentEditing(true);
                  }}
                >
                  Edit
                </button>
                <button
                  style={{ fontSize: '11px', fontWeight: 500, color: '#DE350B', background: 'none', border: 'none', cursor: 'pointer' }}
                  className="hover:text-[#B91C1C]"
                  onClick={() => setDeleteConfirmCommentId(comment.id)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
          )}
        </div>
      </div>
      {canEditTaskContent && replyToCommentId === comment.id && (
        <div className="flex flex-col gap-3" style={{ paddingLeft: '36px' }}>
          <div style={{ fontSize: '12px', color: '#42526E' }}>Replying to {comment.author}</div>
          <RichTextEditor
            value={tempComment}
            onChange={(val) => setTempComment(val)}
            placeholder="Add a reply..."
            tasks={tasks}
            onUploadFile={handleFileUploadObject}
            uploadUsage="comment"
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const saved = tempComment.trim()
                  ? await createComment(tempComment, comment.id)
                  : false;
                if (!saved) return;
                setIsCommentEditing(false);
                setTempComment('');
                setReplyToCommentId(null);
              }}
              style={{ padding: '6px 16px', backgroundColor: '#4C2B74', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              className="hover:opacity-90 active:scale-[0.97] transition-all"
            >
              Comment
            </button>
            <button
              onClick={() => {
                setIsCommentEditing(false);
                setTempComment('');
                setReplyToCommentId(null);
              }}
              style={{ padding: '6px 16px', background: 'none', border: 'none', borderRadius: '3px', fontSize: '14px', fontWeight: 500, color: '#42526E', cursor: 'pointer' }}
              className="hover:bg-[#EBECF0] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {canEditTaskContent && editCommentId === comment.id && (
        <div className="flex flex-col gap-3" style={{ paddingLeft: '36px' }}>
          <div style={{ fontSize: '12px', color: '#42526E' }}>Editing comment</div>
          <RichTextEditor
            value={tempComment}
            onChange={(val) => setTempComment(val)}
            placeholder="Edit comment..."
            tasks={tasks}
            onUploadFile={handleFileUploadObject}
            uploadUsage="comment"
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const saved = tempComment.trim()
                  ? await updateComment(comment.id, tempComment)
                  : false;
                if (!saved) return;
                setIsCommentEditing(false);
                setTempComment('');
                setEditCommentId(null);
              }}
              style={{ padding: '6px 16px', backgroundColor: '#4C2B74', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              className="hover:opacity-90 active:scale-[0.97] transition-all"
            >
              Comment
            </button>
            <button
              onClick={() => {
                setIsCommentEditing(false);
                setTempComment('');
                setEditCommentId(null);
              }}
              style={{ padding: '6px 16px', background: 'none', border: 'none', borderRadius: '3px', fontSize: '14px', fontWeight: 500, color: '#42526E', cursor: 'pointer' }}
              className="hover:bg-[#EBECF0] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {getReplies(comment.id).map(reply => renderComment(reply, level + 1))}
    </div>
  );

  const getAssigneeProfile = (assignee) => {
    const displayName = assignee || 'Unassigned';
    return {
      initials: getInitials(displayName),
      color: displayName === 'Unassigned' ? '#8e8f90' : '#9CA3AF',
      textColor: '#FFFFFF',
    };
  };

  const sortAssignHistory = (history) => {
    return [...history].sort((a, b) => new Date(b.changed_at || 0) - new Date(a.changed_at || 0));
  };

  const getUserDisplayName = (user, fallback = 'Unassigned') => {
    if (!user) return fallback;
    if (typeof user === 'string') return user || fallback;
    return user.full_name || user.name || user.email || fallback;
  };

  const getHistoryUser = (entry, field) => {
    return entry[field] || (entry[`${field}_name`] ? { name: entry[`${field}_name`] } : null);
  };

  const getHistoryName = (entry, field) => {
    return getUserDisplayName(getHistoryUser(entry, field), 'Unassigned');
  };

  const getChangedByName = (entry) => {
    return getUserDisplayName(entry.changed_by_user || entry.changed_by_name || entry.changed_by, 'Unknown user');
  };

  const getHistoryProfile = (user, fallbackName = 'Unassigned') => {
    const userId = typeof user === 'object' && user ? (user.user_id || user.id || '') : '';
    const displayName = getUserDisplayName(user, fallbackName);
    const matchedUser = availableAssignees.find(option => {
      const optionId = option.user_id || option.id || '';
      return (userId && optionId === userId) || option.name === displayName || option.email === user?.email;
    });
    const fallbackProfile = getAssigneeProfile(displayName);
    const avatarUrl = normalizeAvatarUrl(
      (typeof user === 'object' && user ? (user.avatar_url || user.avatarUrl || user.avatar || '') : '') ||
      matchedUser?.avatarUrl ||
      matchedUser?.avatar_url ||
      ''
    );

    return {
      name: displayName,
      initials: matchedUser?.initials || fallbackProfile.initials || getInitials(displayName),
      color: matchedUser?.color || fallbackProfile.color,
      textColor: matchedUser?.textColor || fallbackProfile.textColor || '#FFFFFF',
      avatarUrl,
    };
  };

  const renderHistoryAvatar = (profile, size = 28, fontSize = 10) => (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: profile.color,
        color: profile.textColor || '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${fontSize}px`,
        fontWeight: 700,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {profile.avatarUrl ? (
        <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
      ) : (
        profile.initials
      )}
    </div>
  );

  const getHistoryChangeType = (entry) => {
    const previousUser = getHistoryUser(entry, 'previous_assignee');
    const newUser = getHistoryUser(entry, 'new_assignee');
    const previousName = getUserDisplayName(previousUser, '');
    const newName = getUserDisplayName(newUser, '');
    const hasPreviousAssignee = Boolean(entry.previous_assignee_id || (previousUser && previousName !== 'Unassigned'));
    const hasNewAssignee = Boolean(entry.new_assignee_id || (newUser && newName !== 'Unassigned'));
    if (!hasPreviousAssignee && hasNewAssignee) return 'assigned';
    if (hasPreviousAssignee && !hasNewAssignee) return 'removed';
    if (hasPreviousAssignee && hasNewAssignee) return 'reassigned';
    return 'updated';
  };

  const formatHistoryTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    return date.toLocaleString();
  };

  const handleAssigneeChange = async (selectedUser) => {
    if (!canManageAdminFields) return;
    const newAssigneeId = selectedUser.user_id || selectedUser.id || '';

    if (!newAssigneeId) {
      try {
        await Promise.all(localAssignedUsers.map(user =>
          onRemoveAssignee?.(localTask.id, user.user_id || user.id)
        ));
      } catch {
        return;
      }
      setIsAssigneeOpen(false);
      return;
    }

    const alreadyAssigned = localAssignedUsers.some(user => (user.user_id || user.id) === newAssigneeId);
    if (alreadyAssigned) {
      setIsAssigneeOpen(false);
      return;
    }

    try {
      await onAddAssignee?.(localTask.id, selectedUser);
    } catch {
      return;
    }

    setIsAssigneeOpen(false);
  };

  const handleRemoveAssignee = async (assigneeUserId) => {
    if (!assigneeUserId) return;
    try {
      await onRemoveAssignee?.(localTask.id, assigneeUserId);
    } catch {
      return;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(9, 30, 66, 0.54)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white flex flex-col overflow-hidden"
        style={{
          width: '90%',
          maxWidth: '1100px',
          height: '90vh',
          borderRadius: '8px',
          boxShadow: '0 8px 16px -4px rgba(9,30,66,0.25), 0 0 0 1px rgba(9,30,66,0.08)',
          animation: 'modalFadeIn 0.2s ease-out',
          fontFamily: 'var(--font-inter)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ─── Header ─── */}
        <div
          className="flex justify-between items-center shrink-0"
          style={{ padding: '14px 24px', borderBottom: '2px solid #F4F5F7' }}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined " style={{ color: '#4C2B74', fontSize: '25px' }}>task_alt</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#5E6C84', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {task.displayId || task.id} / {task.sprint || 'Development'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* share and more icons removed per UX request */}
            <button className="flex items-center justify-center p-1.5 rounded hover:bg-[#EBECF0] transition-colors" onClick={onClose} title="Close">
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#42526E' }}>close</span>
            </button>
          </div>
        </div>


        {/* ─── Body ─── */}
        <div className="flex flex-1 overflow-hidden">


          {/* ── Left: Main Details ── */}
          <main
            className="flex-1 overflow-y-auto custom-scrollbar"
            style={{ padding: '28px 32px', backgroundColor: '#fff' }}
          >
            {/* Title */}
            {!isTitleEditing ? (
              <h1
                onClick={() => { if (canEditTaskContent) setIsTitleEditing(true); }}
                className={`rounded transition-colors ${canEditTaskContent ? 'hover:bg-[#F4F5F7] cursor-pointer' : ''}`}
                style={{ fontSize: '20px', fontWeight: 500, color: '#172B4D', marginBottom: '16px', lineHeight: '1.4', padding: '4px 8px', marginLeft: '-8px' }}
              >
                {localTask.title}
              </h1>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onBlur={() => {
                    setLocalTask(prev => ({ ...prev, title: tempTitle }));
                    syncTask({ title: tempTitle });
                    setIsTitleEditing(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setLocalTask(prev => ({ ...prev, title: tempTitle }));
                      syncTask({ title: tempTitle });
                      setIsTitleEditing(false);
                    } else if (e.key === 'Escape') {
                      setTempTitle(localTask.title);
                      setIsTitleEditing(false);
                    }
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    fontSize: '20px',
                    fontWeight: 500,
                    color: '#172B4D',
                    padding: '4px 8px',
                    marginLeft: '-8px',
                    border: '2px solid #4C2B74',
                    borderRadius: '3px',
                    outline: 'none',
                    backgroundColor: '#fff'
                  }}
                />
              </div>
            )}


            {/* Action Buttons */}
            <div className="flex gap-2" style={{ marginBottom: '28px' }}>
              {/* Attach button removed as requested */}
            </div>


            {/* Description */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '11px', fontWeight: 600, color: '#5E6C84', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Description
              </h3>


              {!isDescriptionEditing ? (
                <div
                  className={`group ${canEditTaskContent ? 'cursor-text hover:bg-[#F4F5F7]' : 'cursor-default'}`}
                  style={{ padding: '12px 16px', border: '1px solid #DFE1E6', borderRadius: '4px', minHeight: '100px', backgroundColor: 'white' }}
                  onClick={() => { if (canEditTaskContent) setIsDescriptionEditing(true); }}
                >
                  {localTask.description ? (
                    <div
                      style={{ fontSize: '14px', lineHeight: '1.6', color: '#172B4D' }}
                      dangerouslySetInnerHTML={{ __html: localTask.description }}
                    />
                  ) : (
                    <span style={{ fontSize: '14px', color: '#6B778C' }}>Add a description...</span>
                  )}
                  {canEditTaskContent && (
                    <div className="hidden group-hover:block" style={{ marginTop: '8px', fontSize: '12px', color: '#6B778C', fontStyle: 'italic' }}>
                      Click to edit...
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <RichTextEditor
                    value={tempDescription}
                    onChange={(val) => setTempDescription(val)}
                    placeholder="Describe this task..."
                    tasks={tasks}
                    onUploadFile={handleFileUploadObject}
                    uploadUsage="description"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const combinedAttachments = [...attachments, ...pendingDescriptionAttachments];
                        setLocalTask(prev => ({ ...prev, description: tempDescription, attachments: combinedAttachments }));
                        syncTask({ description: tempDescription, attachments: combinedAttachments });
                        setAttachments(combinedAttachments);
                        setPendingDescriptionAttachments([]);
                        setIsDescriptionEditing(false);
                      }}
                      style={{ padding: '6px 12px', backgroundColor: '#4C2B74', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                      className="hover:opacity-90 transition-all"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setTempDescription(localTask.description || '');
                        setIsDescriptionEditing(false);
                      }}
                      style={{ padding: '6px 12px', background: 'none', border: 'none', borderRadius: '3px', fontSize: '13px', fontWeight: 600, color: '#42526E', cursor: 'pointer' }}
                      className="hover:bg-[#EBECF0] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>


            {/* Attachments */}
            <div style={{ marginBottom: '28px' }}>
              <div className="flex items-center" style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 600, color: '#5E6C84', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Attachments ({attachments.length})
                </h3>
                {isLoadingAttachments && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', color: '#6B778C' }}>Loading...</span>
                )}
                <input
                  type="file"
                  ref={uploadInputRef}
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  accept=".pdf,.zip,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                  multiple
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 group cursor-pointer hover:bg-[#F4F5F7] transition-colors"
                    style={{ padding: '10px 14px', border: '1px solid #DFE1E6', borderRadius: '6px' }}
                    onClick={() => {
                      if (file.type === 'image' && file.previewUrl) {
                        setPreviewAttachment(file);
                      }
                    }}
                  >
                    {file.type === 'image' && file.previewUrl ? (
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #DFE1E6' }}
                      />
                    ) : (
                      <div className="flex items-center justify-center shrink-0" style={{ width: '40px', height: '40px', backgroundColor: file.bg, borderRadius: '6px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '22px', color: file.color }}>{file.icon}</span>
                      </div>
                    )}
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <span className="truncate" style={{ fontSize: '13px', fontWeight: 600, color: '#172B4D' }}>{file.name}</span>
                      <span style={{ fontSize: '11px', color: '#6B778C' }}>{file.size} • {file.date}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {canEditTaskContent && isAttachmentOwner(file) && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); triggerReplace(file.id); }}
                            title="Replace"
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6B778C', padding: 6, borderRadius: 6 }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteAttachment(file.id); }}
                            title="Delete"
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DE350B', padding: 6, borderRadius: 6 }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </>
                      )}
                      {file.previewUrl || file.url ? (
                        <button
                          onClick={(e) => downloadAttachment(file, e)}
                          title="Download"
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#42526E', padding: 6, borderRadius: 6 }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                        </button>
                      ) : (
                        <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: '18px', color: '#42526E' }}>download</span>
                      )}
                    </div>
                  </div>
                ))}
                <input type="file" ref={replaceInputRef} onChange={handleReplaceFile} style={{ display: 'none' }} />
              </div>
              {attachmentError && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#DE350B', fontWeight: 600 }}>
                  {attachmentError}
                </div>
              )}
              {canEditTaskContent && (
                <div
                  className="mt-4 p-5 rounded-2xl border border-dashed border-[#DFE1E6] bg-[#FAFBFC] hover:bg-[#F4F5F7] transition-colors"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                  onClick={openUploadDialog}
                >
                  <div
                    className="flex items-center justify-center"
                    style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: '#F4F7FA' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#4C2B74' }}>cloud_upload</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D' }}>Click to upload or drag and drop</div>
                    <div style={{ fontSize: '12px', color: '#6B778C', marginTop: '4px' }}>PDF, ZIP, images, or Office files up to 20MB</div>
                  </div>
                </div>
              )}
            </div>

            {previewAttachment && (
              <div
                className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/70"
                onClick={() => {
                  setPreviewAttachment(null);
                  setPreviewZoom(1);
                }}
              >
                <div
                  className="bg-white rounded-2xl p-2"
                  style={{ position: 'relative', width: '75vw', height: '80vh', padding: 12, overflow: 'hidden' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: '8px', zIndex: 20 }}>
                    <button
                      onClick={() => setPreviewZoom(prev => Math.max(0.5, prev - 0.25))}
                      style={{ border: '1px solid #DFE1E6', background: '#fff', borderRadius: '6px', width: '34px', height: '34px', fontSize: '18px', color: '#4C2B74', cursor: 'pointer' }}
                      title="Zoom out"
                    >
                      −
                    </button>
                    <button
                      onClick={() => setPreviewZoom(prev => Math.min(2, prev + 0.25))}
                      style={{ border: '1px solid #DFE1E6', background: '#fff', borderRadius: '6px', width: '34px', height: '34px', fontSize: '18px', color: '#4C2B74', cursor: 'pointer' }}
                      title="Zoom in"
                    >
                      +
                    </button>
                    <button
                      onClick={() => {
                        setPreviewAttachment(null);
                        setPreviewZoom(1);
                      }}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#4C2B74', fontSize: '24px', lineHeight: '1' }}
                      title="Close"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex items-center justify-between mb-3" style={{ gap: '12px', minWidth: '300px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D' }}>{previewAttachment.name}</div>
                      <div style={{ fontSize: '12px', color: '#6B778C' }}>{previewAttachment.size}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', overflow: 'auto', height: 'calc(80vh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ display: 'inline-block' }}>
                      <img
                        ref={previewImgRef}
                        src={previewAttachment.previewUrl}
                        alt={previewAttachment.name}
                        onLoad={(e) => {
                          const iw = e.target.naturalWidth || e.target.width;
                          const ih = e.target.naturalHeight || e.target.height;
                          setNaturalSize({ w: iw, h: ih });
                          // compute fit scale to baseMax
                          const fitScale = Math.min(1, baseMax.w / iw, baseMax.h / ih);
                          const bw = Math.round(iw * fitScale);
                          setBaseWidth(bw);
                          // reset zoom to 1 when loading new image
                          setPreviewZoom(1);
                        }}
                        style={{
                          width: baseWidth ? `${Math.max(40, Math.min(baseWidth * previewZoom, baseMax.w * 4))}px` : 'auto',
                          height: 'auto',
                          maxWidth: 'none',
                          maxHeight: 'none',
                          borderRadius: '6px',
                          display: 'block'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* ── Activity Tabs ── */}
            <div>
              <div className="flex items-center gap-6" style={{ borderBottom: '2px solid #F4F5F7', marginBottom: '20px' }}>
                <button
                  onClick={() => setActiveTab('comments')}
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: activeTab === 'comments' ? '#4C2B74' : '#5E6C84',
                    borderBottom: activeTab === 'comments' ? '2px solid #4C2B74' : '2px solid transparent',
                    padding: '10px 2px',
                    marginBottom: '-2px',
                    background: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  Comments
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: activeTab === 'history' ? '#4C2B74' : '#5E6C84',
                    borderBottom: activeTab === 'history' ? '2px solid #4C2B74' : '2px solid transparent',
                    padding: '10px 2px',
                    marginBottom: '-2px',
                    background: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  Assign History
                </button>
              </div>


              {/* Comments View */}
              {activeTab === 'comments' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {commentError && (
                    <div style={{ fontSize: '12px', color: '#DE350B', fontWeight: 600 }}>
                      {commentError}
                    </div>
                  )}
                  {/* Comment Editor */}
                  {!replyToCommentId && !editCommentId && (
                    <div className="flex flex-col gap-3" style={{ paddingTop: '8px' }}>
                      {!isCommentEditing ? (
                        <div
                          className="flex-1 cursor-text hover:bg-[#F4F5F7] transition-colors"
                          style={{
                            padding: '10px 14px',
                            border: '2px solid #DFE1E6',
                            borderRadius: '3px',
                            fontSize: '13px',
                            color: '#6B778C',
                            backgroundColor: '#FAFBFC',
                            minHeight: '40px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onClick={() => {
                            setIsCommentEditing(true);
                            setReplyToCommentId(null);
                          }}
                        >
                          Add a comment...
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <RichTextEditor
                            value={tempComment}
                            onChange={(val) => setTempComment(val)}
                            placeholder="Add a comment..."
                            tasks={tasks}
                            onUploadFile={handleFileUploadObject}
                            uploadUsage="comment"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                const saved = tempComment.trim()
                                  ? await createComment(tempComment, null)
                                  : false;
                                if (!saved) return;
                                setIsCommentEditing(false);
                                setTempComment('');
                                setReplyToCommentId(null);
                              }}
                              style={{ padding: '6px 16px', backgroundColor: '#4C2B74', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
                              className="hover:opacity-90 active:scale-[0.97] transition-all"
                            >
                              Comment
                            </button>
                            <button
                              onClick={() => {
                                setIsCommentEditing(false);
                                setTempComment('');
                                setReplyToCommentId(null);
                              }}
                              style={{ padding: '6px 16px', background: 'none', border: 'none', borderRadius: '3px', fontSize: '14px', fontWeight: 500, color: '#42526E', cursor: 'pointer' }}
                              className="hover:bg-[#EBECF0] transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}


                  {/* Existing Comments */}
                  <div className="flex flex-col gap-4">
                    {isLoadingComments ? (
                      <div style={{ color: '#6B778C', fontSize: '13px' }}>Loading comments...</div>
                    ) : (
                      comments.filter(comment => comment.parentId === null).map(comment => renderComment(comment))
                    )}
                  </div>
                </div>
              )}


              {/* History View */}
              {activeTab === 'history' && (
                <div>
                  {assignHistory.length === 0 ? (
                    <div style={{ color: '#6B778C', fontSize: '13px', padding: '12px 8px' }}>No assignment changes yet.</div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {sortAssignHistory(assignHistory).map(entry => {
                        const previousName = getHistoryName(entry, 'previous_assignee');
                        const nextName = getHistoryName(entry, 'new_assignee');
                        const changedByName = getChangedByName(entry);
                        const changeType = getHistoryChangeType(entry);
                        const targetName = changeType === 'removed' ? previousName : nextName;
                        const actionText = changeType === 'assigned'
                          ? 'assigned'
                          : changeType === 'removed'
                            ? 'removed'
                            : 'changed';
                        const actionStyle = changeType === 'assigned'
                          ? { color: '#006D3A', backgroundColor: '#E6FFF0' }
                          : changeType === 'removed'
                            ? { color: '#BA1A1A', backgroundColor: '#FFF0F0' }
                            : { color: '#5E35B1', backgroundColor: '#F0EDFF' };
                        const changedByProfile = getHistoryProfile(entry.changed_by_user || entry.changed_by_name || entry.changed_by, changedByName);
                        const targetProfile = getHistoryProfile(
                          changeType === 'removed' ? getHistoryUser(entry, 'previous_assignee') : getHistoryUser(entry, 'new_assignee'),
                          targetName
                        );
                        return (
                          <div key={entry.assignment_history_id || entry.id} style={{ padding: '8px 0', borderBottom: '1px solid #F4F5F7' }}>
                            <div className="flex items-start gap-3">
                              {renderHistoryAvatar(changedByProfile, 32, 11)}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', minWidth: 0, fontSize: '13px', color: '#172B4D' }}>
                                    <span style={{ fontWeight: 700 }}>{changedByName}</span>
                                    <span style={{ ...actionStyle, display: 'inline-flex', alignItems: 'center', borderRadius: '4px', padding: '1px 6px', fontSize: '11px', fontWeight: 700 }}>{actionText}</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#172B4D' }}>
                                      {renderHistoryAvatar(targetProfile, 20, 8)}
                                      {targetName}
                                    </span>
                                    {changeType === 'reassigned' && (
                                      <>
                                        <span style={{ color: '#6B778C' }}>from</span>
                                        <span style={{ fontWeight: 600 }}>{previousName}</span>
                                      </>
                                    )}
                                  </div>
                                  <span style={{ flexShrink: 0, fontSize: '11px', color: '#6B778C' }}>{formatHistoryTime(entry.changed_at)}</span>
                                </div>
                                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '11px', color: '#6B778C' }}>
                                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.reason || 'Assignment updated'}</span>
                                  {entry.change_status && (
                                    <span style={{ display: 'inline-flex', flexShrink: 0, alignItems: 'center', padding: '2px 7px', borderRadius: '4px', backgroundColor: '#F2F4F7', color: '#475467', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                                      {entry.change_status}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>


          {/* ── Right Sidebar ── */}
          <aside
            className="overflow-y-auto custom-scrollbar shrink-0"
            style={{ width: '340px', borderLeft: '2px solid #F4F5F7', padding: '24px', backgroundColor: '#FAFBFC' }}
          >
            {/* Sidebar Header */}
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#42526E', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '16px' }}>
              DETAIL TASK
            </h2>


            <div style={{ backgroundColor: '#fff', border: '1px solid #DFE1E6', borderRadius: '6px', padding: '20px' }}>


              {/* ── Assignee ── */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#5E6C84', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Assignee
                </label>
                <div
                  className="relative"
                  onMouseEnter={() => { if (canManageAdminFields) setIsAssigneeOpen(true); }}
                  onMouseLeave={() => { if (canManageAdminFields) setIsAssigneeOpen(false); }}
                >
                  {(() => {
                    const profile = getAssigneeProfile(localTask.assignee);
                    return (
                      <>
                        <div
                          className={`flex min-h-[44px] items-center gap-2 w-full rounded-none bg-white px-3 py-2 text-left transition-colors ${canManageAdminFields ? 'hover:bg-[#F4F5F7]' : ''}`}
                        >
                          {localAssignedUsers.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-2">
                              {localAssignedUsers.map(user => {
                                const userId = user.user_id || user.id;
                                return (
                                  <span
                                    key={userId || user.name}
                                    className="group/avatar inline-flex items-center gap-1 rounded-full bg-[#F4F5F7] py-0.5 pl-0.5 pr-2"
                                  >
                                    <span
                                      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold"
                                      style={{ backgroundColor: user.color || '#9CA3AF', color: user.textColor || '#FFFFFF' }}
                                    >
                                      {(user.avatarUrl || user.avatar_url) ? (
                                        <img src={user.avatarUrl || user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
                                      ) : (
                                        user.initials || getInitials(user.name)
                                      )}
                                    </span>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#172B4D' }}>{user.name}</span>
                                    {canManageAdminFields && userId && (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleRemoveAssignee(userId);
                                        }}
                                        className="ml-0.5 hidden h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold leading-none text-slate-500 shadow-sm hover:bg-slate-200 group-hover/avatar:inline-flex"
                                        aria-label={`Remove ${user.name}`}
                                      >
                                        x
                                      </button>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <>
                              <div
                                className="shrink-0 flex items-center justify-center"
                                style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: profile.color, color: profile.textColor || '#FFFFFF', fontSize: '10px', fontWeight: 700 }}
                              >
                                {profile.initials}
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#172B4D' }}>Unassigned</span>
                            </>
                          )}
                        </div>
                        <div className={`absolute left-0 top-full z-50 mt-2 w-full rounded-none border border-outline-variant bg-white shadow-2xl transition-all duration-150 overflow-hidden ${isAssigneeOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                          {availableAssignees.map(user => {
                            const userId = user.user_id || user.id || '';
                            const isAssigned = userId && localAssignedUsers.some(assigned => (assigned.user_id || assigned.id) === userId);
                            return (
                            <button
                              key={user.name}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (canManageAdminFields) handleAssigneeChange(user);
                              }}
                              disabled={Boolean(isAssigned)}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-left text-[12px] transition-colors ${isAssigned ? 'bg-gray-50 text-gray-400 cursor-default' : canManageAdminFields ? 'hover:bg-[#EBF0FF]' : ''}`}
                            >
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden text-[10px] font-bold"
                                style={{ backgroundColor: user.color, color: user.textColor || '#111' }}
                              >
                                {(user.avatarUrl || user.avatar_url) ? (
                                  <img src={user.avatarUrl || user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
                                ) : (
                                  user.initials || <span className="material-symbols-outlined">{user.icon}</span>
                                )}
                              </div>
                              <span>{user.name}</span>
                              {isAssigned && <span className="ml-auto text-[10px] font-bold">Added</span>}
                            </button>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>


              {/* ── Status ── */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#5E6C84', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Status
                </label>
                <div className="relative">
                  <div
                    className={`status-custom-trigger ${canEditTaskContent ? '' : 'cursor-default opacity-90'}`}
                    style={{ padding: '4px 10px', border: '1px solid #DFE1E6', borderRadius: '4px', background: 'white' }}
                    onClick={() => { if (canEditTaskContent) setIsStatusOpen(!isStatusOpen); }}
                  >
                    <span className={`status-badge-pill ${(localTask?.status || '') === 'Need Revision' ? 'badge-revision' :
                      (localTask?.status || '') === 'Done' ? 'badge-done' :
                        ((localTask?.status || '') === 'Cancelled' || (localTask?.status || '') === 'New') ? 'badge-neutral' :
                          'badge-progress'
                      }`} style={{ fontSize: '11px' }}>
                      {(localTask?.status || 'IN PROGRESS').toUpperCase()}
                    </span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#6B778C' }}>expand_more</span>
                  </div>


                  {isStatusOpen && canEditTaskContent && (
                    <div className="status-custom-dropdown" style={{ left: 0, width: '100%' }}>
                      {statusOptions.map(s => (
                        <div
                          key={s}
                          className="status-dropdown-item"
                          onClick={() => {
                            setLocalTask(prev => ({ ...prev, status: s }));
                            syncTask({ status: s });
                            setIsStatusOpen(false);
                          }}
                        >
                          <span className={`status-badge-pill ${s === 'Need Revision' ? 'badge-revision' :
                            s === 'Done' ? 'badge-done' :
                              (s === 'Cancelled' || s === 'New') ? 'badge-neutral' :
                                'badge-progress'
                            }`} style={{ fontSize: '10px' }}>
                            {s.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>


              {/* ── Priority ── */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#5E6C84', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Priority
                </label>
                <div className="relative">
                  <div
                    className={`priority-custom-trigger ${canManageAdminFields ? '' : 'cursor-default opacity-90'}`}
                    style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #DFE1E6' }}
                    onClick={() => { if (canManageAdminFields) setIsPriorityOpen(!isPriorityOpen); }}
                  >
                    <div className="flex items-center gap-2">
                      {localTask.priority === 'High' ? (
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#DE350B' }}>keyboard_arrow_up</span>
                      ) : localTask.priority === 'Medium' ? (
                        <span style={{ fontSize: '18px', color: '#FF8B00', fontWeight: 700 }}>=</span>
                      ) : (
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#4C2B74' }}>keyboard_arrow_down</span>
                      )}
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#172B4D' }}>{localTask?.priority || 'Medium'}</span>
                    </div>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#6B778C' }}>expand_more</span>
                  </div>


                  {isPriorityOpen && canManageAdminFields && (
                    <div className="priority-custom-dropdown" style={{ left: 0, width: '100%' }}>
                      {[
                        { label: 'High', icon: 'keyboard_arrow_up', color: '#DE350B' },
                        { label: 'Medium', icon: '=', color: '#FF8B00' },
                        { label: 'Low', icon: 'keyboard_arrow_down', color: '#4C2B74' }
                      ].map(p => (
                        <div
                          key={p.label}
                          className="priority-dropdown-item flex items-center gap-3"
                          onClick={() => {
                            setLocalTask(prev => ({ ...prev, priority: p.label }));
                            syncTask({ priority: p.label });
                            setIsPriorityOpen(false);
                          }}
                        >
                          {p.label === 'Medium' ? (
                            <span style={{ fontSize: '18px', color: p.color, fontWeight: 700 }}>{p.icon}</span>
                          ) : (
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: p.color }}>{p.icon}</span>
                          )}
                          <span style={{ fontSize: '12px' }}>{p.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>


              {/* Divider */}
              <div style={{ height: '1px', backgroundColor: '#EBECF0', margin: '4px 0 20px' }}></div>


              {/* ── Story Points ── */}
              <div className="flex justify-between items-center group cursor-pointer" style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#5E6C84', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Story Points</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={localTask?.pts || 0}
                    onChange={(e) => {
                      if (!canManageAdminFields) return;
                      const rawValue = e.target.value;
                      const pts = rawValue === '' ? 0 : Number(rawValue);
                      if (!Number.isFinite(pts) || pts < 0) return;
                      setLocalTask(prev => ({ ...prev, pts }));
                      syncTask({ pts });
                    }}
                    className="story-points-input"
                    readOnly={!canManageAdminFields}
                    style={{
                      width: '45px',
                      padding: '2px 4px',
                      border: '1px solid #DFE1E6',
                      borderRadius: '3px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#172B4D',
                      textAlign: 'center',
                      outline: 'none',
                      backgroundColor: canManageAdminFields ? '#F4F5F7' : '#ECEFF4',
                      cursor: canManageAdminFields ? 'text' : 'not-allowed'
                    }}
                  />
                  <style>{`
                    .story-points-input::-webkit-inner-spin-button,
                    .story-points-input::-webkit-outer-spin-button {
                      opacity: 1;
                    }
                    .story-points-input:focus {
                      background-color: #fff !important;
                      border-color: #4C2B74 !important;
                      box-shadow: 0 0 0 2px rgba(76, 43, 116, 0.2);
                    }
                  `}</style>
                </div>
              </div>


              {/* ── Sprint ── */}
              <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#5E6C84', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sprint</span>
                <div className="flex items-center gap-1.5" style={{ fontSize: '12px', fontWeight: 600, color: '#4C2B74' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>sprint</span>
                  {task.sprint || 'SCRUM Sprint 1'}
                </div>
              </div>


              {/* ── Due Date ── */}
              <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#5E6C84', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Completed</span>
                <div className="relative">
                  <div
                    className={`flex items-center gap-1.5 ${canManageAdminFields ? 'cursor-pointer hover:bg-[#F4F5F7]' : ''} rounded px-2 py-1 transition-colors`}
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: completedDateColor,
                      backgroundColor: completedDateBackground
                    }}
                    onClick={() => { if (canManageAdminFields) setIsCompletedOpen(!isCompletedOpen); }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: completedDateIconColor }}>calendar_today</span>
                    {completedDateLabel}
                  </div>


                  {isCompletedOpen && canManageAdminFields && (
                    <div className="calendar-dropdown-container" style={{ right: 0, left: 'auto', top: '100%', padding: '12px', width: '280px' }}>
                      <div className="calendar-header flex items-center justify-between mb-4">
                        <div className="flex gap-2">
                          <span
                            onClick={(e) => { e.stopPropagation(); setCompletedYear(y => y - 1); }}
                            className="material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
                            style={{ fontSize: '18px' }}
                          >
                            keyboard_double_arrow_left
                          </span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompletedMonth(m => {
                                if (m === 0) {
                                  setCompletedYear(y => y - 1);
                                  return 11;
                                }
                                return m - 1;
                              });
                            }}
                            className="material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
                            style={{ fontSize: '18px' }}
                          >
                            chevron_left
                          </span>
                        </div>
                        <span className="font-bold text-[#172B4D] text-sm">{monthNames[completedMonth]} {completedYear}</span>
                        <div className="flex gap-2">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompletedMonth(m => {
                                if (m === 11) {
                                  setCompletedYear(y => y + 1);
                                  return 0;
                                }
                                return m + 1;
                              });
                            }}
                            className="material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
                            style={{ fontSize: '18px' }}
                          >
                            chevron_right
                          </span>
                          <span
                            onClick={(e) => { e.stopPropagation(); setCompletedYear(y => y + 1); }}
                            className="material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
                            style={{ fontSize: '18px' }}
                          >
                            keyboard_double_arrow_right
                          </span>
                        </div>
                      </div>
                      <div className="calendar-body">
                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <span key={d} style={{ fontSize: '10px', fontWeight: 700, color: '#6B778C' }}>{d}</span>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {getDaysInMonth(completedYear, completedMonth).map((day, i) => {
                            if (day === null) return <div key={`empty-${i}`} style={{ height: '32px' }} />;
                            // Check if current day is selected
                            const selectedCompletedDate = getCompletedDateValue(localTask);
                            const isSelected = selectedCompletedDate && (() => {
                              const d = new Date(selectedCompletedDate);
                              return !isNaN(d.getTime()) &&
                                d.getDate() === day &&
                                d.getMonth() === completedMonth &&
                                d.getFullYear() === completedYear;
                            })();
                            const isToday = day === 24 && completedMonth === 5 && completedYear === 2026;
                            return (
                              <div
                                key={i}
                                className={`calendar-day ${isToday ? 'today' : ''}`}
                                style={{
                                  height: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '12px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  color: isSelected ? '#ffffff' : '#172B4D',
                                  backgroundColor: isSelected ? '#4C2B74' : 'transparent',
                                  fontWeight: isSelected ? 700 : 400
                                }}
                                onClick={() => {
                                  const formatted = `${monthAbbrs[completedMonth]} ${day}, ${completedYear}`;
                                  const completedAt = `${completedYear}-${String(completedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                  setLocalTask(prev => ({ ...prev, date: formatted, completed_at: completedAt }));
                                  syncTask({ date: formatted, completed_at: completedAt });
                                  setIsCompletedOpen(false);
                                }}
                              >
                                {day}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>


              {/* Divider */}
              <div style={{ height: '1px', backgroundColor: '#EBECF0', margin: '4px 0 16px' }}></div>


              {/* ── Timeline ── */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#5E6C84', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '12px' }}>
                  Timeline
                </span>
                <div className="flex flex-col gap-3.5">
                  <div className="flex justify-between items-center relative">
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#5E6C84', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Created</span>
                    <span
                      className={`transition-colors ${canManageAdminFields ? 'cursor-pointer hover:text-[#4C2B74]' : 'opacity-80 cursor-default'}`}
                      style={{ fontSize: '12px', fontWeight: 600, color: '#172B4D' }}
                      onClick={() => { if (canManageAdminFields) setIsCreatedOpen(!isCreatedOpen); }}
                    >
                      {localTask.createdAt || 'Jun 20, 2026'}
                    </span>


                    {isCreatedOpen && canManageAdminFields && (
                      <div className="calendar-dropdown-container" style={{ right: 0, top: '100%', padding: '12px', width: '280px', zIndex: 100 }}>
                        <div className="calendar-header flex items-center justify-between mb-4">
                          <div className="flex gap-2">
                            <span
                              onClick={(e) => { e.stopPropagation(); setCreatedYear(y => y - 1); }}
                              className="material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
                              style={{ fontSize: '18px' }}
                            >
                              keyboard_double_arrow_left
                            </span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setCreatedMonth(m => {
                                  if (m === 0) {
                                    setCreatedYear(y => y - 1);
                                    return 11;
                                  }
                                  return m - 1;
                                });
                              }}
                              className="material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
                              style={{ fontSize: '18px' }}
                            >
                              chevron_left
                            </span>
                          </div>
                          <span className="font-bold text-[#172B4D] text-sm">{monthNames[createdMonth]} {createdYear}</span>
                          <div className="flex gap-2">
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setCreatedMonth(m => {
                                  if (m === 11) {
                                    setCreatedYear(y => y + 1);
                                    return 0;
                                  }
                                  return m + 1;
                                });
                              }}
                              className="material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
                              style={{ fontSize: '18px' }}
                            >
                              chevron_right
                            </span>
                            <span
                              onClick={(e) => { e.stopPropagation(); setCreatedYear(y => y + 1); }}
                              className="material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
                              style={{ fontSize: '18px' }}
                            >
                              keyboard_double_arrow_right
                            </span>
                          </div>
                        </div>
                        <div className="calendar-body">
                          <div className="grid grid-cols-7 gap-1 text-center mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                              <span key={d} style={{ fontSize: '10px', fontWeight: 700, color: '#6B778C' }}>{d}</span>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {getDaysInMonth(createdYear, createdMonth).map((day, i) => {
                              if (day === null) return <div key={`empty-${i}`} style={{ height: '32px' }} />;
                              const isSelected = localTask.createdAt && (() => {
                                const d = new Date(localTask.createdAt);
                                return !isNaN(d.getTime()) &&
                                  d.getDate() === day &&
                                  d.getMonth() === createdMonth &&
                                  d.getFullYear() === createdYear;
                              })();
                              const isToday = day === 24 && createdMonth === 5 && createdYear === 2026;
                              return (
                                <div
                                  key={i}
                                  className={`calendar-day ${isToday ? 'today' : ''}`}
                                  style={{
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    color: isSelected ? '#ffffff' : '#172B4D',
                                    backgroundColor: isSelected ? '#4C2B74' : 'transparent',
                                    fontWeight: isSelected ? 700 : 400
                                  }}
                                  onClick={() => {
                                    const formatted = `${monthAbbrs[createdMonth]} ${day}, ${createdYear}`;
                                    setLocalTask(prev => ({ ...prev, createdAt: formatted }));
                                    syncTask({ createdAt: formatted });
                                    setIsCreatedOpen(false);
                                  }}
                                >
                                  {day}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#5E6C84', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Updated</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#172B4D', paddingRight: '2px' }}>{formatTimelineDateTime(localTask?.updated_at)}</span>
                  </div>


                  <div className="flex justify-between items-center" style={{ marginTop: '2px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#5E6C84', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Creator</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center justify-center"
                        style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#DFE1E6', fontSize: '10px', fontWeight: 700, color: '#42526E' }}
                      >
                        {getInitials(localTask?.creator || 'Peter Tan')}
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#172B4D' }}>{localTask?.creator || 'Peter Tan'}</span>
                    </div>
                  </div>
                </div>
              </div>


            </div>
          </aside>
        </div>
      </div>
      {deleteConfirmCommentId && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center" style={{ backgroundColor: 'rgba(9, 30, 66, 0.56)' }} onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-2xl shadow-2xl border border-[#DFE1E6]" style={{ width: '340px', padding: '20px 22px', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setDeleteConfirmCommentId(null)}
              style={{ position: 'absolute', top: '14px', right: '14px', width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: '#F4F5F7', color: '#42526E', cursor: 'pointer' }}
              className="hover:bg-[#E6E9EF] transition-colors"
              aria-label="Close delete confirmation"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px', lineHeight: 1 }}>close</span>
            </button>
            <div className="flex items-start gap-3" style={{ marginBottom: '14px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FFEBE9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: '#DE350B', fontSize: '18px' }}>warning</span>
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#172B4D', marginBottom: '4px' }}>Delete this comment?</h3>
                <p style={{ fontSize: '12px', color: '#5E6C84', lineHeight: '1.4' }}>Once you delete it, it&apos;s gone for good.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmCommentId(null)}
                style={{ padding: '8px 14px', border: '1px solid #DFE1E6', borderRadius: '8px', background: 'white', color: '#42526E', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                className="hover:bg-[#F4F5F7] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const deleted = await removeComment(deleteConfirmCommentId);
                  if (deleted) setDeleteConfirmCommentId(null);
                }}
                style={{ padding: '8px 14px', borderRadius: '8px', backgroundColor: '#DE350B', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                className="hover:opacity-90 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
