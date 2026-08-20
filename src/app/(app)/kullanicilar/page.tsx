import React from "react";
import { prisma } from "@/lib/db";
import { requireSession, isAdmin, ROLE_LABELS } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createUserAction, updateRolePermissionsAction, updateUserAction } from "@/lib/actions";
import { EDITABLE_ROLES, PERM_GROUPS, getPermSet } from "@/lib/perm";
import { fmtDate } from "@/lib/format";
import { getLocale } from "@/lib/locale-server";
import { tFor } from "@/lib/i18n";

import { Flash } from "@/components/ui";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; hata?: string }>;
}) {
  const s = await requireSession();
  if (!isAdmin(s)) redirect("/?hata=Bu%20sayfa%20i%C3%A7in%20y%C3%B6netici%20yetkisi%20gerekir.");
  const locale = await getLocale();
  const t = tFor(locale);
  const sp = await searchParams;

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { username: "asc" },
  });
  const rolePerms: Record<string, Set<string>> = {};
  for (const role of EDITABLE_ROLES) {
    rolePerms[role] = await getPermSet(role);
  }

  return (
    <>
      <Flash sp={sp} t={t} />
      <h1>{t("Kullanıcı ve Yetki Yönetimi")}</h1>

      <div className="panel">
        <h2>{t("Yeni Kullanıcı")}</h2>
        <form action={createUserAction} className="inline-form">
          <label>{t("Kullanıcı Adı")}<input type="text" name="username" required autoComplete="off" /></label>
          <label>{t("Ad Soyad")}<input type="text" name="fullName" required /></label>
          <label>{t("Şifre")}<input type="password" name="password" required minLength={6} autoComplete="new-password" /></label>
          <label>{t("Rol")}
            <select name="role" defaultValue="OPERATOR">
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{t(v)}</option>
              ))}
            </select>
          </label>
          <button className="btn primary sm" type="submit">{t("Ekle")}</button>
        </form>
        <p className="muted" style={{ marginBottom: 0 }}>
          {t("Rollerin hangi sayfaları görüp hangi işlemleri yapabileceğini aşağıdaki \"Rol Yetkileri\" tablosundan belirlersiniz.")}
        </p>
      </div>

      <div className="panel">
        <h2>{t("Rol Yetkileri")}</h2>
        <p className="muted">
          {t("İşaretli kutu, o rolün yetkili olduğu anlamına gelir. Yönetici rolü her zaman tüm yetkilere sahiptir ve değiştirilemez. Kullanıcı yönetimi ve kayıt silme yalnızca Yönetici rolündedir.")}
        </p>
        <form action={updateRolePermissionsAction}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("Yetki")}</th>
                  <th style={{ textAlign: "center" }}>{t("Yönetici")}</th>
                  {EDITABLE_ROLES.map((r) => (
                    <th key={r} style={{ textAlign: "center" }}>{t(ROLE_LABELS[r])}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERM_GROUPS.map((g) => (
                  <React.Fragment key={t(g.title)}>
                    <tr>
                      <td colSpan={2 + EDITABLE_ROLES.length} style={{ background: "#f1f5f9", fontWeight: 700 }}>
                        {t(g.title)}
                      </td>
                    </tr>
                    {g.perms.map((perm) => (
                      <tr key={perm.key}>
                        <td>{t(perm.label)}</td>
                        <td style={{ textAlign: "center" }}>
                          <input type="checkbox" checked disabled style={{ width: 18, height: 18 }} />
                        </td>
                        {EDITABLE_ROLES.map((r) => (
                          <td key={r} style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              name={`${r}:${perm.key}`}
                              defaultChecked={rolePerms[r].has(perm.key)}
                              style={{ width: 18, height: 18 }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn primary" type="submit" style={{ marginTop: 12 }}>
            {t("Rol Yetkilerini Kaydet")}
          </button>
        </form>
      </div>

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("Kullanıcı Adı")}</th><th>{t("Ad Soyad")}</th><th>{t("Rol")}</th><th>{t("Durum")}</th>
              <th>{t("Kayıt")}</th><th>{t("Rol Değiştir")}</th><th>{t("Şifre")}</th><th>{t("İşlemler")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.username}</strong></td>
                <td>{u.fullName}</td>
                <td>{t(ROLE_LABELS[u.role])}</td>
                <td>{u.active ? <span className="badge green">{t("Aktif")}</span> : <span className="badge red">{t("Pasif")}</span>}</td>
                <td>{fmtDate(u.createdAt)}</td>
                <td>
                  <form action={updateUserAction.bind(null, u.id)} className="inline-form">
                    <input type="hidden" name="op" value="role" />
                    <select name="role" defaultValue={u.role}>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{t(v)}</option>
                      ))}
                    </select>
                    <button className="btn sm" type="submit">{t("Uygula")}</button>
                  </form>
                </td>
                <td>
                  <form action={updateUserAction.bind(null, u.id)} className="inline-form">
                    <input type="hidden" name="op" value="password" />
                    <input type="password" name="password" placeholder={t("Yeni şifre")} minLength={6} required autoComplete="new-password" />
                    <button className="btn sm" type="submit">{t("Sıfırla")}</button>
                  </form>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <form action={updateUserAction.bind(null, u.id)}>
                      <input type="hidden" name="op" value="toggle" />
                      <ConfirmButton
                        message={`${u.username} ${u.active ? "pasife alınacak" : "aktifleştirilecek"}. Emin misiniz?`}
                        className={`btn sm ${u.active ? "warn" : ""}`}
                      >
                        {u.active ? t("Pasife Al") : t("Aktifleştir")}
                      </ConfirmButton>
                    </form>
                    <form action={updateUserAction.bind(null, u.id)}>
                      <input type="hidden" name="op" value="delete" />
                      <ConfirmButton message={`${u.username} — ${t("Sil")}?`}>
                        {t("Sil")}
                      </ConfirmButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
