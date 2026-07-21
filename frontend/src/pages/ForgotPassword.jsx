import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { checkEmail, forgotPassword } from '../api/authApi';

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;
  const message = error?.response?.data?.message;

  if (message) return message;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if (detail?.message) return detail.message;

  return 'Unable to send reset link. Please try again.';
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const flow = location.state?.flow || 'forgot';
  const isRegisterFlow = flow === 'register';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (isRegisterFlow) {
        await checkEmail(normalizedEmail);
        navigate('/verify-email', { state: { email: normalizedEmail, flow } });
      } else {
        await forgotPassword(normalizedEmail);
        setSentEmail(normalizedEmail);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-surface font-sans min-h-screen flex flex-col antialiased text-slate-800">
      <main className="flex-grow flex items-center justify-center p-6">
        <section className="bg-white w-full max-w-[440px] rounded-2xl border border-slate-100 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex flex-col">
          <div className="px-8 pb-8 md:px-12 md:pb-10 pt-4 flex flex-col">
            <div className="text-center">
              {sentEmail && !isRegisterFlow ? (
                <div className="mt-10">
                  <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-700">
                    <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      mark_email_read
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-2">Check Your Email</h1>
                  <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                    A password reset link has been sent to{' '}
                    <span className="font-semibold text-slate-700 break-all">{sentEmail}</span>.
                    Open the link to create a new password.
                  </p>
                  <button
                    className="w-full py-3.5 px-4 bg-[#4B2C7F] hover:bg-[#3d2368] text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 shadow-md"
                    type="button"
                    onClick={() => {
                      setSentEmail('');
                      setEmail('');
                    }}
                  >
                    Send Another Link
                  </button>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-slate-900 mb-2 mt-10">
                    {isRegisterFlow ? 'Create Your Account' : 'Forgot Password?'}
                  </h1>
                  <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                    {isRegisterFlow
                      ? 'Enter your email address to receive a verification code.'
                      : 'Enter your registered email address and we will send you a password reset link.'}
                  </p>

                  <form onSubmit={handleSubmit} className="text-left space-y-5" autoComplete="off">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider" htmlFor="email">
                        Email address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path>
                          </svg>
                        </div>
                        <input
                          className="block w-full pl-11 pr-4 py-3 bg-[#fdfcff] border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm placeholder-slate-400 transition-all outline-none"
                          id="email"
                          name={isRegisterFlow ? 'create-account-email-input' : 'account-recovery-email-input'}
                          type="email"
                          autoComplete="off"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          placeholder="Enter your email"
                          required
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setErrorMessage('');
                          }}
                        />
                      </div>
                    </div>

                    {errorMessage && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {errorMessage}
                      </div>
                    )}

                    <button
                      className="w-full py-3.5 px-4 bg-[#4B2C7F] hover:bg-[#3d2368] text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                      type="submit"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Sending...' : (isRegisterFlow ? 'Send OTP' : 'Send Reset Link')}
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                      </svg>
                    </button>
                  </form>
                </>
              )}

              <div className="mt-5">
                <Link className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors" to="/">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  </svg>
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
