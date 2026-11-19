import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Two passcodes, set as environment variables: one for Amira, one for the parent dashboard.
export type Role = "student" | "parent";
const secret = () => process.env.SESSION_SECRET || "dev-secret-change-me";
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");

export function passcodeFor(role: Role) {
  return role === "student" ? process.env.STUDENT_PASSCODE || "amira" : process.env.PARENT_PASSCODE || "parent";
}
export function tokenFor(role: Role) {
  return `${role}.${sign(role)}`;
}
export function verify(token: string | undefined): Role | null {
  if (!token) return null;
  const [role, sig] = token.split(".");
  if (role !== "student" && role !== "parent") return null;
  const a = Buffer.from(sig || ""), b = Buffer.from(sign(role));
  return a.length === b.length && timingSafeEqual(a, b) ? role : null;
}
export async function currentRole(): Promise<Role | null> {
  return verify((await cookies()).get("m_auth")?.value);
}
/** Parent can do everything the student can (useful for testing). */
export async function requireRole(role: Role) {
  const r = await currentRole();
  return r === role || r === "parent";
}
