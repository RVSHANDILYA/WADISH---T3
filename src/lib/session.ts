// Demo personalisation only. This is not authentication or an access boundary.
export const roles = [
  { id: "ed", name: "Emergency care", description: "Understand visits and demand", home: "evidence", group: "frequent" },
  { id: "aged", name: "Aged & complex care", description: "See hospital time and support needs", home: "overview", group: "acute" },
  { id: "primary", name: "Community planning", description: "Explore support outside hospital", home: "scenario", group: "recurrent" },
] as const;
export type RoleId = typeof roles[number]["id"];
export type DemoSession = { name: string; roleId: RoleId };
const key = "carepath-demo-session";

export function loadSession(): DemoSession | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (saved && typeof saved.name === "string" && roles.some(role => role.id === saved.roleId))
      return { name: saved.name.slice(0, 60), roleId: saved.roleId };
  } catch { /* Private browsing or a malformed saved session: start at sign-in. */ }
  return null;
}
export function saveSession(session: DemoSession) {
  try { sessionStorage.setItem(key, JSON.stringify(session)); } catch { /* In-memory session still works. */ }
}
export function clearSession() {
  try { sessionStorage.removeItem(key); } catch { /* In-memory session still clears. */ }
}
