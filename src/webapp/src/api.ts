import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

// --- Auth ---
export const login = (username: string, password: string) =>
  api.post("/auth/login", { username, password });

// --- Articles ---
export const getArticles = (params: Record<string, string | number>) =>
  api.get("/articles", { params });

export const getArticle = (id: string) => api.get(`/articles/${id}`);

// --- Weekly ---
export const getDigests = (params: Record<string, string | number>) =>
  api.get("/weekly", { params });

export const getDigest = (id: string) => api.get(`/weekly/${id}`);

// --- Search ---
export const search = (params: Record<string, string | number>) =>
  api.get("/search", { params });

// --- Tags ---
export const getTags = () => api.get("/tags");

// --- Upload ---
export const uploadExport = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/upload", form);
};

// --- Admin ---
export const getUsers = () => api.get("/admin/users");
export const createUser = (data: {
  username: string;
  password: string;
  display_name?: string;
  role?: string;
}) => api.post("/admin/users", data);
export const getLogs = () => api.get("/admin/logs");
