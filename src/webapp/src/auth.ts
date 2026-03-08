export interface UserInfo {
  id: string;
  username: string;
  display_name: string | null;
  role: string;
}

export function getStoredUser(): UserInfo | null {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: UserInfo) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem("token");
}

export function isAdmin(): boolean {
  const user = getStoredUser();
  return user?.role === "admin";
}
