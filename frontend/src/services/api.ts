import axios, { AxiosInstance, AxiosResponse } from "axios";
import {
  User,
  RegisterData,
  LoginData,
  AuthResponse,
  Task,
  CreateTaskData,
  UpdateTaskData,
  Comment,
  CreateCommentData,
  ApiResponse
} from "../types";

const API_BASE_URL =
  import.meta.env.VITE_REACT_APP_API_URL || "http://localhost:3001";

class ApiService {
  private client: AxiosInstance;

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

  setAuthToken(token: string | null): void {
    if (token) {
      this.client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common["Authorization"];
    }
  }

  // Auth endpoints
  auth = {
    login: (email: string, password: string): Promise<AxiosResponse<AuthResponse>> =>
      this.client.post("/auth/login", { email, password }),

    register: (userData: RegisterData): Promise<AxiosResponse<AuthResponse>> =>
      this.client.post("/auth/register", userData),

    logout: (): Promise<AxiosResponse<{ message: string }>> =>
      this.client.post("/auth/logout"),

    verifyToken: (): Promise<AxiosResponse<{ valid: boolean; user: User }>> =>
      this.client.post("/auth/verify"),

    getProfile: (): Promise<AxiosResponse<{ user: User }>> =>
      this.client.get("/auth/profile"),

    updateProfile: (profileData: Partial<RegisterData>): Promise<AxiosResponse<{ user: User }>> =>
      this.client.put("/auth/profile", profileData),
  };

  // Task endpoints
  tasks = {
    getAll: (params: Record<string, any> = {}): Promise<AxiosResponse<Task[]>> =>
      this.client.get("/tasks", { params }),

    getById: (id: string): Promise<AxiosResponse<Task>> =>
      this.client.get(`/tasks/${id}`),

    create: (taskData: CreateTaskData): Promise<AxiosResponse<Task>> =>
      this.client.post("/tasks", taskData),

    update: (id: string, taskData: UpdateTaskData): Promise<AxiosResponse<Task>> =>
      this.client.put(`/tasks/${id}`, taskData),

    delete: (id: string): Promise<AxiosResponse<{ message: string }>> =>
      this.client.delete(`/tasks/${id}`),

    updateStatus: (id: string, status: Task['status']): Promise<AxiosResponse<Task>> =>
      this.client.patch(`/tasks/${id}/status`, { status }),

    assign: (id: string, userId: string): Promise<AxiosResponse<Task>> =>
      this.client.patch(`/tasks/${id}/assign`, { userId }),

    addWatcher: (id: string, userId: string): Promise<AxiosResponse<{ message: string }>> =>
      this.client.post(`/tasks/${id}/watchers`, { userId }),

    removeWatcher: (id: string, userId: string): Promise<AxiosResponse<{ message: string }>> =>
      this.client.delete(`/tasks/${id}/watchers/${userId}`),

    getByUser: (userId: string): Promise<AxiosResponse<Task[]>> =>
      this.client.get(`/tasks/user/${userId}`),

    getStats: (): Promise<AxiosResponse<Record<string, number>>> =>
      this.client.get("/tasks/stats"),
  };

  // Comment endpoints
  comments = {
    getByTask: (taskId: string): Promise<AxiosResponse<Comment[]>> =>
      this.client.get(`/comments/task/${taskId}`),

    getById: (id: string): Promise<AxiosResponse<Comment>> =>
      this.client.get(`/comments/${id}`),

    create: (commentData: CreateCommentData): Promise<AxiosResponse<Comment>> =>
      this.client.post("/comments", commentData),

    update: (id: string, commentData: Partial<CreateCommentData>): Promise<AxiosResponse<Comment>> =>
      this.client.put(`/comments/${id}`, commentData),

    delete: (id: string): Promise<AxiosResponse<{ message: string }>> =>
      this.client.delete(`/comments/${id}`),

    getByUser: (userId: string): Promise<AxiosResponse<Comment[]>> =>
      this.client.get(`/comments/user/${userId}`),
  };

  // Admin endpoints
  admin = {
    getUsers: (params: Record<string, any> = {}): Promise<AxiosResponse<User[]>> =>
      this.client.get("/admin/users", { params }),

    getUserById: (id: string): Promise<AxiosResponse<User>> =>
      this.client.get(`/admin/users/${id}`),

    updateUser: (id: string, userData: Partial<RegisterData>): Promise<AxiosResponse<User>> =>
      this.client.put(`/admin/users/${id}`, userData),

    deleteUser: (id: string): Promise<AxiosResponse<{ message: string }>> =>
      this.client.delete(`/admin/users/${id}`),

    resetPassword: (id: string, newPassword: string): Promise<AxiosResponse<{ message: string }>> =>
      this.client.post(`/admin/users/${id}/reset-password`, {
        newPassword,
      }),

    getStats: (): Promise<AxiosResponse<Record<string, number>>> =>
      this.client.get("/admin/stats"),
  };

  // Health check
  health = {
    check: (): Promise<AxiosResponse<{ status: string; timestamp: string }>> =>
      this.client.get("/health"),
  };
}

export const api = new ApiService();
export default api;