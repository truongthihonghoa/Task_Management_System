import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { resendVerification, verifyEmail } from '../api/authApi';

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;
  const message = error?.response?.data?.message;

  if (message) return message;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if (detail?.message) return detail.message;

  return 'Unable to verify the code. Please try again.';
}

export default function VerifyEmail() {
  const [otp, setOtp] = useState(new Array(6).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const inputRefs = useRef([]);
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || '';
  const flow = location.state?.flow || 'register';
  const invitation = location.state?.invitation || null;
  const isRegisterFlow = flow === 'register';

  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
  }, []);

  useEffect(() => {
    if (!isRegisterFlow) {
      navigate('/account-recovery', { replace: true });
      return;
    }
    if (!email) {
      navigate('/create-account', { replace: true, state: { flow, invitation } });
    }
  }, [email, flow, invitation, isRegisterFlow, navigate]);

  const handleChange = (element, index) => {
    const value = element.value.replace(/[^0-9]/g, '');
    if (!value) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    setErrorMessage('');
    setMessage('');

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      const newOtp = [...otp];

      if (otp[index]) {
        newOtp[index] = '';
        setOtp(newOtp);
      } else if (index > 0) {
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');

    if (otpCode.length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setMessage('');

    try {
      await verifyEmail({ email, otpCode });
      navigate('/register', { state: { email, verified: true, invitation }, replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!isRegisterFlow) return;

    setIsResending(true);
    setErrorMessage('');
    setMessage('');

    try {
      const response = await resendVerification(email);
      setOtp(new Array(6).fill(''));
      inputRefs.current[0]?.focus();
      setMessage(response.message || 'Verification code has been resent.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans antialiased bg-[#FAF8FF]">
      <main className="flex-grow flex items-center justify-center p-6">
        <section className="bg-white rounded-2xl shadow-xl border border-[#E0D7F0] p-8 md:p-12 w-full max-w-[440px]">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#FAF8FF] border border-[#E0D7F0] mb-6">
              <svg className="h-6 w-6 text-[#4C2B74]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-black text-[#4C2B74] mb-2">Verify Your Email</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              We sent a 6-digit verification code to<br />
              <span className="font-semibold text-[#170338] break-all">{email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-6 gap-2 mb-6">
              {otp.map((data, index) => (
                <input
                  key={index}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className="w-full h-12 sm:h-14 text-center text-xl font-semibold border border-[#E0D7F0] rounded-lg focus:border-[#4C2B74] focus:ring-2 focus:ring-[#4C2B74]/20 transition-all outline-none bg-white p-0 text-[#170338]"
                  placeholder="-"
                  value={data}
                  ref={(el) => (inputRefs.current[index] = el)}
                  onChange={(e) => handleChange(e.target, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                />
              ))}
            </div>

            {errorMessage && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            )}

            {message && (
              <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#4C2B74] hover:bg-[#3D225F] text-white font-semibold py-3.5 rounded-xl transition-colors duration-200 mb-6 shadow-md shadow-[#E0D7F0] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>

          <div className="text-center text-sm text-gray-500 mb-10">
            Didn't receive the code?<br />
            <button
              type="button"
              onClick={handleResend}
              disabled={!isRegisterFlow || isResending}
              className="text-[#4C2B74] hover:text-[#3D225F] font-semibold transition-colors mt-1 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResending ? 'Resending...' : 'Resend Code'}
            </button>
          </div>

          <div className="border-t border-[#F0EBF8] pt-6 flex items-center justify-center space-x-2 text-[10px] uppercase tracking-widest text-[#6B6375] font-semibold">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
            <span>Secure Verification</span>
          </div>
        </section>
      </main>
    </div>
  );
}
