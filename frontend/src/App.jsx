import React from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    useLocation
} from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";

import MainLayout from "./components/layout/MainLayout";
import SpaceManagement from "./pages/SpaceManagement";
import TaskManagement from "./pages/TaskManagement";
import Dashboard from "./pages/Dashboard";
import UserManagement from "./pages/UserManagement";
import ProfilePage from "./pages/ProfilePage";
import HelpCenter from "./pages/HelpCenter";
import NotificationSettingsPage from "./pages/NotificationSettingsPage";
import { LanguageProvider } from "./context/LanguageContext";

/**
 * Redirect /dashboard → /dashboard/ while preserving query params.
 */
function DashboardRedirect() {
    const location = useLocation();
    return <Navigate to={`/dashboard/${location.search}`} replace />;
}

function AppRoutes() {
    const location = useLocation();

    return (
        <Routes location={location} key={location.pathname}>
            {/* Authentication */}
            <Route path="/" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected layout */}
            <Route path="/dashboard/*" element={<MainLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="spaces" element={<SpaceManagement />} />
                <Route path="tasks" element={<TaskManagement />} />
                <Route path="tasks/:spaceId?" element={<TaskManagement />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="help" element={<HelpCenter />} />
                <Route path="notification-settings" element={<NotificationSettingsPage />} />
            </Route>

            <Route path="/dashboard" element={<DashboardRedirect />} />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function App() {
    return (
        <LanguageProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </LanguageProvider>
    );
}