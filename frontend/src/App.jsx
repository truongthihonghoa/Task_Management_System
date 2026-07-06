import React from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate
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
import GeneralSettingsPage from "./pages/GeneralSettingsPage";



export default function App() {
    return (
        <BrowserRouter>
            <Routes>

                {/* Authentication */}
                <Route path="/" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Dashboard - Thêm dấu /* vào path để React Router nhận diện chính xác các route con khi click */}
                <Route path="/dashboard/*" element={<MainLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="spaces" element={<SpaceManagement />} />
                    <Route path="tasks/:spaceId?" element={<TaskManagement />} />
                    <Route path="tasks" element={<TaskManagement />} />


                    <Route path ="users" element={<UserManagement />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="help" element={<HelpCenter />} />
                    {/* Nối link trang cài đặt thông báo (nếu cần dùng sau này) */}
                    <Route path="notification-settings" element={<NotificationSettingsPage />} />
                    <Route path="settings/general" element={<GeneralSettingsPage />} />
                </Route>

                {/* Dự phòng trường hợp user vào thẳng /dashboard không có dấu gạch chéo */}
                <Route path="/dashboard" element={<Navigate to="/dashboard/" replace />} />

                {/* Redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
        </BrowserRouter>
    );
}