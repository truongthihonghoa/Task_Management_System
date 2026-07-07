import React, { useState, useEffect } from "react";

export default function ChangePasswordSection() {
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [showPasswords, passwordStrength]);

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;

    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "newPassword") {
      let strength = 0;

      if (value.length >= 8) strength += 20;
      if (/[A-Z]/.test(value)) strength += 20;
      if (/[a-z]/.test(value)) strength += 20;
      if (/[0-9]/.test(value)) strength += 20;
      if (/[^A-Za-z0-9]/.test(value)) strength += 20;

      setPasswordStrength(strength);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const getStrengthColor = () => {
    if (passwordStrength <= 20) return "bg-red-500";
    if (passwordStrength <= 40) return "bg-orange-500";
    if (passwordStrength <= 60) return "bg-yellow-500";
    if (passwordStrength <= 80) return "bg-blue-500";
    return "bg-green-500";
  };

  const getStrengthText = () => {
    if (passwordStrength <= 20) return "Weak";
    if (passwordStrength <= 40) return "Fair";
    if (passwordStrength <= 60) return "Good";
    if (passwordStrength <= 80) return "Strong";
    return "Very Strong";
  };

  const isMinLength = passwordData.newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(passwordData.newPassword);
  const hasLowercase = /[a-z]/.test(passwordData.newPassword);
  const hasNumber = /[0-9]/.test(passwordData.newPassword);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(passwordData.newPassword);

  const renderStatusIcon = (isValid) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        isValid
          ? "text-green-600 flex-shrink-0"
          : "text-gray-400 flex-shrink-0"
      }
    >
      {isValid ? (
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4l-12 10.01-3-3" />
      ) : (
        <circle cx="12" cy="12" r="10" />
      )}
    </svg>
  );

  return (
    <div className="border-t border-gray-200 pt-6 mt-6">

      <h3 className="text-lg font-semibold text-gray-900 mb-5">
        Change Password
      </h3>

      <div className="space-y-4">

        {[
          {
            label: "Current Password",
            name: "currentPassword",
            key: "current",
          },
          {
            label: "New Password",
            name: "newPassword",
            key: "new",
          },
          {
            label: "Confirm Password",
            name: "confirmPassword",
            key: "confirm",
          },
        ].map((item) => (
          <div key={item.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {item.label}
            </label>

            <div className="relative">
              <input
                type={showPasswords[item.key] ? "text" : "password"}
                name={item.name}
                value={passwordData[item.name]}
                onChange={handlePasswordChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2D1B4E] pr-12"
              />

              <button
                type="button"
                onClick={() => togglePasswordVisibility(item.key)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <i
                  className="w-4 h-4 text-gray-500"
                  data-lucide={
                    showPasswords[item.key] ? "eye-off" : "eye"
                  }
                ></i>
              </button>
            </div>
          </div>
        ))}

        {passwordData.newPassword && (
          <div className="bg-gray-50 rounded-lg p-3">

            <div className="flex justify-between text-sm mb-2">
              <span>Password Strength</span>

              <span className="font-semibold">
                {getStrengthText()}
              </span>
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

          <p className="text-sm font-semibold mb-2">
            Password Requirements
          </p>

          <div className="space-y-2 text-sm">

            <div className="flex items-center gap-2">
              {renderStatusIcon(isMinLength)}
              <span>Minimum 8 characters</span>
            </div>

            <div className="flex items-center gap-2">
              {renderStatusIcon(hasUppercase)}
              <span>One uppercase letter</span>
            </div>

            <div className="flex items-center gap-2">
              {renderStatusIcon(hasLowercase)}
              <span>One lowercase letter</span>
            </div>

            <div className="flex items-center gap-2">
              {renderStatusIcon(hasNumber)}
              <span>One number</span>
            </div>

            <div className="flex items-center gap-2">
              {renderStatusIcon(hasSpecialChar)}
              <span>One special character</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
