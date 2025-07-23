import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:3001";

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    );
  }

  setAuthToken(token) {
    if (token) {
      this.client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common["Authorization"];
    }
  }

  // Auth endpoints
  auth = {
    login: (email, password) =>
      this.client.post("/auth/login", { email, password }),

    register: (userData) => this.client.post("/auth/register", userData),

    logout: () => this.client.post("/auth/logout"),

    verifyToken: () => this.client.post("/auth/verify"),

    getProfile: () => this.client.get("/auth/profile"),

    updateProfile: (profileData) =>
      this.client.put("/auth/profile", profileData),
  };

  // Task endpoints
  tasks = {
    getAll: (params = {}) => this.client.get("/tasks", { params }),

    getById: (id) => this.client.get(`/tasks/${id}`),

    create: (taskData) => this.client.post("/tasks", taskData),

    update: (id, taskData) => this.client.put(`/tasks/${id}`, taskData),

    delete: (id) => this.client.delete(`/tasks/${id}`),

    updateStatus: (id, status) =>
      this.client.patch(`/tasks/${id}/status`, { status }),

    assign: (id, userId) =>
      this.client.patch(`/tasks/${id}/assign`, { userId }),

    addWatcher: (id, userId) =>
      this.client.post(`/tasks/${id}/watchers`, { userId }),

    removeWatcher: (id, userId) =>
      this.client.delete(`/tasks/${id}/watchers/${userId}`),

    getByUser: (userId) => this.client.get(`/tasks/user/${userId}`),

    getStats: () => this.client.get("/tasks/stats"),
  };

  // Comment endpoints
  comments = {
    getByTask: (taskId) => this.client.get(`/comments/task/${taskId}`),

    getById: (id) => this.client.get(`/comments/${id}`),

    create: (commentData) => this.client.post("/comments", commentData),

    update: (id, commentData) =>
      this.client.put(`/comments/${id}`, commentData),

    delete: (id) => this.client.delete(`/comments/${id}`),

    getByUser: (userId) => this.client.get(`/comments/user/${userId}`),
  };

  // Admin endpoints
  admin = {
    getUsers: (params = {}) => this.client.get("/admin/users", { params }),

    getUserById: (id) => this.client.get(`/admin/users/${id}`),

    updateUser: (id, userData) =>
      this.client.put(`/admin/users/${id}`, userData),

    deleteUser: (id) => this.client.delete(`/admin/users/${id}`),

    resetPassword: (id, newPassword) =>
      this.client.post(`/admin/users/${id}/reset-password`, {
        newPassword,
      }),

    getStats: () => this.client.get("/admin/stats"),
  };

  // Health check
  health = {
    check: () => this.client.get("/health"),
  };
}

export const api = new ApiService();
export default api;
