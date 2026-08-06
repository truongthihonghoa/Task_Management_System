import React, { useMemo, useState } from 'react';
import { changePassword } from '../../api/profileApi';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  getPasswordRequirements,
  getProfilePasswordStrength,
  meetsAllPasswordRequirements,
} from '../../utils/passwordStrength';

export default function ChangePasswordSection({ onPasswordChanged }) {
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const requirements = useMemo(() => getPasswordRequirements(passwordData.newPassword), [passwordData.newPassword]);
  const passwordStrength = useMemo(
    () => getProfilePasswordStrength(passwordData.newPassword, requirements),
    [passwordData.newPassword, requirements]
  );

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordData((previous) => ({
      ...previous,
      [name]: value,
    }));
    setErrorMessage('');
    setSuccessMessage('');
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords((previous) => ({
      ...previous,
      [field]: !previous[field],
    }));
  };

  const resetForm = () => {
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setErrorMessage('Confirm password mismatch.');
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      setErrorMessage('New password must not be the same as current password.');
      return;
    }

    if (!meetsAllPasswordRequirements(requirements)) {
      setErrorMessage('New password must meet all requirements.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await changePassword(passwordData);
      resetForm();
      setSuccessMessage(response.message || 'Password changed successfully.');
      onPasswordChanged?.(response);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to change password. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
      <input className="hidden" type="text" name="fake-profile-username" autoComplete="username" tabIndex={-1} aria-hidden="true" />
      <input className="hidden" type="password" name="fake-profile-password" autoComplete="current-password" tabIndex={-1} aria-hidden="true" />

      <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>

      {[
        {
          label: 'Current Password',
          stateName: 'currentPassword',
          inputName: 'profile-current-password',
          key: 'current',
          autoComplete: 'current-password',
        },
        {
          label: 'New Password',
          stateName: 'newPassword',
          inputName: 'profile-new-password',
          key: 'new',
          autoComplete: 'new-password',
        },
        {
          label: 'Confirm Password',
          stateName: 'confirmPassword',
          inputName: 'profile-confirm-password',
          key: 'confirm',
          autoComplete: 'new-password',
        },
      ].map((item) => (
        <div key={item.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {item.label}
          </label>

          <div className="relative">
            <input
              type={showPasswords[item.key] ? 'text' : 'password'}
              name={item.stateName}
              autoComplete={item.autoComplete}
              data-lpignore="true"
              data-1p-ignore="true"
              value={passwordData[item.stateName]}
              onChange={handlePasswordChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2D1B4E] pr-12"
              disabled={isSubmitting}
              required
            />

            <button
              type="button"
              onClick={() => togglePasswordVisibility(item.key)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            >
              <span className="material-symbols-outlined text-[20px]">
                {showPasswords[item.key] ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>
      ))}

      {passwordData.newPassword && (
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex justify-between text-sm mb-2">
            <span>Password Strength</span>
            <span className="font-semibold">{passwordStrength.text}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full">
            <div
              className={`progress-fill h-2 rounded-full transition-all ${passwordStrength.colorClass}`}
              style={{ '--progress-width': `${passwordStrength.percentage}%` }}
            />
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {successMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-[#2D1B4E] text-white rounded-lg hover:bg-opacity-90 font-bold disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Saving...' : 'Change Password'}
      </button>
    </form>
  );
}
