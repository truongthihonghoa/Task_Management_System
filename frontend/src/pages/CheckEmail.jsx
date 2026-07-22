import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function CheckEmail() {
  const location = useLocation();
  const email = location.state?.email || 'your email';

  return (
    <div className="bg-surface min-h-screen flex flex-col font-sans antialiased">
      <main className="flex-grow flex items-center justify-center p-6">
        <section className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-12 w-full max-w-[440px] text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 mb-6">
            <svg className="h-7 w-7 text-[#4B3277]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Password reset link has been sent to <span className="font-semibold text-gray-700 break-all">{email}</span>.
          </p>

          <Link
            className="inline-flex w-full items-center justify-center py-3.5 px-4 bg-[#4B2C7F] hover:bg-[#3d2368] text-white font-semibold rounded-lg transition-colors duration-200 shadow-md"
            to="/"
          >
            Back to Login
          </Link>
        </section>
      </main>
    </div>
  );
}
