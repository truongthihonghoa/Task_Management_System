import React, { useRef, useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import '../../styles/RichTextEditor.css';


// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────
const TEXT_COLORS = [
  { label: 'Default', value: '#172B4D' },
  { label: 'Red',     value: '#DE350B' },
  { label: 'Orange',  value: '#FF8B00' },
  { label: 'Yellow',  value: '#FF991F' },
  { label: 'Green',   value: '#00875A' },
  { label: 'Blue',    value: '#0052CC' },
  { label: 'Purple',  value: '#6554C0' },
  { label: 'Gray',    value: '#6B778C' },
];


const EMOJIS = [
  '😀','😂','😍','🤔','👍','👎','🎉','🔥',
  '✅','❌','⚠️','💡','📌','📎','🗂️','💬',
  '🛠️','🚀','📅','🔗','📝','💯','⭐','🏆',
];


const MENTION_USERS = [
  { id: 1, name: 'Alex Morgan',   avatar: 'AM', color: '#4C2B74' },
  { id: 2, name: 'Sarah Johnson', avatar: 'SJ', color: '#0052CC' },
  { id: 3, name: 'David Chen',    avatar: 'DC', color: '#00875A' },
  { id: 4, name: 'Emma Wilson',   avatar: 'EW', color: '#FF8B00' },
  { id: 5, name: 'Michael Brown', avatar: 'MB', color: '#DE350B' },
];


const HEADING_OPTIONS = [
  { label: 'Normal text', tag: 'p',  fontSize: '14px', fontWeight: '400' },
  { label: 'Heading 1',   tag: 'h1', fontSize: '22px', fontWeight: '700' },
  { label: 'Heading 2',   tag: 'h2', fontSize: '18px', fontWeight: '700' },
  { label: 'Heading 3',   tag: 'h3', fontSize: '15px', fontWeight: '700' },
];


// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function saveSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) return sel.getRangeAt(0).cloneRange();
  return null;
}


function restoreSelection(range) {
  if (!range) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function escapeHtmlAttribute(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getTaskDisplayId(task = {}) {
  return task.displayId || task.taskId || task.id || '';
}

/**
 * Compute portal position (fixed) from a trigger element.
 * Returns { top, left } placing the panel below the trigger.
 * If panel would overflow viewport bottom, flip it above.
 */
function getPortalPos(triggerEl, panelHeight = 200, panelWidth = 180) {
  if (!triggerEl) return { top: 0, left: 0 };
  const rect = triggerEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;


  let top  = rect.bottom + 6;
  let left = rect.left;


  // Flip above if not enough space below
  if (top + panelHeight > vh - 16) {
    top = rect.top - panelHeight - 6;
  }
  // Keep within right edge
  if (left + panelWidth > vw - 8) {
    left = vw - panelWidth - 8;
  }
  if (left < 8) left = 8;


  return { top, left };
}


// ─────────────────────────────────────────────
// Portal Dropdown — renders into document.body
// ─────────────────────────────────────────────
function PortalDropdown({ triggerRef, children, className = '', panelHeight, panelWidth, onClose }) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const panelRef = useRef(null);


  useEffect(() => {
    setPos(getPortalPos(triggerRef?.current, panelHeight, panelWidth));
  }, [triggerRef, panelHeight, panelWidth]);


  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        triggerRef?.current && !triggerRef.current.contains(e.target)
      ) {
        onClose?.();
      }
    };
    // Use setTimeout so the click that opened the dropdown doesn't immediately close it
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [triggerRef, onClose]);


  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      className={`rte-dropdown-panel ${className}`}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 99999 }}
    >
      {children}
    </div>,
    document.body
  );
}


