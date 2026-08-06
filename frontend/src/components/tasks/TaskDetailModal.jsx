import React, { useEffect, useMemo, useState, useRef } from 'react';
import '../../styles/CreateTaskModal.css';
import '../../styles/TaskDetailModal.css';
import axiosClient, { API_BASE_URL } from '../../api/axiosClient';
import { normalizeAvatarUrl } from '../../utils/avatar';
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

const getPriorityIconClass = (priority) => {
  if (priority === 'High') return 'task-detail-priority-high';
  if (priority === 'Medium') return 'task-detail-priority-medium';
  return 'task-detail-priority-low';
};

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

  const toggleFieldDropdown = (field) => {
    setIsStatusOpen(prev => (field === 'status' ? !prev : false));
    setIsPriorityOpen(prev => (field === 'priority' ? !prev : false));
    setIsCompletedOpen(prev => (field === 'completed' ? !prev : false));
    setIsCreatedOpen(prev => (field === 'created' ? !prev : false));
  };

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

  const [completedMonth, setCompletedMonth] = useState(() => new Date().getMonth());
  const [completedYear, setCompletedYear] = useState(() => new Date().getFullYear());
  const [createdMonth, setCreatedMonth] = useState(() => new Date().getMonth());
  const [createdYear, setCreatedYear] = useState(() => new Date().getFullYear());
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
  const completedDateStateClass = isCompletedOverdue
    ? 'task-detail-date-chip-overdue'
    : isCompletedDueToday
      ? 'task-detail-date-chip-due-today'
      : '';
  const detailTaskDisplayId = localTask.displayId || task.displayId || localTask.id || task.id;
  const detailTaskSprintName = localTask.sprint || task.sprint || 'Development';


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
    <div
      key={comment.id}
      className="task-detail-comment-thread flex flex-col gap-3 relative"
      style={{ '--task-detail-comment-indent': `${level * 36}px` }}
    >
      <div className="flex gap-3">
        <div
          className="comment-avatar shrink-0 flex items-center justify-center"
        >
          {comment.author.split(' ').map(n => n ? n[0] : '').join('').toUpperCase().substring(0, 2)}
        </div>
        <div className="flex-1">
          <div className="comment-header flex items-center gap-2">
            <span className="comment-author">{comment.author}</span>
            <span className="comment-date">{comment.date}</span>
          </div>
          <p className="comment-body" dangerouslySetInnerHTML={{ __html: comment.text }} />
          {canEditTaskContent && (
          <div className="comment-actions flex gap-4">
            <button
              className="comment-action-btn hover:text-[#4C2B74]"
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
                  className="comment-action-btn hover:text-[#4C2B74]"
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
                  className="comment-action-btn comment-action-btn-danger hover:text-[#B91C1C]"
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
        <div className="comment-editor-offset flex flex-col gap-3">
          <div className="comment-context-label">Replying to {comment.author}</div>
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
              className="comment-submit-btn hover:opacity-90 active:scale-[0.97] transition-all"
            >
              Comment
            </button>
            <button
              onClick={() => {
                setIsCommentEditing(false);
                setTempComment('');
                setReplyToCommentId(null);
              }}
              className="comment-cancel-btn hover:bg-[#EBECF0] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {canEditTaskContent && editCommentId === comment.id && (
        <div className="comment-editor-offset flex flex-col gap-3">
          <div className="comment-context-label">Editing comment</div>
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
              className="comment-submit-btn hover:opacity-90 active:scale-[0.97] transition-all"
            >
              Comment
            </button>
            <button
              onClick={() => {
                setIsCommentEditing(false);
                setTempComment('');
                setEditCommentId(null);
              }}
              className="comment-cancel-btn hover:bg-[#EBECF0] transition-colors"
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

  const getHistoryUserKey = (entry, field) => {
    const user = getHistoryUser(entry, field);
    return (
      entry[`${field}_id`] ||
      (typeof user === 'object' && user ? (user.user_id || user.id || user.email) : '') ||
      getUserDisplayName(user, '')
    );
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
      className="task-detail-history-avatar"
      style={{
        '--history-avatar-size': `${size}px`,
        '--history-avatar-font-size': `${fontSize}px`,
        '--history-avatar-bg': profile.color,
        '--history-avatar-color': profile.textColor || '#fff',
      }}
    >
      {profile.avatarUrl ? (
        <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
      ) : (
        profile.initials
      )}
    </div>
  );

  const buildHistoryPerson = (entry, field) => {
    const user = getHistoryUser(entry, field);
    const name = getUserDisplayName(user, '');
    const key = getHistoryUserKey(entry, field);
    if (!key && !name) return null;
    const displayName = name || key;
    if (!displayName || displayName === 'Unassigned') return null;
    return {
      key: key || displayName,
      name: displayName,
      user,
      profile: getHistoryProfile(user, displayName),
    };
  };

  const buildAssignmentTimeline = (history) => {
    const assigned = new Map();
    const chronological = [...history].sort((a, b) => new Date(a.changed_at || 0) - new Date(b.changed_at || 0));

    return chronological.map(entry => {
      const changeType = getHistoryChangeType(entry);
      const previousPerson = buildHistoryPerson(entry, 'previous_assignee');
      const nextPerson = buildHistoryPerson(entry, 'new_assignee');

      if ((changeType === 'removed' || changeType === 'reassigned') && previousPerson && !assigned.has(previousPerson.key)) {
        assigned.set(previousPerson.key, previousPerson);
      }

      const beforeAssignees = Array.from(assigned.values());

      if (changeType === 'removed') {
        if (previousPerson) assigned.delete(previousPerson.key);
      } else if (changeType === 'reassigned') {
        if (previousPerson) assigned.delete(previousPerson.key);
        if (nextPerson) assigned.set(nextPerson.key, nextPerson);
      } else if (changeType === 'assigned') {
        if (nextPerson) assigned.set(nextPerson.key, nextPerson);
      }

      return {
        ...entry,
        _changeType: changeType,
        _beforeAssignees: beforeAssignees,
        _afterAssignees: Array.from(assigned.values()),
      };
    }).sort((a, b) => new Date(b.changed_at || 0) - new Date(a.changed_at || 0));
  };

  const renderHistoryAssigneeList = (people) => {
    if (!people.length) {
      const profile = getAssigneeProfile('Unassigned');
      return (
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-[#F4F5F7] px-2 py-1 text-[11px] font-semibold text-[#5E6C84]">
          {renderHistoryAvatar(profile, 18, 7)}
          Unassigned
        </span>
      );
    }

    return (
      <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
        {people.map(person => (
          <span
            key={person.key}
            className="inline-flex max-w-[180px] items-center gap-1.5 rounded-md bg-[#F4F5F7] px-2 py-1 text-[11px] font-semibold text-[#172B4D]"
            title={person.name}
          >
            {renderHistoryAvatar(person.profile, 18, 7)}
            <span className="truncate">{person.name}</span>
          </span>
        ))}
      </span>
    );
  };

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

  const getHistoryActionClass = (changeType) => {
    if (changeType === 'assigned') return 'task-detail-history-action-assigned';
    if (changeType === 'removed') return 'task-detail-history-action-removed';
    return 'task-detail-history-action-changed';
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
      return;
    }

    try {
      await onAddAssignee?.(localTask.id, selectedUser);
    } catch {
      return;
    }

    setIsAssigneeOpen(true);
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
      className="task-detail-overlay fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="task-detail-dialog bg-white flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ─── Header ─── */}
        <div
          className="task-detail-header flex justify-between items-center shrink-0"
        >
          <div className="flex items-center gap-2">
            <span className="task-detail-icon material-symbols-outlined ">task_alt</span>
            <span className="task-detail-key">
              {detailTaskDisplayId} / {detailTaskSprintName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* share and more icons removed per UX request */}
            <button className="flex items-center justify-center p-1.5 rounded hover:bg-[#EBECF0] transition-colors" onClick={onClose} title="Close">
              <span className="task-detail-close-icon material-symbols-outlined">close</span>
            </button>
          </div>
        </div>


        {/* ─── Body ─── */}
        <div className="flex flex-1 overflow-hidden">


          {/* ── Left: Main Details ── */}
          <main
            className="task-detail-main flex-1 overflow-y-auto custom-scrollbar"
          >
            {/* Title */}
            {!isTitleEditing ? (
              <h1
                onClick={() => { if (canEditTaskContent) setIsTitleEditing(true); }}
                className={`task-detail-title rounded transition-colors ${canEditTaskContent ? 'hover:bg-[#F4F5F7] cursor-pointer' : ''}`}
              >
                {localTask.title}
              </h1>
            ) : (
              <div className="task-detail-section-tight">
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
                  className="task-detail-title-input"
                />
              </div>
            )}


            {/* Action Buttons */}
            <div className="task-detail-section flex gap-2">
              {/* Attach button removed as requested */}
            </div>


            {/* Description */}
            <div className="task-detail-section">
              <h3 className="task-detail-section-label task-detail-section-heading">
                Description
              </h3>


              {!isDescriptionEditing ? (
                <div
                  className={`task-detail-description-box group ${canEditTaskContent ? 'cursor-text hover:bg-[#F4F5F7]' : 'cursor-default'}`}
                  onClick={() => { if (canEditTaskContent) setIsDescriptionEditing(true); }}
                >
                  {localTask.description ? (
                    <div
                      className="task-detail-rich-copy"
                      dangerouslySetInnerHTML={{ __html: localTask.description }}
                    />
                  ) : (
                    <span className="task-detail-placeholder">Add a description...</span>
                  )}
                  {canEditTaskContent && (
                    <div className="task-detail-edit-hint hidden group-hover:block">
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
                      className="task-detail-primary-btn hover:opacity-90 transition-all"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setTempDescription(localTask.description || '');
                        setIsDescriptionEditing(false);
                      }}
                      className="task-detail-secondary-btn hover:bg-[#EBECF0] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>


            {/* Attachments */}
            <div className="task-detail-section">
              <div className="task-detail-section-tight flex items-center">
                <h3 className="task-detail-section-label">
                  Attachments ({attachments.length})
                </h3>
                {isLoadingAttachments && (
                  <span className="task-detail-loading-inline">Loading...</span>
                )}
                <input
                  type="file"
                  ref={uploadInputRef}
                  onChange={handleFileUpload}
                  className="hidden-file-input"
                  accept=".pdf,.zip,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                  multiple
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="attachment-card attachment-card-comfortable flex items-center gap-3 group cursor-pointer hover:bg-[#F4F5F7] transition-colors"
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
                        className="attachment-preview"
                      />
                    ) : (
                      <div
                        className="attachment-file-icon flex items-center justify-center shrink-0"
                        style={{ '--attachment-icon-bg': file.bg, '--attachment-icon-color': file.color }}
                      >
                        <span className="attachment-file-symbol material-symbols-outlined">{file.icon}</span>
                      </div>
                    )}
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <span className="attachment-name truncate">{file.name}</span>
                      <span className="attachment-meta">{file.size} • {file.date}</span>
                    </div>
                    <div className="attachment-actions attachment-actions-comfortable">
                      {canEditTaskContent && isAttachmentOwner(file) && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); triggerReplace(file.id); }}
                            title="Replace"
                            className="attachment-action-btn opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <span className="attachment-action-icon material-symbols-outlined">edit</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteAttachment(file.id); }}
                            title="Delete"
                            className="attachment-action-btn attachment-action-btn-danger opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </>
                      )}
                      {file.previewUrl || file.url ? (
                        <button
                          onClick={(e) => downloadAttachment(file, e)}
                          title="Download"
                          className="attachment-action-btn attachment-action-btn-neutral opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <span className="attachment-action-icon material-symbols-outlined">download</span>
                        </button>
                      ) : (
                        <span className="attachment-action-icon attachment-action-btn-neutral material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">download</span>
                      )}
                    </div>
                  </div>
                ))}
                <input type="file" ref={replaceInputRef} onChange={handleReplaceFile} className="hidden-file-input" />
              </div>
              {attachmentError && (
                <div className="rte-upload-error">
                  {attachmentError}
                </div>
              )}
              {canEditTaskContent && (
                <div
                  className="upload-dropzone mt-4 p-5 rounded-2xl border border-dashed border-[#DFE1E6] bg-[#FAFBFC] hover:bg-[#F4F5F7] transition-colors"
                  onClick={openUploadDialog}
                >
                  <div
                    className="upload-dropzone-icon flex items-center justify-center"
                  >
                    <span className="upload-dropzone-symbol material-symbols-outlined">cloud_upload</span>
                  </div>
                  <div className="upload-dropzone-copy">
                    <div className="upload-dropzone-title">Click to upload or drag and drop</div>
                    <div className="upload-dropzone-subtitle">PDF, ZIP, images, or Office files up to 20MB</div>
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
                  className="task-detail-preview-panel bg-white rounded-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="task-detail-preview-toolbar">
                    <button
                      onClick={() => setPreviewZoom(prev => Math.max(0.5, prev - 0.25))}
                      className="preview-toolbar-btn"
                      title="Zoom out"
                    >
                      −
                    </button>
                    <button
                      onClick={() => setPreviewZoom(prev => Math.min(2, prev + 0.25))}
                      className="preview-toolbar-btn"
                      title="Zoom in"
                    >
                      +
                    </button>
                    <button
                      onClick={() => {
                        setPreviewAttachment(null);
                        setPreviewZoom(1);
                      }}
                      className="preview-close-btn"
                      title="Close"
                    >
                      ×
                    </button>
                  </div>
                  <div className="preview-meta flex items-center justify-between mb-3">
                    <div>
                      <div className="preview-title">{previewAttachment.name}</div>
                      <div className="preview-size">{previewAttachment.size}</div>
                    </div>
                  </div>
                  <div className="preview-stage flex items-center justify-center">
                    <div className="preview-stage-inner">
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
                        className="task-detail-preview-image"
                        style={{ '--task-detail-preview-width': baseWidth ? `${Math.max(40, Math.min(baseWidth * previewZoom, baseMax.w * 4))}px` : 'auto' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* ── Activity Tabs ── */}
            <div>
              <div className="task-detail-tabs flex items-center gap-6">
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`task-detail-tab ${activeTab === 'comments' ? 'task-detail-tab-active' : ''}`}
                >
                  Comments
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`task-detail-tab ${activeTab === 'history' ? 'task-detail-tab-active' : ''}`}
                >
                  Assign History
                </button>
              </div>


              {/* Comments View */}
              {activeTab === 'comments' && (
                <div className="task-detail-stack">
                  {commentError && (
                    <div className="task-detail-danger-text">
                      {commentError}
                    </div>
                  )}
                  {/* Comment Editor */}
                  {!replyToCommentId && !editCommentId && (
                    <div className="flex flex-col gap-3 pt-2">
                      {!isCommentEditing ? (
                        <div
                          className="task-detail-comment-placeholder flex-1 cursor-text hover:bg-[#F4F5F7] transition-colors"
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
                              className="task-detail-primary-btn task-detail-comment-btn hover:opacity-90 active:scale-[0.97] transition-all"
                            >
                              Comment
                            </button>
                            <button
                              onClick={() => {
                                setIsCommentEditing(false);
                                setTempComment('');
                                setReplyToCommentId(null);
                              }}
                              className="task-detail-secondary-btn task-detail-comment-btn hover:bg-[#EBECF0] transition-colors"
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
                      <div className="task-detail-muted-text">Loading comments...</div>
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
                    <div className="task-detail-muted-text task-detail-empty-state">No assignment changes yet.</div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {buildAssignmentTimeline(assignHistory).map(entry => {
                        const changedByName = getChangedByName(entry);
                        const changeType = entry._changeType || getHistoryChangeType(entry);
                        const actionText = changeType === 'assigned'
                          ? 'assigned'
                          : changeType === 'removed'
                            ? 'removed'
                            : 'changed';
                        const changedByProfile = getHistoryProfile(entry.changed_by_user || entry.changed_by_name || entry.changed_by, changedByName);
                        return (
                          <div key={entry.assignment_history_id || entry.id} className="task-detail-history-row">
                            <div className="flex items-start gap-3">
                              {renderHistoryAvatar(changedByProfile, 32, 11)}
                              <div className="task-detail-history-content">
                                <div className="task-detail-history-head">
                                  <div className="task-detail-history-copy">
                                    <span className="task-detail-history-name">{changedByName}</span>
                                    <span className={`task-detail-history-action ${getHistoryActionClass(changeType)}`}>{actionText}</span>
                                    <span className="task-detail-history-muted">from</span>
                                    {renderHistoryAssigneeList(entry._beforeAssignees || [])}
                                    <span className="task-detail-history-muted">to</span>
                                    {renderHistoryAssigneeList(entry._afterAssignees || [])}
                                  </div>
                                  <span className="task-detail-history-time">{formatHistoryTime(entry.changed_at)}</span>
                                </div>
                                <div className="task-detail-history-meta">
                                  <span className="task-detail-history-reason">{entry.reason || 'Assignment updated'}</span>
                                  {entry.change_status && (
                                    <span className="task-detail-history-status">
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
            className="task-detail-sidebar overflow-y-auto custom-scrollbar shrink-0"
          >
            {/* Sidebar Header */}
            <h2 className="task-detail-sidebar-title">
              DETAIL TASK
            </h2>


            <div className="task-detail-sidebar-card">


              {/* ── Assignee ── */}
              <div className="task-detail-field">
                <label className="task-detail-section-label task-detail-label-block">
                  Assignee
                </label>
                <div
                  className="relative"
                  onMouseEnter={() => { if (canManageAdminFields) setIsAssigneeOpen(true); }}
                  onMouseLeave={() => { if (canManageAdminFields) setIsAssigneeOpen(false); }}
                >
                  {(() => {
                    const profile = getAssigneeProfile(localTask.assignee);
                    const assigneeListHeightClass = localAssignedUsers.length <= 1
                      ? 'min-h-[44px] max-h-[44px]'
                      : localAssignedUsers.length === 2
                        ? 'min-h-[82px] max-h-[82px]'
                        : 'min-h-[108px] max-h-[108px]';
                    return (
                      <>
                        <div
                          className={`flex w-full items-start overflow-y-auto overscroll-contain rounded-none bg-white px-3 py-2 text-left custom-scrollbar ${assigneeListHeightClass} ${canManageAdminFields ? 'hover:bg-[#F4F5F7]' : ''}`}
                        >
                          {localAssignedUsers.length > 0 ? (
                            <div className="flex w-full flex-col gap-1 pr-1">
                              {localAssignedUsers.map(user => {
                                const userId = user.user_id || user.id;
                                return (
                                  <span
                                    key={userId || user.name}
                                    className="group/avatar flex h-9 w-full items-center gap-2 rounded-md bg-[#F4F5F7] px-2"
                                  >
                                    <span
                                      className="avatar-surface flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold"
                                      style={{ '--avatar-bg': user.color || '#9CA3AF', '--avatar-color': user.textColor || '#FFFFFF' }}
                                    >
                                      {(user.avatarUrl || user.avatar_url) ? (
                                        <img src={user.avatarUrl || user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
                                      ) : (
                                        user.initials || getInitials(user.name)
                                      )}
                                    </span>
                                    <span className="task-detail-priority-copy min-w-0 flex-1 truncate">{user.name}</span>
                                    {canManageAdminFields && userId && (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleRemoveAssignee(userId);
                                        }}
                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold leading-none text-slate-500 opacity-70 shadow-sm hover:bg-slate-200 group-hover/avatar:opacity-100"
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
                            <div className="flex h-full items-center gap-2">
                              <div
                                className="avatar-surface h-7 w-7 shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold"
                                style={{ '--avatar-bg': profile.color, '--avatar-color': profile.textColor || '#FFFFFF' }}
                              >
                                {profile.initials}
                              </div>
                              <span className="task-detail-priority-copy">Unassigned</span>
                            </div>
                          )}
                        </div>
                        <div className={`absolute left-0 top-full z-50 mt-2 max-h-[236px] w-full overflow-y-auto overscroll-contain rounded-none border border-outline-variant bg-white shadow-2xl transition-all duration-150 custom-scrollbar ${isAssigneeOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                          {availableAssignees.map(user => {
                            const userId = user.user_id || user.id || '';
                            const isAssigned = userId && localAssignedUsers.some(assigned => (assigned.user_id || assigned.id) === userId);
                            return (
                            <button
                              key={userId || user.name}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (canManageAdminFields) handleAssigneeChange(user);
                              }}
                              disabled={Boolean(isAssigned)}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-left text-[12px] transition-colors ${isAssigned ? 'bg-gray-50 text-gray-400 cursor-default' : canManageAdminFields ? 'hover:bg-[#EBF0FF]' : ''}`}
                            >
                              <div
                                className="avatar-surface w-7 h-7 rounded-full flex items-center justify-center overflow-hidden text-[10px] font-bold"
                                style={{ '--avatar-bg': user.color, '--avatar-color': user.textColor || '#111' }}
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
              <div className="task-detail-field">
                <label className="task-detail-section-label task-detail-label-block">
                  Status
                </label>
                <div className="relative">
                  <div
                    className={`status-custom-trigger task-detail-field-trigger task-detail-status-trigger ${canEditTaskContent ? '' : 'cursor-default opacity-90'}`}
                    onClick={() => { if (canEditTaskContent) toggleFieldDropdown('status'); }}
                  >
                    <span className={`status-badge-pill ${(localTask?.status || '') === 'Need Revision' ? 'badge-revision' :
                      (localTask?.status || '') === 'Done' ? 'badge-done' :
                        ((localTask?.status || '') === 'Cancelled' || (localTask?.status || '') === 'New') ? 'badge-neutral' :
                          'badge-progress'
                      }`} >
                      {(localTask?.status || 'IN PROGRESS').toUpperCase()}
                    </span>
                    <span className="task-detail-chevron material-symbols-outlined">expand_more</span>
                  </div>


                  {isStatusOpen && canEditTaskContent && (
                    <div className="status-custom-dropdown task-detail-dropdown-full">
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
                            } task-detail-select-badge-sm`}>
                            {s.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>


              {/* ── Priority ── */}
              <div className="task-detail-field">
                <label className="task-detail-section-label task-detail-label-block">
                  Priority
                </label>
                <div className="relative">
                  <div
                    className={`priority-custom-trigger task-detail-field-trigger task-detail-priority-trigger ${canManageAdminFields ? '' : 'cursor-default opacity-90'}`}
                    onClick={() => { if (canManageAdminFields) toggleFieldDropdown('priority'); }}
                  >
                    <div className="flex items-center gap-2">
                      {localTask.priority === 'High' ? (
                        <span className="task-detail-priority-icon task-detail-priority-high material-symbols-outlined">keyboard_arrow_up</span>
                      ) : localTask.priority === 'Medium' ? (
                        <span className="task-detail-priority-icon task-detail-priority-medium">=</span>
                      ) : (
                        <span className="task-detail-priority-icon task-detail-priority-low material-symbols-outlined">keyboard_arrow_down</span>
                      )}
                      <span className="task-detail-priority-copy">{localTask?.priority || 'Medium'}</span>
                    </div>
                    <span className="task-detail-chevron material-symbols-outlined">expand_more</span>
                  </div>


                  {isPriorityOpen && canManageAdminFields && (
                    <div className="priority-custom-dropdown task-detail-dropdown-full">
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
                            <span className={`task-detail-priority-icon ${getPriorityIconClass(p.label)}`}>{p.icon}</span>
                          ) : (
                            <span className={`task-detail-priority-icon ${getPriorityIconClass(p.label)} material-symbols-outlined`}>{p.icon}</span>
                          )}
                          <span className="task-detail-priority-copy">{p.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>


              {/* Divider */}
              <div className="task-detail-divider"></div>


              {/* ── Story Points ── */}
              <div className="task-detail-section-tight flex justify-between items-center group cursor-pointer">
                <span className="task-detail-section-label">Story Points</span>
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
                    className={`story-points-input ${canManageAdminFields ? 'story-points-input-editable' : 'story-points-input-readonly'}`}
                    readOnly={!canManageAdminFields}
                  />
                </div>
              </div>


              {/* ── Sprint ── */}
              <div className="task-detail-section-tight flex justify-between items-center">
                <span className="task-detail-section-label">Sprint</span>
                <div className="task-detail-sprint-value flex items-center gap-1.5">
                  <span className="task-detail-sprint-icon material-symbols-outlined">sprint</span>
                  {task.sprint || 'SCRUM Sprint 1'}
                </div>
              </div>


              {/* ── Due Date ── */}
              <div className="task-detail-section-tight flex justify-between items-center">
                <span className="task-detail-section-label">Completed</span>
                <div className="relative">
                  <div
                    className={`task-detail-date-chip ${completedDateStateClass} flex items-center gap-1.5 ${canManageAdminFields ? 'cursor-pointer hover:bg-[#F4F5F7]' : ''} rounded px-2 py-1 transition-colors`}
                    onClick={() => { if (canManageAdminFields) toggleFieldDropdown('completed'); }}
                  >
                    <span className="task-detail-date-icon material-symbols-outlined">calendar_today</span>
                    {completedDateLabel}
                  </div>


                  {isCompletedOpen && canManageAdminFields && (
                    <div className="calendar-dropdown-container task-detail-calendar-dropdown">
                      <div className="calendar-header flex items-center justify-between mb-4">
                        <div className="flex gap-2">
                          <span
                            onClick={(e) => { e.stopPropagation(); setCompletedYear(y => y - 1); }}
                            className="task-detail-calendar-nav material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
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
                            className="task-detail-calendar-nav material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
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
                            className="task-detail-calendar-nav material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
                          >
                            chevron_right
                          </span>
                          <span
                            onClick={(e) => { e.stopPropagation(); setCompletedYear(y => y + 1); }}
                            className="task-detail-calendar-nav material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
                          >
                            keyboard_double_arrow_right
                          </span>
                        </div>
                      </div>
                      <div className="calendar-body">
                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <span key={d} className="task-detail-calendar-weekday">{d}</span>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {getDaysInMonth(completedYear, completedMonth).map((day, i) => {
                            if (day === null) return <div key={`empty-${i}`} className="task-detail-calendar-empty" />;
                            // Check if current day is selected
                            const selectedCompletedDate = getCompletedDateValue(localTask);
                            const isSelected = selectedCompletedDate && (() => {
                              const d = new Date(selectedCompletedDate);
                              return !isNaN(d.getTime()) &&
                                d.getDate() === day &&
                                d.getMonth() === completedMonth &&
                                d.getFullYear() === completedYear;
                            })();
                            const today = new Date();
                            const isToday = day === today.getDate() &&
                              completedMonth === today.getMonth() &&
                              completedYear === today.getFullYear();
                            return (
                              <div
                                key={i}
                                className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'task-detail-calendar-day-selected' : 'task-detail-calendar-day-unselected'}`}
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
              <div className="task-detail-divider task-detail-divider-tight"></div>


              {/* ── Timeline ── */}
              <div>
                <span className="task-detail-section-label block mb-3">
                  Timeline
                </span>
                <div className="flex flex-col gap-3.5">
                  <div className="flex justify-between items-center relative">
                    <span className="task-detail-section-label">Created</span>
                    <span
                      className={`task-detail-timeline-date transition-colors ${canManageAdminFields ? 'cursor-pointer hover:text-[#4C2B74]' : 'opacity-80 cursor-default'}`}
                      onClick={() => { if (canManageAdminFields) toggleFieldDropdown('created'); }}
                    >
                      {localTask.createdAt || 'Jun 20, 2026'}
                    </span>


                    {isCreatedOpen && canManageAdminFields && (
                      <div className="calendar-dropdown-container task-detail-calendar-dropdown task-detail-calendar-dropdown-raised">
                        <div className="calendar-header flex items-center justify-between mb-4">
                          <div className="flex gap-2">
                            <span
                              onClick={(e) => { e.stopPropagation(); setCreatedYear(y => y - 1); }}
                              className="task-detail-calendar-nav material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
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
                              className="task-detail-calendar-nav material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
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
                              className="task-detail-calendar-nav material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
                            >
                              chevron_right
                            </span>
                            <span
                              onClick={(e) => { e.stopPropagation(); setCreatedYear(y => y + 1); }}
                              className="task-detail-calendar-nav material-symbols-outlined cursor-pointer hover:text-[#4C2B74]"
                            >
                              keyboard_double_arrow_right
                            </span>
                          </div>
                        </div>
                        <div className="calendar-body">
                          <div className="grid grid-cols-7 gap-1 text-center mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                              <span key={d} className="task-detail-calendar-weekday">{d}</span>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {getDaysInMonth(createdYear, createdMonth).map((day, i) => {
                              if (day === null) return <div key={`empty-${i}`} className="task-detail-calendar-empty" />;
                              const isSelected = localTask.createdAt && (() => {
                                const d = new Date(localTask.createdAt);
                                return !isNaN(d.getTime()) &&
                                  d.getDate() === day &&
                                  d.getMonth() === createdMonth &&
                                  d.getFullYear() === createdYear;
                              })();
                              const today = new Date();
                              const isToday = day === today.getDate() &&
                                createdMonth === today.getMonth() &&
                                createdYear === today.getFullYear();
                              return (
                                <div
                                  key={i}
                                  className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'task-detail-calendar-day-selected' : 'task-detail-calendar-day-unselected'}`}
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
                    <span className="task-detail-section-label">Updated</span>
                    <span className="task-detail-timeline-date task-detail-timeline-date-end">{formatTimelineDateTime(localTask?.updated_at)}</span>
                  </div>


                  <div className="task-detail-creator-row flex justify-between items-center">
                    <span className="task-detail-section-label">Creator</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="task-detail-creator-avatar flex items-center justify-center"
                      >
                        {getInitials(localTask?.creator || 'Peter Tan')}
                      </div>
                      <span className="task-detail-timeline-date">{localTask?.creator || 'Peter Tan'}</span>
                    </div>
                  </div>
                </div>
              </div>


            </div>
          </aside>
        </div>
      </div>
      {deleteConfirmCommentId && (
        <div className="task-detail-delete-overlay fixed inset-0 z-[11000] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <div className="delete-dialog-panel bg-white rounded-2xl shadow-2xl border border-[#DFE1E6]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setDeleteConfirmCommentId(null)}
              className="delete-dialog-close hover:bg-[#E6E9EF] transition-colors"
              aria-label="Close delete confirmation"
            >
              <span className="delete-dialog-close-icon material-symbols-outlined">close</span>
            </button>
            <div className="delete-dialog-body flex items-start gap-3">
              <div className="delete-dialog-icon-wrap">
                <span className="delete-dialog-icon material-symbols-outlined">warning</span>
              </div>
              <div>
                <h3 className="delete-dialog-title">Delete this comment?</h3>
                <p className="delete-dialog-copy">Once you delete it, it&apos;s gone for good.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmCommentId(null)}
                className="delete-dialog-cancel hover:bg-[#F4F5F7] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const deleted = await removeComment(deleteConfirmCommentId);
                  if (deleted) setDeleteConfirmCommentId(null);
                }}
                className="delete-dialog-confirm hover:opacity-90 transition-all"
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
