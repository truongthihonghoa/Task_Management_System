import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  resetPassword as resetPasswordRequest,
  verifyResetToken,
} from '../api/authApi';
import { getApiErrorMessage } from '../utils/apiError';
import {
  getPasswordRequirements,
  getResetPasswordStrength,
  meetsAllPasswordRequirements,
} from '../utils/passwordStrength';

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || location.state?.email || '';
  const token = searchParams.get('token') || location.state?.token || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const checks = useMemo(() => getPasswordRequirements(newPassword), [newPassword]);
  const strength = useMemo(() => getResetPasswordStrength(newPassword, checks), [checks, newPassword]);

  const hasValidLink = Boolean(email && token);

  useEffect(() => {
    if (!hasValidLink) {
      setIsVerifying(false);
      setIsValidToken(false);
      return;
    }

    let isMounted = true;
    verifyResetToken({ email, token })
      .then(() => {
        if (isMounted) {
          setIsValidToken(true);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setIsValidToken(false);
          setVerifyError(getApiErrorMessage(error, 'Unable to reset password. Please request a new reset link and try again.'));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsVerifying(false);
        }
      });

    const clearAutofill = window.setTimeout(() => {
      setNewPassword('');
      setConfirmPassword('');
    }, 100);

    return () => {
      isMounted = false;
      window.clearTimeout(clearAutofill);
    };
  }, [email, token, hasValidLink]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!hasValidLink) {
      setErrorMessage('Reset link is invalid or missing required information.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Confirm password mismatch.');
      return;
    }

    if (!meetsAllPasswordRequirements(checks)) {
      setErrorMessage('Password must meet all requirements.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await resetPasswordRequest({
        email,
        token,
        password: newPassword,
        confirmPassword,
      });
      setSuccessMessage(response.message || 'Password reset successfully.');
      setNewPassword('');
      setConfirmPassword('');
      window.setTimeout(() => {
        navigate('/', {
          replace: true,
          state: { message: 'Password reset successfully. Please sign in with your new password.' },
        });
      }, 1200);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to reset password. Please request a new reset link and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="bg-surface min-h-screen flex flex-col font-sans antialiased">
        <main className="flex-grow flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-[#4B3277] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 font-medium">Verifying reset link...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!isValidToken && hasValidLink) {
    return (
      <div className="bg-surface min-h-screen flex flex-col font-sans antialiased">
        <main className="flex-grow flex items-center justify-center p-6">
          <section className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-12 w-full max-w-[440px] text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-4">
              <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Link No Longer Valid</h1>
            <p className="text-sm text-gray-500 mb-8">
              {verifyError || 'This reset link is invalid or has expired.'}
            </p>
            <Link
              className="inline-flex w-full justify-center py-3.5 px-4 bg-[#4B2C7F] hover:bg-[#3d2368] text-white font-semibold rounded-lg transition-colors shadow-md active:scale-[0.98]"
              to="/"
            >
              Back to Login
            </Link>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen flex flex-col font-sans antialiased">
      <main className="flex-grow flex items-center justify-center p-6">
        <section className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-12 w-full max-w-[440px]">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 mb-4">
              <svg className="h-6 w-6 text-[#4B3277]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Create New Password</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              {hasValidLink
                ? 'Enter a new password for your TaskFlow account.'
                : 'This reset link is invalid or incomplete. Please request a new link.'}
            </p>
            {email && (
              <div className="mt-4 inline-flex max-w-full items-center rounded-full bg-[#f3f0fb] px-4 py-1 text-xs font-semibold text-[#4B3277]">
                <span className="truncate">{email}</span>
              </div>
            )}
          </div>

          <form className="space-y-5" onSubmit={handleSubmit} autoComplete="off">
            <input className="hidden" type="text" name="fake-reset-username" autoComplete="username" tabIndex={-1} aria-hidden="true" />
            <input className="hidden" type="password" name="fake-reset-password" autoComplete="current-password" tabIndex={-1} aria-hidden="true" />

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider" htmlFor="new-password">
                New Password
              </label>
              <div className="relative">
                <input
                  className="block w-full px-4 py-3 bg-[#fdfcff] border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#4B3277] focus:border-[#4B3277] text-sm placeholder-slate-400 transition-all outline-none pr-11"
                  id="new-password"
                  name="taskflow-reset-new-password"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  placeholder="Enter new password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setErrorMessage('');
                  }}
                  disabled={!hasValidLink || isSubmitting}
                  required
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  type="button"
                  aria-label="Toggle password visibility"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showNewPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              <div className="mt-2 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {strength.label}
                </span>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`progress-fill h-full rounded-full transition-all duration-300 ease-in-out ${strength.colorClass}`}
                    style={{ '--progress-width': strength.width }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider" htmlFor="confirm-password">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  className="block w-full px-4 py-3 bg-[#fdfcff] border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#4B3277] focus:border-[#4B3277] text-sm placeholder-slate-400 transition-all outline-none pr-11"
                  id="confirm-password"
                  name="taskflow-reset-confirm-password"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  placeholder="Repeat new password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrorMessage('');
                  }}
                  disabled={!hasValidLink || isSubmitting}
                  required
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  type="button"
                  aria-label="Toggle confirm password visibility"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Password Requirements
              </p>
              <ul className="space-y-1.5">
                {[
                  { key: 'length', label: 'Minimum 8 characters' },
                  { key: 'upper', label: 'One uppercase letter' },
                  { key: 'lower', label: 'One lowercase letter' },
                  { key: 'number', label: 'One number' },
                  { key: 'special', label: 'One special character' },
                ].map(({ key, label }) => (
                  <li key={key} className={`flex items-center gap-2 text-xs transition-colors ${checks[key] ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <span className={`material-symbols-outlined text-[16px] ${checks[key] ? 'material-symbols-filled' : 'material-symbols-unfilled'}`}>
                      {checks[key] ? 'check_circle' : 'circle'}
                    </span>
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                {successMessage} Redirecting to login...
              </div>
            )}

            <button
              className="w-full py-3.5 px-4 bg-[#4B2C7F] hover:bg-[#3d2368] text-white font-semibold rounded-lg transition-colors duration-200 shadow-md active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              type="submit"
              disabled={!hasValidLink || isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Reset Password'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              to="/"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Login
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