// ─────────────────────────────────────────────
// Portal Dialog (Link / Image)
// ─────────────────────────────────────────────
function PortalDialog({ onClose, children }) {
  return ReactDOM.createPortal(
    <div className="rte-dialog-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rte-dialog" onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}


// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function RichTextEditor({ value, onChange, placeholder, tasks = [], onUploadFile, uploadUsage = 'attachment' }) {
  const editorRef     = useRef(null);
  const savedRangeRef = useRef(null);
  const rootRef       = useRef(null);


  // Trigger button refs (for portal positioning)
  const headingBtnRef = useRef(null);
  const colorBtnRef   = useRef(null);
  const listBtnRef    = useRef(null);
  const emojiBtnRef   = useRef(null);
  const plusBtnRef    = useRef(null);


  // Dropdown open states
  const [showHeading, setShowHeading] = useState(false);
  const [showColor,   setShowColor]   = useState(false);
  const [showList,    setShowList]    = useState(false);
  const [showEmoji,   setShowEmoji]   = useState(false);
  const [showPlus,    setShowPlus]    = useState(false);
  const [showLink,    setShowLink]    = useState(false);
  const [showImage,   setShowImage]   = useState(false);
  const [showMention, setShowMention] = useState(false);


  // Tool state
  const [linkUrl,        setLinkUrl]        = useState('');
  const [linkText,       setLinkText]       = useState('');
  const [linkSearch,     setLinkSearch]     = useState('');
  const [linkSelected,   setLinkSelected]   = useState(null);  // task object | null
  const [recentTasks,    setRecentTasks]    = useState([]);    // 5 most recently selected
  const [imageUrl,       setImageUrl]       = useState('');
  const [imageAlt,       setImageAlt]       = useState('');
  const [mentionQuery,   setMentionQuery]   = useState('');
  const [currentColor,   setCurrentColor]   = useState('#172B4D');
  const [activeFormats,  setActiveFormats]  = useState({ bold: false, italic: false, underline: false });


  // ── active format detection ─────────────────
  const updateActiveFormats = useCallback(() => {
    try {
      setActiveFormats({
        bold:      document.queryCommandState('bold'),
        italic:    document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      });
    } catch (_) {}
  }, []);


  // ── close all dropdowns ─────────────────────
  const closeAll = useCallback(() => {
    setShowHeading(false);
    setShowColor(false);
    setShowList(false);
    setShowEmoji(false);
    setShowPlus(false);
    setShowMention(false);
  }, []);


  // ── exec helpers ─────────────────────────────
  const exec = useCallback((cmd, val = null) => {
    editorRef.current?.focus();
    try { document.execCommand(cmd, false, val); } catch (_) {}
    notifyChange();
    updateActiveFormats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateActiveFormats]);


  const notifyChange = useCallback(() => {
    if (onChange && editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);


  // ── Format actions ───────────────────────────
  const applyBold      = () => exec('bold');
  const applyItalic    = () => exec('italic');
  const applyUnderline = () => exec('underline');


  const applyColor = (color) => {
    restoreSelection(savedRangeRef.current);
    exec('foreColor', color);
    setCurrentColor(color);
    setShowColor(false);
  };


  const applyHeading = (opt) => {
    exec('formatBlock', opt.tag);
    setShowHeading(false);
  };


  const applyBulletList   = () => { exec('insertUnorderedList'); setShowList(false); };
  const applyNumberedList = () => { exec('insertOrderedList');   setShowList(false); };


  // ── Link dialog ──────────────────────────────
  const openLinkDialog = () => {
    savedRangeRef.current = saveSelection();
    const sel = window.getSelection();
    setLinkText(sel?.toString() || '');
    setLinkUrl('');
    setLinkSearch('');
    setLinkSelected(null);
    // Seed recent tasks with first 5 tasks nếu chưa có
    if (recentTasks.length === 0 && tasks.length > 0) {
      setRecentTasks(tasks.slice(0, 5));
    }
    closeAll();
    setShowLink(true);
  };


  const insertLink = () => {
    if (!linkUrl && !linkSelected) return;
    restoreSelection(savedRangeRef.current);
    editorRef.current?.focus();


    let html;
    if (linkSelected) {
      // Liên kết nội bộ tới task
      const display = linkText || `[${getTaskDisplayId(linkSelected)}] ${linkSelected.title}`;
      html = `<a href="#task-${linkSelected.id}" class="rte-task-link" data-task-id="${linkSelected.id}" contenteditable="false">${display}</a>&nbsp;`;
      // Cập nhật danh sách task gần đây
      setRecentTasks(prev => {
        const filtered = prev.filter(t => t.id !== linkSelected.id);
        return [linkSelected, ...filtered].slice(0, 5);
      });
    } else {
      // Liên kết bên ngoài
      const display = linkText || linkUrl;
      html = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="rte-link">${display}</a>&nbsp;`;
    }


    try { document.execCommand('insertHTML', false, html); } catch (_) {}
    notifyChange();
    setShowLink(false);
  };


  // Select task from popup — insert immediately
  const handleSelectTaskLink = (task) => {
    // Insert directly without needing buttons
    restoreSelection(savedRangeRef.current);
    editorRef.current?.focus();
    const display = linkText || `[${getTaskDisplayId(task)}] ${task.title}`;
    const html = `<a href="#task-${task.id}" class="rte-task-link" data-task-id="${task.id}" contenteditable="false">${display}</a>&nbsp;`;
    try { document.execCommand('insertHTML', false, html); } catch (_) {}
    notifyChange();
    setRecentTasks(prev => {
      const filtered = prev.filter(t => t.id !== task.id);
      return [task, ...filtered].slice(0, 5);
    });
    setShowLink(false);
  };


  // ── Image dialog ─────────────────────────────
  const openImageDialog = () => {
    savedRangeRef.current = saveSelection();
    setImageUrl('');
    setImageAlt('');
    closeAll();
    setShowImage(true);
  };


  const insertImage = (customUrl = null, customAlt = null, options = {}) => {
    const finalUrl = customUrl || imageUrl;
    const finalAlt = customAlt || imageAlt;
    if (!finalUrl) return;
    restoreSelection(savedRangeRef.current);
    editorRef.current?.focus();
    const safeUrl = escapeHtmlAttribute(finalUrl);
    const safeLabel = escapeHtmlAttribute(finalAlt || 'file');
    const html = options.asLink
      ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="rte-link">${safeLabel}</a>&nbsp;`
      : `<img src="${safeUrl}" alt="${safeLabel || 'image'}" class="rte-image" />`;
    try { document.execCommand('insertHTML', false, html); } catch (_) {}
    notifyChange();
    setShowImage(false);
  };


  // ── Emoji ─────────────────────────────────────
  const insertEmoji = (emoji) => {
    editorRef.current?.focus();
    try { document.execCommand('insertText', false, emoji); } catch (_) {}
    notifyChange();
    setShowEmoji(false);
  };


  // ── @Mention ──────────────────────────────────
  const insertMention = (user) => {
    restoreSelection(savedRangeRef.current);
    editorRef.current?.focus();
    const html = `<span class="rte-mention" contenteditable="false" data-user-id="${user.id}" style="background:${user.color}22;color:${user.color}">@${user.name}</span>&nbsp;`;
    try { document.execCommand('insertHTML', false, html); } catch (_) {}
    notifyChange();
    setShowMention(false);
  };


  // ── Plus / Insert actions ─────────────────────
  const insertCodeBlock = () => {
    editorRef.current?.focus();
    const html = `<pre class="rte-code-block"><code>// code here</code></pre><p><br></p>`;
    try { document.execCommand('insertHTML', false, html); } catch (_) {}
    notifyChange();
    setShowPlus(false);
  };


  const insertTable = () => {
    editorRef.current?.focus();
    const html = `
      <table class="rte-table">
        <thead><tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr></thead>
        <tbody>
          <tr><td>Cell</td><td>Cell</td><td>Cell</td></tr>
          <tr><td>Cell</td><td>Cell</td><td>Cell</td></tr>
        </tbody>
      </table><p><br></p>`;
    try { document.execCommand('insertHTML', false, html); } catch (_) {}
    notifyChange();
    setShowPlus(false);
  };


  const insertPanel = (type) => {
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
    editorRef.current?.focus();
    const html = `<div class="rte-panel rte-panel-${type}"><span class="rte-panel-icon">${icons[type]}</span><div class="rte-panel-content"><p>Panel content here.</p></div></div><p><br></p>`;
    try { document.execCommand('insertHTML', false, html); } catch (_) {}
    notifyChange();
    setShowPlus(false);
  };


  const insertQuote = () => {
    editorRef.current?.focus();
    try { document.execCommand('formatBlock', false, 'blockquote'); } catch (_) {}
    notifyChange();
    setShowPlus(false);
  };


  // ── @ keyup handler ───────────────────────────
  const handleKeyUp = (e) => {
    if (e.key === '@') {
      savedRangeRef.current = saveSelection();
      setMentionQuery('');
      setShowMention(true);
    } else if (showMention) {
      const sel = window.getSelection();
      if (sel) {
        const text = sel.anchorNode?.textContent || '';
        const atIdx = text.lastIndexOf('@');
        if (atIdx !== -1) setMentionQuery(text.slice(atIdx + 1));
        else setShowMention(false);
      }
      if (e.key === 'Escape') setShowMention(false);
    }
    updateActiveFormats();
    notifyChange();
  };


  // ── Init with value ───────────────────────────
  useEffect(() => {
    if (editorRef.current && value !== undefined && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const filteredMentions = MENTION_USERS.filter(u =>
    u.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );


  // ── Toggle helpers ────────────────────────────
  const toggleHeading = () => {
    savedRangeRef.current = saveSelection();
    setShowHeading(v => !v);
    setShowColor(false); setShowList(false); setShowEmoji(false); setShowPlus(false);
  };
  const toggleColor = () => {
    savedRangeRef.current = saveSelection();
    setShowColor(v => !v);
    setShowHeading(false); setShowList(false); setShowEmoji(false); setShowPlus(false);
  };
  const toggleList = () => {
    setShowList(v => !v);
    setShowHeading(false); setShowColor(false); setShowEmoji(false); setShowPlus(false);
  };
  const toggleEmoji = () => {
    setShowEmoji(v => !v);
    setShowHeading(false); setShowColor(false); setShowList(false); setShowPlus(false);
  };
  const togglePlus = () => {
    setShowPlus(v => !v);
    setShowHeading(false); setShowColor(false); setShowList(false); setShowEmoji(false);
  };


  // ── Mention from toolbar button ───────────────
  const triggerMentionFromToolbar = () => {
    editorRef.current?.focus();
    try { document.execCommand('insertText', false, '@'); } catch (_) {}
    savedRangeRef.current = saveSelection();
    setMentionQuery('');
    closeAll();
    setShowMention(true);
  };


  return (
    <div ref={rootRef} className="rte-root description-container-fixed">


      {/* ══════════════ TOOLBAR ══════════════ */}
      <div className="description-toolbar-advanced rte-toolbar">


        {/* Tt – Heading */}
        <button
          ref={headingBtnRef}
          className="toolbar-btn-advanced rte-tt-btn"
          title="Text style"
          onMouseDown={(e) => { e.preventDefault(); toggleHeading(); }}
        >
          <span style={{ fontSize: 15, fontWeight: 600 }}>Tt</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2 }}>
            <path d="M2 4l3 3 3-3" stroke="#42526E" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>


        <div className="toolbar-divider" />


        {/* B / I / U */}
        <button
          className={`toolbar-btn-advanced rte-format-btn${activeFormats.bold ? ' rte-active' : ''}`}
          title="Bold (Ctrl+B)"
          onMouseDown={(e) => { e.preventDefault(); applyBold(); }}
        >
          <strong style={{ fontSize: 14 }}>B</strong>
        </button>


        <button
          className={`toolbar-btn-advanced rte-format-btn${activeFormats.italic ? ' rte-active' : ''}`}
          title="Italic (Ctrl+I)"
          onMouseDown={(e) => { e.preventDefault(); applyItalic(); }}
        >
          <em style={{ fontSize: 14, fontFamily: 'Georgia,serif' }}>I</em>
        </button>


        <button
          className={`toolbar-btn-advanced rte-format-btn${activeFormats.underline ? ' rte-active' : ''}`}
          title="Underline (Ctrl+U)"
          onMouseDown={(e) => { e.preventDefault(); applyUnderline(); }}
        >
          <span style={{ textDecoration: 'underline', fontSize: 14 }}>U</span>
        </button>


        <div className="toolbar-divider" />


        {/* A – Text color */}
        <button
          ref={colorBtnRef}
          className="toolbar-btn-advanced rte-color-btn"
          title="Text color"
          onMouseDown={(e) => { e.preventDefault(); toggleColor(); }}
        >
          <span className="rte-color-a-wrap">
            <span style={{ fontSize: 14, fontWeight: 700 }}>A</span>
            <span className="rte-color-bar" style={{ background: currentColor }} />
          </span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2 }}>
            <path d="M2 4l3 3 3-3" stroke="#42526E" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>


        <div className="toolbar-divider" />


        {/* List */}
        <button
          ref={listBtnRef}
          className="toolbar-btn-advanced"
          title="Lists"
          onMouseDown={(e) => { e.preventDefault(); toggleList(); }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 4h10M3 8h10M3 12h10M1 4h.01M1 8h.01M1 12h.01" stroke="#42526E" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 1 }}>
            <path d="M2 4l3 3 3-3" stroke="#42526E" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>


        <div className="toolbar-divider" />


        {/* Link */}
        <button className="toolbar-btn-advanced" title="Insert link" onClick={openLinkDialog}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6.5 9.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1" stroke="#42526E" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M9.5 6.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1" stroke="#42526E" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>


        {/* Image */}
        <button className="toolbar-btn-advanced" title="Insert image" onClick={openImageDialog}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="#42526E" strokeWidth="1.5"/>
            <circle cx="5.5" cy="6" r="1.25" stroke="#42526E" strokeWidth="1.25"/>
            <path d="M1.5 11.5l3.5-3.5 2.5 2.5 2-2 4 4" stroke="#42526E" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>


        {/* Emoji */}
        <button
          ref={emojiBtnRef}
          className="toolbar-btn-advanced"
          title="Insert emoji"
          onMouseDown={(e) => { e.preventDefault(); toggleEmoji(); }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="#42526E" strokeWidth="1.5"/>
            <circle cx="5.5" cy="6.5" r="1" fill="#42526E"/>
            <circle cx="10.5" cy="6.5" r="1" fill="#42526E"/>
            <path d="M5 9.5s1 2 3 2 3-2 3-2" stroke="#42526E" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>


        {/* @ Mention */}
        <button
          className="toolbar-btn-advanced rte-mention-trigger"
          title="Mention someone"
          onClick={triggerMentionFromToolbar}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: '#42526E' }}>@</span>
        </button>


        {/* + Insert menu */}
        <button
          ref={plusBtnRef}
          className="toolbar-btn-advanced"
          title="More options"
          onMouseDown={(e) => { e.preventDefault(); togglePlus(); }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="#42526E" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 1 }}>
            <path d="M2 4l3 3 3-3" stroke="#42526E" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>


      {/* ══════════════ EDITOR AREA ══════════════ */}
      <div className="rte-editor-wrap">
        <div
          ref={editorRef}
          className="rte-editor"
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder || 'Type @ to mention someone or use the toolbar above.'}
          onKeyUp={handleKeyUp}
          onMouseUp={updateActiveFormats}
          onInput={notifyChange}
          onFocus={updateActiveFormats}
        />
      </div>


      {/* ══════════════ PORTAL DROPDOWNS ══════════════ */}


      {/* Heading dropdown */}
      {showHeading && (
        <PortalDropdown
          triggerRef={headingBtnRef}
          panelHeight={160}
          panelWidth={160}
          onClose={() => setShowHeading(false)}
        >
          {HEADING_OPTIONS.map(opt => (
            <div
              key={opt.tag}
              className="rte-dropdown-item"
              style={{ fontSize: opt.fontSize, fontWeight: opt.fontWeight }}
              onMouseDown={(e) => { e.preventDefault(); applyHeading(opt); }}
            >
              {opt.label}
            </div>
          ))}
        </PortalDropdown>
      )}


      {/* Color dropdown */}
      {showColor && (
        <PortalDropdown
          triggerRef={colorBtnRef}
          panelHeight={110}
          panelWidth={160}
          className="rte-color-panel"
          onClose={() => setShowColor(false)}
        >
          <div className="rte-color-label">Text color</div>
          <div className="rte-color-grid">
            {TEXT_COLORS.map(c => (
              <button
                key={c.value}
                className="rte-color-swatch"
                title={c.label}
                style={{ background: c.value }}
                onMouseDown={(e) => { e.preventDefault(); applyColor(c.value); }}
              />
            ))}
          </div>
        </PortalDropdown>
      )}


      {/* List dropdown */}
      {showList && (
        <PortalDropdown
          triggerRef={listBtnRef}
          panelHeight={90}
          panelWidth={160}
          onClose={() => setShowList(false)}
        >
          <div className="rte-dropdown-item" onMouseDown={(e) => { e.preventDefault(); applyBulletList(); }}>
            <span className="rte-menu-icon">•</span> Bullet list
          </div>
          <div className="rte-dropdown-item" onMouseDown={(e) => { e.preventDefault(); applyNumberedList(); }}>
            <span className="rte-menu-icon">1.</span> Numbered list
          </div>
        </PortalDropdown>
      )}


      {/* Emoji picker */}
      {showEmoji && (
        <PortalDropdown
          triggerRef={emojiBtnRef}
          panelHeight={160}
          panelWidth={220}
          className="rte-emoji-panel"
          onClose={() => setShowEmoji(false)}
        >
          <div className="rte-emoji-grid">
            {EMOJIS.map(e => (
              <button
                key={e}
                className="rte-emoji-btn"
                onMouseDown={(ev) => { ev.preventDefault(); insertEmoji(e); }}
              >{e}</button>
            ))}
          </div>
        </PortalDropdown>
      )}


      {/* Plus / insert menu */}
      {showPlus && (
        <PortalDropdown
          triggerRef={plusBtnRef}
          panelHeight={280}
          panelWidth={190}
          className="rte-plus-panel"
          onClose={() => setShowPlus(false)}
        >
          <div className="rte-plus-section-title">Insert</div>
          <div className="rte-dropdown-item" onMouseDown={(e) => { e.preventDefault(); insertCodeBlock(); }}>
            <span className="rte-plus-icon">⌨</span> Code block
          </div>
          <div className="rte-dropdown-item" onMouseDown={(e) => { e.preventDefault(); insertTable(); }}>
            <span className="rte-plus-icon">⊞</span> Table
          </div>
          <div className="rte-dropdown-item" onMouseDown={(e) => { e.preventDefault(); insertQuote(); }}>
            <span className="rte-plus-icon">❝</span> Quote
          </div>
          <div className="rte-plus-section-title" style={{ marginTop: 4 }}>Panel</div>
          <div className="rte-dropdown-item" onMouseDown={(e) => { e.preventDefault(); insertPanel('info'); }}>
            <span className="rte-plus-icon">ℹ️</span> Info panel
          </div>
          <div className="rte-dropdown-item" onMouseDown={(e) => { e.preventDefault(); insertPanel('success'); }}>
            <span className="rte-plus-icon">✅</span> Success panel
          </div>
          <div className="rte-dropdown-item" onMouseDown={(e) => { e.preventDefault(); insertPanel('warning'); }}>
            <span className="rte-plus-icon">⚠️</span> Warning panel
          </div>
          <div className="rte-dropdown-item" onMouseDown={(e) => { e.preventDefault(); insertPanel('error'); }}>
            <span className="rte-plus-icon">❌</span> Error panel
          </div>
        </PortalDropdown>
      )}


      {/* @Mention suggestion — anchored at editor top-left via portal */}
      {showMention && (
        <MentionPortal
          editorRef={editorRef}
          filteredMentions={filteredMentions}
          onSelect={insertMention}
          onClose={() => setShowMention(false)}
        />
      )}


      {/* Link dialog nâng cấp */}
      {showLink && (
        <LinkDialog
          linkUrl={linkUrl}
          setLinkUrl={setLinkUrl}
          linkText={linkText}
          setLinkText={setLinkText}
          linkSearch={linkSearch}
          setLinkSearch={setLinkSearch}
          linkSelected={linkSelected}
          setLinkSelected={setLinkSelected}
          tasks={tasks}
          recentTasks={recentTasks}
          onSelectTask={handleSelectTaskLink}
          onInsert={insertLink}
          onClose={() => { setShowLink(false); setLinkSelected(null); }}
        />
      )}


      {/* Image dialog nâng cấp */}
      {showImage && (
        <ImageDialog
          imageUrl={imageUrl}
          setImageUrl={setImageUrl}
          imageAlt={imageAlt}
          setImageAlt={setImageAlt}
          onInsert={insertImage}
          onClose={() => setShowImage(false)}
          onUploadFile={onUploadFile}
          uploadUsage={uploadUsage}
        />
      )}
    </div>
  );
}


