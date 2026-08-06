import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/EditUserModal.css';
import { getApiErrorMessage } from '../../utils/apiError';
import { getPasswordRequirements, meetsAllPasswordRequirements } from '../../utils/passwordStrength';

// ─── Password requirement rule definitions ─────────────────────────────────────
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
      !meetsAllPasswordRequirements(getPasswordRequirements(form.password))
    ) {
      errs.password = "Password does not meet all requirements.";
    }
    return errs;
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
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
      setErrors({ submit: getApiErrorMessage(error, 'Unable to save user changes. Please try again.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return createPortal(
    <div className="modal-overlay modal-overlay-strong" onClick={onClose}>
      <div className="modal-panel modal-panel-compact edit-user-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title-strong">Edit User</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="header-btn edit-user-close-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-body modal-body-comfortable edit-user-body custom-scrollbar">
          <div className="form-group">
            <label className="form-label form-label-comfortable">Full Name</label>
            <input
              type="text"
              placeholder="Enter full name"
              value={form.fullName}
              readOnly
              onChange={handleChange('fullName')}
              className={`input-custom input-custom-comfortable input-readonly ${errors.fullName ? 'input-error' : ''}`}
            />
            {errors.fullName && <p className="error-message">{errors.fullName}</p>}
          </div>

          <div className="form-group">
            <label className="form-label form-label-comfortable">Email Address</label>
            <input
              type="email"
              placeholder="Enter email address"
              value={form.email}
              readOnly
              onChange={handleChange('email')}
              className={`input-custom input-custom-comfortable input-readonly ${errors.email ? 'input-error' : ''}`}
            />
            {errors.email && <p className="error-message">{errors.email}</p>}
          </div>

          <div className="edit-user-grid">
            {[
              { field: 'role',   label: 'Role',   options: ['User', 'Manager', 'Administrator'] },
              { field: 'status', label: 'Status', options: ['Active', 'Inactive', 'Suspended']  },
            ].map(({ field, label, options }) => (
              <div className="form-group" key={field}>
                <label className="form-label form-label-comfortable">{label}</label>
                <div className="relative">
                  <select
                    value={form[field]}
                    onChange={handleChange(field)}
                    className="select-custom input-custom-comfortable"
                  >
                    {(field === 'role'
                      ? ['Super Admin', 'User']
                      : Array.from(new Set([form.status, 'Active', 'Inactive', 'Locked'].filter(Boolean)))
                    ).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <div className="edit-user-select-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-gray-400">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {errors.submit && (
            <div className="form-error-banner">
              {errors.submit}
            </div>
          )}
        </div>

        <div className="modal-footer modal-footer-end">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-create edit-user-save-btn"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CreateUserModal;
