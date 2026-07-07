import React, { useState, useEffect } from 'react';
import taskflowLogo from '../assets/taskflow-logo.png';
import { Link, useNavigate } from 'react-router-dom';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [emailError, setEmailError] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    const handleEmailChange = (e) => {
        const value = e.target.value;
        setEmail(value);
        if (value.includes('@') || value === '') {
            setEmailError(false);
        }
    };

    const handleLogin = (e) => {
        e.preventDefault();

        if (!email.includes('@')) {
            setEmailError(true);
            return;
        }

        setIsLoading(true);

        setTimeout(() => {
            setIsLoading(false);
            setIsRedirecting(true);

            // Determine user role based on email (mock logic)
            // Super Admin: Alex Morgan (alex.morgan@example.com)
            // Regular Users: Trang Nguyen, Tien Phham, etc.
            const isAdminEmail = email.toLowerCase().includes('alex.morgan') || 
                                 email.toLowerCase().includes('admin');

            setTimeout(() => {
                setIsRedirecting(false);
                setEmail('');
                setPassword('');

                // Redirect based on role
                if (isAdminEmail) {
                    // Super Admin → Super Admin Dashboard
                    navigate('/dashboard?role=SUPERADMIN');
                } else {
                    // Regular User → Task Management (via Space Management)
                    navigate('/dashboard/spaces?role=USER');
                }
            }, 1000);
        }, 2000);
    };

    return (
        <div className="bg-surface dark:bg-inverse-surface min-h-screen flex items-center justify-center p-6 transition-colors duration-300 font-['Inter']">

            {/* Nút chuyển đổi giao diện Sáng / Tối */}
            <button
                type="button"
                className="fixed top-6 right-6 p-2 bg-surface-container dark:bg-on-surface-variant/20 rounded-full hover:bg-surface-container-high transition-colors"
                onClick={() => setIsDark(!isDark)}
            >
                <span className="material-symbols-outlined text-on-surface-variant dark:text-inverse-primary">
                    {isDark ? 'light_mode' : 'dark_mode'}
                </span>
            </button>

            <main className="w-full max-w-[440px]">
                {/* Login Card */}
                <div className="bg-surface-container-lowest dark:bg-on-surface/10 backdrop-blur-xl border border-outline-variant/30 dark:border-outline/20 rounded-xl shadow-sm p-8 md:p-12 flex flex-col gap-6">

                    {/* Logo & Title */}
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 bg-primary-container/10 rounded-xl flex items-center justify-center mb-1 border-[5px] border-[#2D1B4E] overflow-hidden">
                            <img alt="TaskMaster Logo" className="w-[86px] h-[86px] max-w-none object-contain scale-[1.35]" src={taskflowLogo} />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-on-surface dark:text-inverse-on-surface">
                                Welcome back
                            </h1>
                            <p className="text-[14px] leading-[20px] font-normal text-on-surface-variant dark:text-surface-variant">
                                Enter your credentials to access your workspace
                            </p>
                        </div>
                    </div>

                    {/* Form */}
                    <form className="flex flex-col gap-6" onSubmit={handleLogin}>

                        {/* Email */}
                        <div className="flex flex-col gap-[9px]">
                            <label className="text-[12px] leading-[16px] tracking-[0.05em] font-medium text-on-surface-variant dark:text-surface-variant" htmlFor="email">
                                Email Address
                            </label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline dark:text-outline-variant text-[20px]">
                                    mail
                                </span>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="name@company.com"
                                    required
                                    value={email}
                                    onChange={handleEmailChange}
                                    className={`w-full pl-14 pr-4 py-4 bg-transparent border rounded-lg text-[14px] leading-[20px] font-normal text-on-surface dark:text-inverse-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-outline/50 
                                    ${emailError ? 'border-error dark:border-error-container' : 'border-outline-variant dark:border-outline/30'}`}
                                />
                            </div>
                            {emailError && (
                                <div className="flex items-center gap-1 mt-1 text-error dark:text-error-container">
                                    <span className="material-symbols-outlined text-[16px]">error</span>
                                    <span className="text-[12px] leading-[16px] font-medium tracking-[0.05em]">Invalid email format</span>
                                </div>
                            )}
                        </div>

                        {/* Password */}
                        <div className="flex flex-col gap-[9px]">
                            <label className="text-[12px] leading-[16px] tracking-[0.05em] font-medium text-on-surface-variant dark:text-surface-variant" htmlFor="password">
                                Password
                            </label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline dark:text-outline-variant text-[20px]">
                                    lock
                                </span>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-14 pr-14 py-4 bg-transparent border border-outline-variant dark:border-outline/30 rounded-lg text-[14px] leading-[20px] font-normal text-on-surface dark:text-inverse-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-outline/50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-[54%] -translate-y-1/2 text-outline hover:text-on-surface dark:text-outline-variant dark:hover:text-inverse-on-surface transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Remember Me & Forgot Password */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="w-[18px] h-[18px] border border-outline rounded focus:ring-0 checked:bg-primary dark:checked:bg-primary text-primary cursor-pointer accent-primary"
                                />
                                <span className="text-[12px] leading-[16px] font-medium tracking-[0.05em] text-on-surface-variant dark:text-surface-variant group-hover:text-on-surface transition-colors">
                                    Remember Me
                                </span>
                            </label>
                            <Link
                                className="text-[12px] leading-[16px] font-medium tracking-[0.05em] text-[#2D1B4E] dark:text-[#2D1B4E]/80 hover:underline underline-offset-4"
                                to="/forgot-password"
                                state={{ flow: 'forgot' }}
                            >
                                Forgot Password?
                            </Link>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={isLoading || isRedirecting}
                            className={`w-full py-3 text-white text-[18px] font-semibold flex items-center justify-center gap-4 rounded-lg active:scale-[0.98] transition-all duration-200 shadow-sm
                            ${isRedirecting ? 'bg-tertiary-container' : 'bg-[#4C2B74] hover:bg-[#4C2B74]/90 dark:bg-[#4C2B74]'}`}
                        >
                            <span className={isLoading ? 'opacity-50' : ''}>
                                {isRedirecting ? 'Redirecting...' : 'Login'}
                            </span>
                            {isLoading && (
                                <div className="border-2 border-white/30 rounded-full border-top-2 border-t-white w-4 h-4 animate-spin"></div>
                            )}
                        </button>

                    </form>

                    {/* Register Link */}
                    <div className="pt-6 border-t border-outline-variant/30 dark:border-outline/20 text-center">
                        <p className="text-[14px] leading-[20px] font-normal text-on-surface-variant dark:text-surface-variant">
                            Don't have an account?{' '}
                            <Link
                                className="text-[#2D1B4E] dark:text-[#2D1B4E]/80 font-bold hover:underline underline-offset-4"
                                to="/forgot-password"
                                state={{ flow: 'register' }}
                            >
                                Register
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
