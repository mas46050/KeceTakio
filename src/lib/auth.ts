import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";

export type Session = {
  uid: number;
  username: string;
  fullName: string;
  role: "YONETICI" | "BAKIM" | "OPERATOR" | "IZLEYICI";
};

const COOKIE = "kt_session";
const secret = () =>
  new TextEncoder().encode(process.env.SESSION_SECRET || "kecetakip-dev-secret");

export async function createSession(s: Session) {
  const token = await new SignJWT(s)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

// Yetki kuralları
export const isAdmin = (s: Session) => s.role === "YONETICI";
// Montaj, söküm, ürün/stok kayıtları
export const canOperate = (s: Session) => s.role === "YONETICI" || s.role === "BAKIM";
// Yıkama ve ölçüm gibi rutin saha kayıtları
export const canEnterTech = (s: Session) => s.role !== "IZLEYICI";

export const ROLE_LABELS: Record<Session["role"], string> = {
  YONETICI: "Yönetici",
  BAKIM: "Bakım",
  OPERATOR: "Operatör",
  IZLEYICI: "Görüntüleyici",
};
