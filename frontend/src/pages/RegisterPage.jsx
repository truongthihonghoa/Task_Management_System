import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { uploadRegistrationAvatar } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { setCurrentUser } from '../services/tokenStorage';
import { getApiErrorMessage } from '../utils/apiError';
import {
  getPasswordRequirements,
  getRegisterPasswordStrength,
  meetsAllPasswordRequirements,
} from '../utils/passwordStrength';

const AVATAR_ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export default function CompleteAccount() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, setUser } = useAuth();
  const avatarInputRef = useRef(null);
  const verifiedEmail = location.state?.email || '';
  const isVerified = Boolean(location.state?.verified);
  const invitation = location.state?.invitation || null;

  const [formData, setFormData] = useState({
    fullName: '',
    password: '',
    confirmPassword: '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!verifiedEmail || !isVerified) {
      navigate('/create-account', { replace: true, state: { flow: 'register', invitation } });
    }
  }, [invitation, isVerified, navigate, verifiedEmail]);

  useEffect(() => {
    const clearAutofill = window.setTimeout(() => {
      setFormData({
        fullName: '',
        password: '',
        confirmPassword: '',
      });
    }, 100);

    return () => window.clearTimeout(clearAutofill);
  }, []);

  useEffect(() => () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
  }, [avatarPreview]);

  const requirements = getPasswordRequirements(formData.password);
  const strength = getRegisterPasswordStrength(formData.password, requirements);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    setErrorMessage('');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!AVATAR_ALLOWED_TYPES.has(file.type)) {
      setErrorMessage('Avatar must be a JPG, PNG, or WEBP image.');
      e.target.value = '';
      return;
    }

    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      setErrorMessage('Avatar file size must be 5 MB or less.');
      e.target.value = '';
      return;
    }

    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setErrorMessage('');
  };

  const handleRemoveAvatar = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
    setAvatarFile(null);
    setAvatarPreview('');
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!verifiedEmail || !isVerified) {
      setErrorMessage('Email must be verified before registration.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Confirm password mismatch.');
      return;
    }

    if (!meetsAllPasswordRequirements(requirements)) {
      setErrorMessage('Password must meet all requirements.');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await register({
        email: verifiedEmail,
        fullName: formData.fullName,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        remember: true,
      });

      if (avatarFile) {
        const avatarResponse = await uploadRegistrationAvatar(avatarFile);
        const nextUser = {
          ...(response.user || {}),
          avatar_url: avatarResponse.avatar_url,
        };
        setCurrentUser(nextUser, { persist: true });
        setUser(nextUser);
        response.user = nextUser;
      }

      setIsSuccess(true);
      setTimeout(() => {
        const invitationSpaceId = invitation?.spaceId;
        if (invitationSpaceId && response.user?.role !== 'SUPER_ADMIN') {
          navigate(`/dashboard/tasks/${invitationSpaceId}?invite=accepted`, { replace: true });
          return;
        }
        navigate(response.user?.role === 'SUPER_ADMIN' ? '/dashboard' : '/dashboard/spaces', { replace: true });
      }, 1200);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to create account. Please check your information and try again.'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <section className="fixed inset-0 z-50 bg-[#faf8ff] flex items-center justify-center p-4">
        <div className="w-full max-w-[500px] text-center space-y-6 animate-fade-in">
          <div className="relative mx-auto w-32 h-32">
            <div className="absolute inset-0 bg-[#004ac6]/20 rounded-full animate-ping"></div>
            <div className="relative w-full h-full bg-[#004ac6] text-white rounded-full flex items-center justify-center shadow-2xl">
              <span className="material-symbols-filled material-symbols-outlined text-[64px]">
                check_circle
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-[36px] font-bold text-[#191b23] tracking-tight">Welcome Aboard!</h2>
            <p className="text-[16px] text-[#434655]">
              Your TaskFlow account is ready. We're redirecting you to your workspace now.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="bg-surface text-[#191b23] min-h-screen flex flex-col font-sans">
      <main className="flex-grow px-6 pt-8 pb-24 mt-0">
        <div className="w-full max-w-[500px] mx-auto bg-white border border-[#c3c6d7] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.05)] rounded-[20px] overflow-hidden">
          <div className="p-8 space-y-8">
            <header className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#dbe1ff] text-[#004ac6] mb-2">
                <span className="material-symbols-filled material-symbols-outlined text-[28px]">
                  verified_user
                </span>
              </div>
              <div className="space-y-1">
                <h1 className="text-[24px] font-semibold text-[#191b23] tracking-tight">Complete Your Account</h1>
                <p className="text-[14px] text-[#434655] px-4">
                  {invitation
                    ? 'Your invitation is ready. Complete your profile to join the space.'
                    : 'Your email has been successfully verified. Complete your profile to start using TaskFlow.'}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-1 bg-[#ededf9] rounded-full border border-[#c3c6d7]/30">
                <span className="text-[13px] font-medium text-[#434655] break-all">{verifiedEmail}</span>
                <span className="material-symbols-filled material-symbols-outlined text-[16px] text-[#004ac6]">
                  check_circle
                </span>
              </div>
            </header>

            <form className="space-y-6" onSubmit={handleSubmit} autoComplete="off">
              <input className="hidden" type="text" name="fake-register-username" autoComplete="username" tabIndex={-1} aria-hidden="true" />
              <input className="hidden" type="password" name="fake-register-password" autoComplete="current-password" tabIndex={-1} aria-hidden="true" />
              <div className="space-y-3">
                <label className="text-[12px] font-medium text-[#434655] block" htmlFor="avatarFile">Avatar Photo</label>
                <div className="flex items-center gap-4 rounded-lg border border-[#c3c6d7] bg-[#faf8ff] p-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[#c3c6d7] bg-[#ededf9] flex items-center justify-center text-[#4B3277]">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar preview" className="h-full w-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-[30px]">account_circle</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      ref={avatarInputRef}
                      id="avatarFile"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor="avatarFile"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#ededf9] px-3 py-2 text-[13px] font-semibold text-[#4B3277] transition-colors hover:bg-[#e2d8fb]"
                      >
                        <span className="material-symbols-outlined text-[18px]">upload</span>
                        Upload
                      </label>
                      {avatarPreview && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-lg border border-[#c3c6d7] px-3 py-2 text-[13px] font-semibold text-[#434655] transition-colors hover:bg-white"
                          onClick={handleRemoveAvatar}
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[12px] text-[#737686]">Optional. JPG, PNG up to 5 MB.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#434655] block" htmlFor="fullName">Full Name</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#737686] text-[20px]">person</span>
                  <input
                    className="w-full pl-12 pr-4 py-[10px] bg-[#faf8ff] rounded-lg border border-[#c3c6d7] focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] outline-none transition-all text-[14px]"
                    id="fullName"
                    type="text"
                    name="taskflow-register-full-name-input"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    placeholder="John Doe"
                    required
                    value={formData.fullName}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#434655] block" htmlFor="password">Password</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#737686] text-[20px]">lock</span>
                  <input
                    className="w-full pl-12 pr-12 py-[10px] bg-[#faf8ff] rounded-lg border border-[#c3c6d7] focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] outline-none transition-all text-[14px]"
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="taskflow-register-password-input"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    placeholder="Enter password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#737686] hover:text-[#191b23] transition-colors"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-[#434655]">
                    Strength: <span className={`font-semibold ${strength.colorClass.split(' ')[1]}`}>{strength.text}</span>
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#e1e2ed] rounded-full overflow-hidden">
                  <div
                    className={`progress-fill h-full transition-all duration-300 ease-in-out ${strength.colorClass.split(' ')[0]}`}
                    style={{ '--progress-width': strength.barWidth }}
                  ></div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#434655] block" htmlFor="confirmPassword">Confirm Password</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#737686] text-[20px]">lock</span>
                  <input
                    className="w-full pl-12 pr-12 py-[10px] bg-[#faf8ff] rounded-lg border border-[#c3c6d7] focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] outline-none transition-all text-[14px]"
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="taskflow-register-confirm-password-input"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    placeholder="Confirm password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                  />
                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#737686] hover:text-[#191b23] transition-colors"
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showConfirmPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid gap-y-2 bg-[#f3f3fe] p-4 rounded-lg border border-[#c3c6d7]/20">
                {[
                  { key: 'length', label: 'Minimum 8 characters' },
                  { key: 'upper', label: 'One uppercase letter' },
                  { key: 'lower', label: 'One lowercase letter' },
                  { key: 'number', label: 'One number' },
                  { key: 'special', label: 'One special character' },
                ].map((req) => (
                  <div key={req.key} className="flex items-center gap-2">
                    <span
                      className={`material-symbols-outlined text-[16px] transition-all ${requirements[req.key] ? 'material-symbols-filled text-[#004ac6]' : 'material-symbols-unfilled text-[#737686]'}`}
                    >
                      {requirements[req.key] ? 'check_circle' : 'circle'}
                    </span>
                    <span className="text-[12px] text-[#434655]">{req.label}</span>
                  </div>
                ))}
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {errorMessage}
                </div>
              )}

              <button
                className="w-full py-4 px-6 bg-[#4B3277] hover:bg-[#3d2861] text-white font-semibold text-[18px] rounded-lg shadow-lg hover:shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed"
                type="submit"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    Processing...
                  </>
                ) : (
                  <>
                    Create Account
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center mt-6 text-[14px] text-[#434655]">
          Already have an account?{' '}
          <Link className="text-[#004ac6] font-semibold hover:underline transition-all duration-200" to="/">
            Sign In
          </Link>
        </p>
      </main>
    </div>
  );
}