// ─────────────────────────────────────────────
// Mention Portal — appears above/near the cursor
// ─────────────────────────────────────────────
function MentionPortal({ editorRef, filteredMentions, onSelect, onClose }) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const panelRef = useRef(null);


  useEffect(() => {
    // Position near caret using Selection API
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0).cloneRange();
      range.collapse(true);
      const rect = range.getBoundingClientRect();
      if (rect.width !== 0 || rect.height !== 0) {
        setPos({ top: rect.top - 8, left: rect.left });
        return;
      }
    }
    // Fallback: position above editor
    if (editorRef.current) {
      const r = editorRef.current.getBoundingClientRect();
      setPos({ top: r.top - 8, left: r.left + 12 });
    }
  }, [editorRef]);


  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
  }, [onClose]);


  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      className="rte-mention-dropdown"
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 99999, transform: 'translateY(-100%)' }}
    >
      <div className="rte-mention-title">Mention</div>
      {filteredMentions.length === 0 && (
        <div className="rte-mention-empty">No users found</div>
      )}
      {filteredMentions.map(user => (
        <div
          key={user.id}
          className="rte-mention-item"
          onMouseDown={(e) => { e.preventDefault(); onSelect(user); }}
        >
          <span className="rte-mention-avatar" style={{ background: user.color }}>{user.avatar}</span>
          <span>{user.name}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}


// ─────────────────────────────────────────────
// LinkDialog — popup chèn link nâng cấp
// ─────────────────────────────────────────────
function LinkDialog({
  linkUrl, setLinkUrl,
  linkText, setLinkText,
  linkSearch, setLinkSearch,
  linkSelected, setLinkSelected,
  tasks, recentTasks,
  onSelectTask, onInsert, onClose,
}) {
  const searchLower = linkSearch.toLowerCase();


  // Lọc task theo từ khóa (ID, title, status)
  const filteredTasks = tasks.filter(t =>
    !linkSearch ||
    getTaskDisplayId(t).toLowerCase().includes(searchLower) ||
    t.id.toLowerCase().includes(searchLower) ||
    t.title.toLowerCase().includes(searchLower) ||
    (t.status && t.status.toLowerCase().includes(searchLower))
  );


  // Xác định đây là URL ngoài hay task
  const isExternalUrl = linkUrl && !linkUrl.startsWith('#task-');


  const handleUrlChange = (e) => {
    const val = e.target.value;
    setLinkUrl(val);
    setLinkSelected(null);
    // Dùng URL input như search luôn
    setLinkSearch(val);
  };


  const statusColor = (status) => {
    if (!status) return { bg: '#F4F5F7', text: '#42526E' };
    if (status === 'Done') return { bg: '#E3FCEF', text: '#006D3A' };
    if (status === 'In Progress') return { bg: '#DEEBFF', text: '#0052CC' };
    if (status === 'Need Revision') return { bg: '#FFEBE6', text: '#DE350B' };
    if (status === 'New') return { bg: '#F4F5F7', text: '#42526E' };
    return { bg: '#DEEBFF', text: '#0052CC' };
  };


  return ReactDOM.createPortal(
    <div
      className="rte-dialog-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="rte-link-dialog" onMouseDown={(e) => e.stopPropagation()}>


        {/* Tiêu đề */}
        <div className="rte-link-dialog-header">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path d="M6.5 9.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1" stroke="#4C2B74" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M9.5 6.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1" stroke="#4C2B74" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>Insert link</span>
          <button className="rte-link-close-btn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="#6B778C" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>


        {/* Ô nhập URL / tìm kiếm */}
        <div className="rte-link-url-section">
          <label className="rte-link-label">Paste or search for link</label>
          <div className={`rte-link-search-wrap ${linkSelected ? 'has-task' : ''}`}>
            {linkSelected ? (
              <div className="rte-link-selected-task">
                <span className="rte-link-task-id-badge">{linkSelected.id}</span>
                <span className="rte-link-selected-title">{linkSelected.title}</span>
                <button
                  className="rte-link-clear-btn"
                  onClick={() => { setLinkSelected(null); setLinkUrl(''); setLinkSearch(''); }}
                >×</button>
              </div>
            ) : (
              <>
                <svg className="rte-link-search-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="#8993A4" strokeWidth="1.5"/>
                  <path d="M11 11l3 3" stroke="#8993A4" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  className="rte-link-search-input"
                  placeholder="https://example.com or task name..."
                  value={linkSearch || linkUrl}
                  onChange={handleUrlChange}
                  onKeyDown={(e) => { if (e.key === 'Enter' && isExternalUrl) onInsert(); }}
                  autoFocus
                />
              </>
            )}
          </div>
        </div>


        {/* Ô hiển thị text */}
        <div className="rte-link-url-section" style={{ marginTop: 10 }}>
          <label className="rte-link-label">Display text (optional)</label>
          <input
            className="rte-link-display-input"
            placeholder="Enter display text..."
            value={linkText}
            onChange={e => setLinkText(e.target.value)}
          />
        </div>


        {/* Danh sách task - chỉ hiển thị khi chưa chọn và chưa nhập URL ngoài */}
        {!linkSelected && !isExternalUrl && (
          <div className="rte-link-task-body">


            {/* Task List & Board */}
            {filteredTasks.length > 0 && (
              <>
                <div className="rte-link-section-title">
                  <span className="rte-link-section-icon">📋</span>
                  Task List &amp; Board
                </div>
                <div className="rte-link-task-list">
                  {filteredTasks.map(task => {
                    const sc = statusColor(task.status);
                    return (
                      <div
                        key={task.id}
                        className={`rte-task-item ${linkSelected?.id === task.id ? 'selected' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); onSelectTask(task); }}
                      >
                        <span className="rte-task-item-id">{getTaskDisplayId(task)}</span>
                        <span className="rte-task-item-title">{task.title}</span>
                        <span
                          className="rte-task-item-status"
                          style={{ background: sc.bg, color: sc.text }}
                        >{task.status}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}


            {linkSearch && filteredTasks.length === 0 && (
              <div className="rte-link-empty">No tasks found for "{linkSearch}"</div>
            )}


            {/* Task gần đây */}
            {!linkSearch && recentTasks.length > 0 && (
              <>
                <div className="rte-link-section-title" style={{ marginTop: filteredTasks.length > 0 ? 8 : 0 }}>
                  <span className="rte-link-section-icon">🕐</span>
                  Recent tasks
                </div>
                <div className="rte-link-task-list">
                  {recentTasks.map(task => {
                    const sc = statusColor(task.status);
                    return (
                      <div
                        key={task.id}
                        className="rte-task-item"
                        onMouseDown={(e) => { e.preventDefault(); onSelectTask(task); }}
                      >
                        <span className="rte-task-item-id">{getTaskDisplayId(task)}</span>
                        <span className="rte-task-item-title">{task.title}</span>
                        <span
                          className="rte-task-item-status"
                          style={{ background: sc.bg, color: sc.text }}
                        >{task.status}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}




      </div>
    </div>,
    document.body
  );
}


// ─────────────────────────────────────────────
// ImageDialog — popup chèn ảnh / tải lên
// ─────────────────────────────────────────────
function ImageDialog({
  imageUrl, setImageUrl,
  imageAlt, setImageAlt,
  onInsert, onClose,
  onUploadFile,
  uploadUsage = 'attachment'
}) {
  const [activeTab, setActiveTab] = useState('file'); // 'file' or 'link'
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);


  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError('');
    if (onUploadFile) {
      setIsUploading(true);
      try {
        const uploaded = await onUploadFile(file, uploadUsage);
        const fileUrl = uploaded?.url || uploaded?.file_url || uploaded?.storage_url || uploaded?.previewUrl;
        if (!fileUrl) throw new Error('Upload response did not include a file URL.');

        const isImage = uploaded?.type === 'image' || file.type.startsWith('image/');
        onInsert(fileUrl, uploaded?.name || uploaded?.file_name || file.name, { asLink: !isImage });
      } catch (error) {
        setUploadError(error?.message || 'Unable to upload file.');
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
      return;
    }

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        onInsert(ev.target.result, file.name);
      };
      reader.readAsDataURL(file);
    } else {
      setUploadError('File uploads are unavailable here.');
    }
  };


  const triggerUpload = () => {
    fileInputRef.current?.click();
  };


  return ReactDOM.createPortal(
    <div className="rte-dialog-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rte-image-dialog" onMouseDown={(e) => e.stopPropagation()}>
       
        {/* Tabs */}
        <div className="rte-image-dialog-tabs">
          <div
            className={`rte-image-tab ${activeTab === 'file' ? 'active' : ''}`}
            onClick={() => setActiveTab('file')}
          >
            File
          </div>
          <div
            className={`rte-image-tab ${activeTab === 'link' ? 'active' : ''}`}
            onClick={() => setActiveTab('link')}
          >
            Link
          </div>
        </div>


        {/* Content */}
        <div className="rte-image-content">
          {activeTab === 'file' ? (
            <div className="rte-file-section">
              <div className="rte-upload-zone">
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/*,.pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                  onChange={handleFileChange}
                />
                <button className="rte-upload-btn" onClick={triggerUpload} disabled={isUploading}>
                  <span className="rte-upload-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </span>
                  {isUploading ? 'Uploading...' : 'Upload file'}
                </button>
                {uploadError && (
                  <div style={{ marginTop: 10, fontSize: 12, color: '#DE350B', fontWeight: 600 }}>
                    {uploadError}
                  </div>
                )}
              </div>
              <div className="rte-dialog-actions" style={{ marginTop: 16 }}>
                <button className="rte-dialog-cancel" onClick={onClose}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="rte-link-section">
              <label className="rte-dialog-label">Image URL</label>
              <input
                className="rte-dialog-input"
                placeholder="https://example.com/image.png"
                value={imageUrl.startsWith('data:') ? '' : imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                autoFocus
              />
              <label className="rte-dialog-label" style={{ marginTop: 12 }}>Alt text (optional)</label>
              <input
                className="rte-dialog-input"
                placeholder="Describe the image"
                value={imageAlt}
                onChange={e => setImageAlt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onInsert()}
              />
              <div className="rte-dialog-actions" style={{ marginTop: 24 }}>
                <button className="rte-dialog-cancel" onClick={onClose}>Cancel</button>
                <button className="rte-dialog-save" onClick={() => onInsert()}>Insert</button>
              </div>
            </div>
          )}
        </div>


      </div>
    </div>,
    document.body
  );
}

