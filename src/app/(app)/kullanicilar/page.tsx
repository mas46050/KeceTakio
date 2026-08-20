import React from "react";
import { prisma } from "@/lib/db";
import { requireSession, isAdmin, ROLE_LABELS } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createUserAction, updateRolePermissionsAction, updateUserAction } from "@/lib/actions";
import { EDITABLE_ROLES, PERM_GROUPS, getPermSet } from "@/lib/perm";
import { fmtDate } from "@/lib/format";
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
      <Flash sp={sp} />
      <h1>Kullanıcı ve Yetki Yönetimi</h1>

      <div className="panel">
        <h2>Yeni Kullanıcı</h2>
        <form action={createUserAction} className="inline-form">
          <label>Kullanıcı Adı<input type="text" name="username" required autoComplete="off" /></label>
          <label>Ad Soyad<input type="text" name="fullName" required /></label>
          <label>Şifre<input type="password" name="password" required minLength={6} autoComplete="new-password" /></label>
          <label>Rol
            <select name="role" defaultValue="OPERATOR">
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <button className="btn primary sm" type="submit">Ekle</button>
        </form>
        <p className="muted" style={{ marginBottom: 0 }}>
          Rollerin hangi sayfaları görüp hangi işlemleri yapabileceğini aşağıdaki
          &quot;Rol Yetkileri&quot; tablosundan belirlersiniz.
        </p>
      </div>

      <div className="panel">
        <h2>Rol Yetkileri</h2>
        <p className="muted">
          İşaretli kutu, o rolün yetkili olduğu anlamına gelir. Yönetici rolü her zaman tüm
          yetkilere sahiptir ve değiştirilemez. Kullanıcı yönetimi ve kayıt silme yalnızca
          Yönetici rolündedir.
        </p>
        <form action={updateRolePermissionsAction}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Yetki</th>
                  <th style={{ textAlign: "center" }}>Yönetici</th>
                  {EDITABLE_ROLES.map((r) => (
                    <th key={r} style={{ textAlign: "center" }}>{ROLE_LABELS[r]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERM_GROUPS.map((g) => (
                  <React.Fragment key={g.title}>
                    <tr>
                      <td colSpan={2 + EDITABLE_ROLES.length} style={{ background: "#f1f5f9", fontWeight: 700 }}>
                        {g.title}
                      </td>
                    </tr>
                    {g.perms.map((perm) => (
                      <tr key={perm.key}>
                        <td>{perm.label}</td>
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
            Rol Yetkilerini Kaydet
          </button>
        </form>
      </div>

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kullanıcı Adı</th><th>Ad Soyad</th><th>Rol</th><th>Durum</th>
              <th>Kayıt</th><th>Rol Değiştir</th><th>Şifre</th><th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.username}</strong></td>
                <td>{u.fullName}</td>
                <td>{ROLE_LABELS[u.role]}</td>
                <td>{u.active ? <span className="badge green">Aktif</span> : <span className="badge red">Pasif</span>}</td>
                <td>{fmtDate(u.createdAt)}</td>
                <td>
                  <form action={updateUserAction.bind(null, u.id)} className="inline-form">
                    <input type="hidden" name="op" value="role" />
                    <select name="role" defaultValue={u.role}>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <button className="btn sm" type="submit">Uygula</button>
                  </form>
                </td>
                <td>
                  <form action={updateUserAction.bind(null, u.id)} className="inline-form">
                    <input type="hidden" name="op" value="password" />
                    <input type="password" name="password" placeholder="Yeni şifre" minLength={6} required autoComplete="new-password" />
                    <button className="btn sm" type="submit">Sıfırla</button>
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
                        {u.active ? "Pasife Al" : "Aktifleştir"}
                      </ConfirmButton>
                    </form>
                    <form action={updateUserAction.bind(null, u.id)}>
                      <input type="hidden" name="op" value="delete" />
                      <ConfirmButton message={`${u.username} kullanıcısı silinecek. Emin misiniz?`}>
                        Sil
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
