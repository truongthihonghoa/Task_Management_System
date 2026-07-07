import React, { useState } from 'react';
import forgotPasswordImg from '../assets/forgotpassword.jpg';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const flow = location.state?.flow || 'forgot';

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Gửi OTP đến email:', email);
    navigate('/verify-email', { state: { email, flow } });
  };

  return (
    <div className="bg-surface font-sans min-h-screen flex flex-col antialiased text-slate-800">
      
      {/* Khối nội dung chính */}
      <main className="flex-grow flex items-center justify-center p-6">
        <section className="bg-white w-full max-w-[440px] rounded-2xl border border-slate-100 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex flex-col">
          {/* Phần nội dung dưới Logo */}
          <div className="px-8 pb-8 md:px-12 md:pb-10 pt-4 flex flex-col">

            {/* Khu vực Form */}
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900 mb-2 mt-10">Forgot Password?</h1>
              <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                Enter your registered email address to receive a verification code.
              </p>

              <form onSubmit={handleSubmit} className="text-left space-y-5">
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
                      name="email" 
                      type="email"
                      placeholder="Enter your email" 
                      required 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                
                <button className="w-full py-3.5 px-4 bg-[#4B2C7F] hover:bg-[#3d2368] text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors duration-200 shadow-md" type="submit">
                  Send OTP
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  </svg>
                </button>
              </form>

              {/* Link quay lại */}
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