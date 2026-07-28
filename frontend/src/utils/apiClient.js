import axios from "axios";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const REFRESH_URL = API_BASE_URL.endsWith("/api/v1")
    ? `${API_BASE_URL}/auth/refresh`
    : `${API_BASE_URL}/api/v1/auth/refresh`;

// Centralized token getter helpers matching different storage keys used across components
export const getAccessToken = () => {
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("token")
    );
};

export const getRefreshToken = () => {
    return (
        localStorage.getItem("refresh_token") ||
        localStorage.getItem("refreshToken")
    );
};

export const setTokens = (accessToken, refreshToken) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("token", accessToken);
    if (refreshToken) {
        localStorage.setItem("refresh_token", refreshToken);
        localStorage.setItem("refreshToken", refreshToken);
    }
};

export const clearTokens = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
};

// Create main apiClient instance
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Interceptor to attach Access Token on outgoing requests
apiClient.interceptors.request.use(
    (config) => {
        const token = getAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Flag to track the refresh token request state
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Interceptor to handle expired tokens (401 response status)
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config || {};

        // Skip interceptor if error is not 401 or if request was already retried
        if (!error.response || error.response.status !== 401 || originalRequest._retry) {
            return Promise.reject(error);
        }

        // Avoid infinite loop if the refresh endpoint itself returns 401
        if ((originalRequest.url || "").includes("/api/v1/auth/refresh") || (originalRequest.url || "").includes("/auth/refresh")) {
            clearTokens();
            window.location.href = "/";
            return Promise.reject(error);
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            })
                .then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return apiClient(originalRequest);
                })
                .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            clearTokens();
            isRefreshing = false;
            window.location.href = "/";
            return Promise.reject(error);
        }

        try {
            // Call refresh endpoint with basic axios instance to avoid recursion
            const response = await axios.post(REFRESH_URL, {
                refresh_token: refreshToken,
            });

            const { access_token, refresh_token: newRefreshToken } = response.data;
            setTokens(access_token, newRefreshToken);

            apiClient.defaults.headers.common.Authorization = `Bearer ${access_token}`;
            originalRequest.headers.Authorization = `Bearer ${access_token}`;

            processQueue(null, access_token);
            isRefreshing = false;
            return apiClient(originalRequest);
        } catch (refreshError) {
            processQueue(refreshError, null);
            clearTokens();
            isRefreshing = false;
            window.location.href = "/";
            return Promise.reject(refreshError);
        }
    }
);

export default apiClient;
