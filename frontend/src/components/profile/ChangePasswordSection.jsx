import React, { useMemo, useState } from 'react';
import { changePassword } from '../../api/profileApi';

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;
  const message = error?.response?.data?.message;

  if (message) return message;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if (detail?.message) return detail.message;

  return 'Unable to change password. Please try again.';
}

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

  const requirements = useMemo(() => ({
    length: passwordData.newPassword.length >= 8,
    upper: /[A-Z]/.test(passwordData.newPassword),
    lower: /[a-z]/.test(passwordData.newPassword),
    number: /[0-9]/.test(passwordData.newPassword),
    special: /[^A-Za-z0-9]/.test(passwordData.newPassword),
  }), [passwordData.newPassword]);

  const passwordStrength = Object.values(requirements).filter(Boolean).length * 20;

  const getStrengthColor = () => {
    if (passwordStrength <= 20) return 'bg-red-500';
    if (passwordStrength <= 40) return 'bg-orange-500';
    if (passwordStrength <= 60) return 'bg-yellow-500';
    if (passwordStrength <= 80) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (!passwordData.newPassword) return 'None';
    if (passwordStrength <= 20) return 'Weak';
    if (passwordStrength <= 40) return 'Fair';
    if (passwordStrength <= 60) return 'Good';
    if (passwordStrength <= 80) return 'Strong';
    return 'Very Strong';
  };

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

    if (!Object.values(requirements).every(Boolean)) {
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
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusIcon = (isValid) => (
    <span
      className={`material-symbols-outlined text-[16px] ${isValid ? 'text-green-600' : 'text-gray-400'}`}
      style={{ fontVariationSettings: isValid ? "'FILL' 1" : "'FILL' 0" }}
    >
      {isValid ? 'check_circle' : 'circle'}
    </span>
  );

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
            <span className="font-semibold">{getStrengthText()}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full">
            <div
              className={`h-2 rounded-full transition-all ${getStrengthColor()}`}
              style={{ width: `${passwordStrength}%` }}
            />
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold mb-2">Password Requirements</p>
        <div className="space-y-2 text-sm">
          {[
            ['length', 'Minimum 8 characters'],
            ['upper', 'One uppercase letter'],
            ['lower', 'One lowercase letter'],
            ['number', 'One number'],
            ['special', 'One special character'],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              {renderStatusIcon(requirements[key])}
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

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
