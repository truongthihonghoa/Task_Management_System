import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

// ─── Password requirement rule definitions ─────────────────────────────────────
const PASSWORD_RULES = [
  { id: 'length',  label: 'Minimum 8 characters',          test: (p) => p.length >= 8 },
  { id: 'upper',   label: 'At least one uppercase letter',  test: (p) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'At least one lowercase letter',  test: (p) => /[a-z]/.test(p) },
  { id: 'number',  label: 'At least one number',            test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'At least one special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

// ─── Default empty form state (Create mode) ────────────────────────────────────
const EMPTY_FORM = {
  fullName: '',
  email:    '',
  role:     'User',
  status:   'Active',
  password: '',
};

// ─── Main component ────────────────────────────────────────────────────────────
const CreateUserModal = ({
  isOpen,
  selectedUser = null,
  onClose,
  onSave,
  onSaveSuccess,
}) => {
  const isEditMode = Boolean(selectedUser);

  const [form, setForm]             = useState(EMPTY_FORM);
  const [showPassword, setShowPwd]  = useState(false);
  const [errors, setErrors]         = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Sync form whenever the modal opens or context changes ────────────────────
  useEffect(() => {
    if (!isOpen) return;

    if (selectedUser) {
      setForm({
        fullName: selectedUser.name   || '',
        email:    selectedUser.email  || '',
        role:     selectedUser.role   || 'User',
        status:   selectedUser.status || 'Active',
        password: '', // never pre-fill password
      });
    } else {
      setForm(EMPTY_FORM);
    }

    setErrors({});
    setIsSubmitting(false);
    setShowPwd(false);
  }, [isOpen, selectedUser]);

  if (!isOpen) return null;

  // ── Field change handler ─────────────────────────────────────────────────────
  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = 'Full name is required.';
    if (!form.email.trim())    errs.email    = 'Email address is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email address.';

    if (
      form.password &&
      !PASSWORD_RULES.every((r) => r.test(form.password))
    ) {
      errs.password = "Password does not meet all requirements.";
    }
    return errs;
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const getApiErrorMessage = (error) => {
    const detail = error?.response?.data?.detail;
    const message = error?.response?.data?.message;

    if (message) return message;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
    if (detail?.message) return detail.message;

    return 'Unable to save user changes. Please try again.';
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsSubmitting(true);
    setErrors({});

    try {
      if (onSave) {
        await onSave(form, selectedUser);
      } else {
        const msg = `User "${form.fullName}" updated successfully!`;
        onSaveSuccess?.(msg);
        onClose();
      }
    } catch (error) {
      setErrors({ submit: getApiErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#091E42]/50 backdrop-blur-[3px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative bg-white w-[800px] rounded-md shadow-2xl overflow-hidden flex flex-col"
        style={{ animation: 'umIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-[22px] font-medium text-gray-900 leading-tight">
              Edit User
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-5 overflow-y-auto " style={{ maxHeight: 'calc(90vh - 160px)' }}>

          {/* Full Name */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Full Name</label>
            <input
              type="text"
              placeholder="Enter full name"
              value={form.fullName}
              readOnly
              onChange={handleChange('fullName')}
              className={`w-full bg-gray-200 text-gray-700 h-10 px-4 rounded-md border text-sm text-gray-800 placeholder-gray-400 outline-none transition ${
                errors.fullName ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
              }`}
            />
            {errors.fullName && <p className="text-[11px] text-red-500 mt-1">{errors.fullName}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Email Address</label>
            <input
              type="email"
              placeholder="Enter email address"
              value={form.email}
              readOnly
              onChange={handleChange('email')}
              className={`w-full bg-gray-200 text-gray-700 h-10 px-4 rounded-md border text-sm text-gray-800 placeholder-gray-400 outline-none transition ${
                errors.email ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
              }`}
            />
            {errors.email && <p className="text-[11px] text-red-500 mt-1">{errors.email}</p>}
          </div>

          {/* Role & Status */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { field: 'role',   label: 'Role',   options: ['User', 'Manager', 'Administrator'] },
              { field: 'status', label: 'Status', options: ['Active', 'Inactive', 'Suspended']  },
            ].map(({ field, label, options }) => (
              <div key={field}>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">{label}</label>
                <div className="relative">
                  <select
                    value={form[field]}
                    onChange={handleChange(field)}
                    className="w-full h-10 px-4 pr-9 rounded-md border border-gray-200 bg-white text-sm text-gray-800 outline-none appearance-none cursor-pointer transition focus:ring-2 focus:ring-[#5e4db2]/30 focus:border-[#5e4db2]"
                  >
                    {(field === 'role'
                      ? ['Super Admin', 'User']
                      : Array.from(new Set([form.status, 'Active', 'Inactive', 'Locked'].filter(Boolean)))
                    ).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-gray-400">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {errors.submit && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errors.submit}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-gray-100 bg-gray-50/60">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2 text-[16px] font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 text-[16px] font-medium bg-[#4C1D95] hover:bg-[#3B1578] active:scale-95 text-white rounded-md shadow-md shadow-purple-900/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Spring-in keyframe */}
      <style>{`
        @keyframes umIn {
          from { opacity: 0; transform: scale(0.93) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);     }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default CreateUserModal;
