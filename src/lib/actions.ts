"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import {
  createSession,
  destroySession,
  getSession,
  isAdmin,
  ROLE_LABELS,
  type Session,
} from "./auth";
import { getPermSet, CONFIGURED_MARKER, EDITABLE_ROLES, ALL_PERMS } from "./perm";
import { parseDateInput } from "./format";
import { calcLife } from "./life";

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function fail(back: string, msg: string): never {
  const sep = back.includes("?") ? "&" : "?";
  redirect(`${back}${sep}hata=${encodeURIComponent(msg)}`);
}

function done(to: string, msg?: string): never {
  const sep = to.includes("?") ? "&" : "?";
  redirect(msg ? `${to}${sep}ok=${encodeURIComponent(msg)}` : to);
}

function str(fd: FormData, key: string): string {
  return (fd.get(key)?.toString() ?? "").trim();
}

function num(fd: FormData, key: string): number | null {
  const v = str(fd, key).replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function int(fd: FormData, key: string): number | null {
  const n = num(fd, key);
  return n === null ? null : Math.round(n);
}

async function audit(
  s: Session | null,
  action: string,
  description: string,
  entity = "",
  entityId?: number
) {
  await prisma.auditLog.create({
    data: { userId: s?.uid ?? null, action, entity, entityId: entityId ?? null, description },
  });
}

async function requirePerm(perm: string, back: string): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  const perms = await getPermSet(s.role);
  if (!perms.has(perm)) fail(back, "Bu işlem için yetkiniz yok.");
  return s;
}

async function requireRole(check: (s: Session) => boolean, back: string): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!check(s)) fail(back, "Bu işlem için yetkiniz yok.");
  return s;
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Oturum
// ---------------------------------------------------------------------------

export async function loginAction(fd: FormData) {
  const username = str(fd, "username");
  const password = str(fd, "password");
  const user = await prisma.user.findFirst({
    where: { username, active: true, deletedAt: null },
  });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    fail("/login", "Kullanıcı adı veya şifre hatalı.");
  }
  const s: Session = {
    uid: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
  };
  await createSession(s);
  await audit(s, "SISTEM", `${user.fullName} sisteme giriş yaptı.`);
  redirect("/");
}

export async function logoutAction() {
  const s = await getSession();
  if (s) await audit(s, "SISTEM", `${s.fullName} sistemden çıkış yaptı.`);
  await destroySession();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Ürün (elek/keçe kartı) ve stok
// ---------------------------------------------------------------------------

async function nextCode(type: "ELEK" | "KECE"): Promise<string> {
  const prefix = type === "ELEK" ? "ELK" : "KCE";
  const last = await prisma.product.findFirst({
    where: { code: { startsWith: prefix + "-" } },
    orderBy: { id: "desc" },
    select: { code: true },
  });
  let n = last ? parseInt(last.code.split("-")[1] || "0", 10) : 0;
  // benzersizlik garantisi
  for (;;) {
    n += 1;
    const code = `${prefix}-${String(n).padStart(4, "0")}`;
    const exists = await prisma.product.findUnique({ where: { code } });
    if (!exists) return code;
  }
}

async function resolveNamed(
  table: "manufacturer" | "supplier",
  fd: FormData,
  idKey: string,
  newKey: string
): Promise<number | null> {
  const newName = str(fd, newKey);
  if (newName) {
    const model = table === "manufacturer" ? prisma.manufacturer : prisma.supplier;
    const found = await (model as typeof prisma.manufacturer).findUnique({
      where: { name: newName },
    });
    if (found) return found.id;
    const created = await (model as typeof prisma.manufacturer).create({
      data: { name: newName },
    });
    return created.id;
  }
  return int(fd, idKey);
}

function productDataFromForm(fd: FormData) {
  return {
    brand: str(fd, "brand"),
    productCode: str(fd, "productCode"),
    serialNo: str(fd, "serialNo"),
    orderNo: str(fd, "orderNo"),
    widthMm: num(fd, "widthMm"),
    lengthMm: num(fd, "lengthMm"),
    gsm: num(fd, "gsm"),
    thicknessMm: num(fd, "thicknessMm"),
    permeability: num(fd, "permeability"),
    construction: str(fd, "construction"),
    purchaseDate: str(fd, "purchaseDate") ? parseDateInput(str(fd, "purchaseDate")) : null,
    deliveryDate: str(fd, "deliveryDate") ? parseDateInput(str(fd, "deliveryDate")) : null,
    unitPrice: num(fd, "unitPrice") ?? 0,
    currency: str(fd, "currency") || "TRY",
    expectedLifeDays: int(fd, "expectedLifeDays") ?? 60,
    warehouseLocation: str(fd, "warehouseLocation"),
    shelfLocation: str(fd, "shelfLocation"),
    notes: str(fd, "notes"),
    positionId: int(fd, "positionId"),
  };
}

export async function createProductAction(fd: FormData) {
  const back = "/urunler/yeni";
  const s = await requirePerm("islem_urun", back);
  const type = str(fd, "type") === "ELEK" ? "ELEK" : "KECE";
  const data = productDataFromForm(fd);
  const manufacturerId = await resolveNamed("manufacturer", fd, "manufacturerId", "newManufacturer");
  const supplierId = await resolveNamed("supplier", fd, "supplierId", "newSupplier");
  const code = await nextCode(type);
  const product = await prisma.product.create({
    data: {
      ...data,
      code,
      type,
      manufacturerId,
      supplierId,
      status: "STOKTA",
      stockDate: new Date(),
    },
  });
  await prisma.stockMovement.create({
    data: {
      productId: product.id,
      type: "GIRIS",
      note: `Stok girişi: ${code} ${data.brand} ${data.productCode}`.trim(),
      userId: s.uid,
    },
  });
  await audit(s, "GIRIS", `Yeni ${type === "ELEK" ? "elek" : "keçe"} kaydı ve stok girişi: ${code}`, "Product", product.id);
  refresh();
  done(`/urunler/${product.id}`, "Kayıt oluşturuldu ve stoğa alındı.");
}

export async function updateProductAction(id: number, fd: FormData) {
  const back = `/urunler/${id}/duzenle`;
  const s = await requirePerm("islem_urun", back);
  const data = productDataFromForm(fd);
  const manufacturerId = await resolveNamed("manufacturer", fd, "manufacturerId", "newManufacturer");
  const supplierId = await resolveNamed("supplier", fd, "supplierId", "newSupplier");
  const p = await prisma.product.update({
    where: { id },
    data: { ...data, manufacturerId, supplierId },
  });
  await audit(s, "TANIM", `Ürün kartı güncellendi: ${p.code}`, "Product", id);
  refresh();
  done(`/urunler/${id}`, "Kart güncellendi.");
}

const MANUAL_STATUSES = ["STOKTA", "REZERVE", "TAMIRDE", "HURDA", "KULLANILMIS"] as const;

export async function setProductStatusAction(id: number, fd: FormData) {
  const back = `/urunler/${id}`;
  const s = await requirePerm("islem_urun", back);
  const status = str(fd, "status") as (typeof MANUAL_STATUSES)[number];
  if (!MANUAL_STATUSES.includes(status)) fail(back, "Geçersiz durum.");
  if (status === "HURDA" && !isAdmin(s)) fail(back, "Hurda kararı için yönetici yetkisi gerekir.");
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) fail(back, "Ürün bulunamadı.");
  if (p.status === "MAKINEDE") fail(back, "Makinedeki ürünün durumu söküm yapılmadan değiştirilemez.");
  await prisma.product.update({ where: { id }, data: { status } });
  await prisma.stockMovement.create({
    data: { productId: id, type: "DURUM", note: `${p.status} → ${status}`, userId: s.uid },
  });
  await audit(s, "DURUM", `${p.code} durumu değiştirildi: ${p.status} → ${status}`, "Product", id);
  refresh();
  done(back, "Durum güncellendi.");
}

export async function deleteProductAction(id: number) {
  const s = await requireRole(isAdmin, `/urunler/${id}`);
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) fail("/urunler", "Ürün bulunamadı.");
  if (p.status === "MAKINEDE") fail(`/urunler/${id}`, "Makinedeki ürün silinemez. Önce söküm yapın.");
  await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(s, "TANIM", `Ürün kaydı silindi (soft-delete): ${p.code}`, "Product", id);
  refresh();
  done("/urunler", "Kayıt silindi (geçmiş korunur).");
}

// ---------------------------------------------------------------------------
// Montaj / Söküm
// ---------------------------------------------------------------------------

export async function montajAction(fd: FormData) {
  const back = "/montaj";
  const s = await requirePerm("islem_montaj", back);
  const productId = int(fd, "productId");
  const positionId = int(fd, "positionId");
  const dateStr = str(fd, "installDate");
  const timeStr = str(fd, "installTime");
  if (!productId || !positionId || !dateStr) fail(back, "Malzeme, pozisyon ve tarih zorunludur.");

  const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
  const position = await prisma.position.findFirst({ where: { id: positionId, deletedAt: null } });
  if (!product || !position) fail(back, "Malzeme veya pozisyon bulunamadı.");
  if (!["YENI", "STOKTA", "REZERVE", "KULLANILMIS"].includes(product.status)) {
    fail(back, `Bu malzeme montaja uygun durumda değil (durum: ${product.status}).`);
  }
  if (product.type !== position.type) {
    fail(back, "Malzeme tipi ile pozisyon tipi uyuşmuyor (elek pozisyonuna keçe takılamaz).");
  }
  const activeOnPosition = await prisma.installation.findFirst({
    where: { positionId, active: true },
    include: { product: true },
  });
  if (activeOnPosition) {
    fail(
      back,
      `DİKKAT: ${position.name} pozisyonunda zaten aktif bir ürün var (${activeOnPosition.product.code}). ` +
        `Önce mevcut ürünün sökümünü kaydedin.`
    );
  }

  const installDate = parseDateInput(dateStr, timeStr);
  const inst = await prisma.installation.create({
    data: {
      productId,
      positionId,
      installDate,
      machineCounterStart: num(fd, "machineCounter"),
      expectedLifeDays: int(fd, "expectedLifeDays") ?? product.expectedLifeDays,
      installNote: str(fd, "note"),
      installedById: s.uid,
    },
  });
  await prisma.product.update({
    where: { id: productId },
    data: { status: "MAKINEDE", positionId },
  });
  await prisma.stockMovement.create({
    data: {
      productId,
      type: "MONTAJ",
      note: `${position.machineName} / ${position.name} pozisyonuna montaj`,
      userId: s.uid,
    },
  });
  await audit(
    s,
    "MONTAJ",
    `${product.code} → ${position.machineName} / ${position.name} montajı yapıldı.`,
    "Installation",
    inst.id
  );
  refresh();
  done(`/urunler/${productId}`, "Montaj kaydedildi, ürün 'Makinede' durumuna geçti.");
}

export async function sokumAction(installationId: number, fd: FormData) {
  const back = `/sokum/${installationId}`;
  const s = await requirePerm("islem_montaj", back);
  const inst = await prisma.installation.findFirst({
    where: { id: installationId, active: true },
    include: { product: true, position: true },
  });
  if (!inst) fail("/", "Aktif montaj kaydı bulunamadı.");
  const dateStr = str(fd, "removeDate");
  const failureReasonId = int(fd, "failureReasonId");
  const decision = str(fd, "decision") === "HURDA" ? "HURDA" : "KULLANILABILIR";
  if (!dateStr || !failureReasonId) fail(back, "Söküm tarihi ve söküm nedeni zorunludur.");
  const removeDate = parseDateInput(dateStr, str(fd, "removeTime"));
  if (removeDate.getTime() < new Date(inst.installDate).getTime()) {
    fail(back, "Söküm tarihi montaj tarihinden önce olamaz.");
  }

  await prisma.installation.update({
    where: { id: installationId },
    data: {
      active: false,
      removeDate,
      machineCounterEnd: num(fd, "machineCounter"),
      failureReasonId,
      removalNote: str(fd, "note"),
      removalDecision: decision,
      removedById: s.uid,
    },
  });
  const newStatus = decision === "HURDA" ? "HURDA" : "KULLANILMIS";
  await prisma.product.update({
    where: { id: inst.productId },
    data: { status: newStatus },
  });

  // hasar fotoğrafı (opsiyonel)
  const photo = fd.get("damagePhoto");
  if (photo instanceof File && photo.size > 0) {
    await saveAttachment(photo, s, { installationId, kind: "HASAR" }, back);
  }

  const reason = await prisma.failureReason.findUnique({ where: { id: failureReasonId } });
  const life = calcLife(inst.installDate, inst.expectedLifeDays, removeDate);
  await prisma.stockMovement.create({
    data: {
      productId: inst.productId,
      type: "SOKUM",
      note: `${inst.position.name} söküm — ${reason?.name ?? ""} — karar: ${newStatus}`,
      userId: s.uid,
    },
  });
  await audit(
    s,
    "SOKUM",
    `${inst.product.code} söküldü (${inst.position.machineName} / ${inst.position.name}). ` +
      `Neden: ${reason?.name ?? "—"}. ${life.workingDays} gün çalıştı. Karar: ${newStatus}.`,
    "Installation",
    installationId
  );
  refresh();
  done(`/urunler/${inst.productId}`, `Söküm kaydedildi (${life.workingDays} gün çalıştı).`);
}

// ---------------------------------------------------------------------------
// Yıkama & Ölçüm
// ---------------------------------------------------------------------------

export async function addWashAction(installationId: number, fd: FormData) {
  const inst = await prisma.installation.findUnique({
    where: { id: installationId },
    include: { product: true, position: true },
  });
  const back = inst ? `/urunler/${inst.productId}` : "/";
  const s = await requirePerm("islem_yikama_olcum", back);
  if (!inst || !inst.active) fail(back, "Yıkama kaydı yalnızca makinedeki ürünler için eklenebilir.");
  const dateStr = str(fd, "washDate");
  if (!dateStr) fail(back, "Yıkama tarihi zorunludur.");
  await prisma.wash.create({
    data: {
      installationId,
      washDate: parseDateInput(dateStr, str(fd, "washTime")),
      washType: str(fd, "washType") || "Kostik yıkama",
      chemical: str(fd, "chemical"),
      durationMin: int(fd, "durationMin"),
      note: str(fd, "note"),
      userId: s.uid,
    },
  });
  await audit(
    s,
    "YIKAMA",
    `${inst.product.code} (${inst.position.name}) — ${str(fd, "washType") || "Kostik yıkama"} yapıldı.`,
    "Installation",
    installationId
  );
  refresh();
  done(back, "Yıkama kaydı eklendi.");
}

export async function addMeasurementAction(installationId: number, fd: FormData) {
  const inst = await prisma.installation.findUnique({
    where: { id: installationId },
    include: { product: true, position: true },
  });
  const back = inst ? `/urunler/${inst.productId}` : "/";
  const s = await requirePerm("islem_yikama_olcum", back);
  if (!inst || !inst.active) fail(back, "Ölçüm yalnızca makinedeki ürünler için eklenebilir.");
  const dateStr = str(fd, "measureDate");
  if (!dateStr) fail(back, "Ölçüm tarihi zorunludur.");
  const thicknessMm = num(fd, "thicknessMm");
  const permeabilityCfm = num(fd, "permeabilityCfm");
  const moisturePct = num(fd, "moisturePct");
  const vacuumKpa = num(fd, "vacuumKpa");
  if ([thicknessMm, permeabilityCfm, moisturePct, vacuumKpa].every((v) => v === null)) {
    fail(back, "En az bir ölçüm değeri girmelisiniz.");
  }
  await prisma.measurement.create({
    data: {
      installationId,
      measureDate: parseDateInput(dateStr),
      thicknessMm,
      permeabilityCfm,
      moisturePct,
      vacuumKpa,
      note: str(fd, "note"),
      userId: s.uid,
    },
  });
  await audit(
    s,
    "OLCUM",
    `${inst.product.code} (${inst.position.name}) haftalık ölçüm kaydedildi.`,
    "Installation",
    installationId
  );
  refresh();
  done(back, "Ölçüm kaydı eklendi.");
}

// ---------------------------------------------------------------------------
// Dosya ekleri (fotoğraf / teknik doküman / hasar)
// ---------------------------------------------------------------------------

const MAX_FILE = 10 * 1024 * 1024;

async function saveAttachment(
  file: File,
  s: Session,
  target: { productId?: number; installationId?: number; kind: "FOTO" | "DOKUMAN" | "HASAR" },
  back: string
) {
  if (file.size > MAX_FILE) fail(back, "Dosya 10 MB'den büyük olamaz.");
  const buf = Buffer.from(await file.arrayBuffer());
  await prisma.attachment.create({
    data: {
      productId: target.productId ?? null,
      installationId: target.installationId ?? null,
      kind: target.kind,
      filename: file.name || "dosya",
      mime: file.type || "application/octet-stream",
      data: buf,
      userId: s.uid,
    },
  });
}

export async function uploadAttachmentAction(productId: number, fd: FormData) {
  const back = `/urunler/${productId}`;
  const s = await requirePerm("islem_urun", back);
  const file = fd.get("file");
  const kind = (str(fd, "kind") as "FOTO" | "DOKUMAN" | "HASAR") || "FOTO";
  if (!(file instanceof File) || file.size === 0) fail(back, "Dosya seçmelisiniz.");
  await saveAttachment(file, s, { productId, kind }, back);
  const p = await prisma.product.findUnique({ where: { id: productId } });
  await audit(s, "TANIM", `${p?.code ?? productId} kaydına dosya eklendi: ${file.name}`, "Product", productId);
  refresh();
  done(back, "Dosya yüklendi.");
}

export async function deleteAttachmentAction(id: number, productId: number) {
  const back = `/urunler/${productId}`;
  const s = await requireRole(isAdmin, back);
  await prisma.attachment.delete({ where: { id } });
  await audit(s, "TANIM", `Dosya eki silindi (#${id}).`, "Attachment", id);
  refresh();
  done(back, "Dosya silindi.");
}

// ---------------------------------------------------------------------------
// Pozisyon yönetimi
// ---------------------------------------------------------------------------

export async function createPositionAction(fd: FormData) {
  const back = "/pozisyonlar";
  const s = await requirePerm("islem_tanim", back);
  const name = str(fd, "name");
  if (!name) fail(back, "Pozisyon adı zorunludur.");
  // Sıra otomatik atanır: aynı makinedeki son pozisyonun ardına eklenir
  const last = await prisma.position.aggregate({
    where: { machineName: str(fd, "machineName") || "PM-1" },
    _max: { sortOrder: true },
  });
  const nextOrder = (last._max.sortOrder ?? 0) + 1;
  try {
    const p = await prisma.position.create({
      data: {
        name,
        type: str(fd, "type") === "ELEK" ? "ELEK" : "KECE",
        machineName: str(fd, "machineName") || "PM-1",
        minStock: int(fd, "minStock") ?? 1,
        sortOrder: nextOrder,
      },
    });
    await audit(s, "TANIM", `Yeni pozisyon eklendi: ${p.machineName} / ${p.name}`, "Position", p.id);
  } catch {
    fail(back, "Bu makinede aynı isimde bir pozisyon zaten var.");
  }
  refresh();
  done(back, "Pozisyon eklendi.");
}

export async function updatePositionAction(id: number, fd: FormData) {
  const back = "/pozisyonlar";
  const s = await requirePerm("islem_tanim", back);
  const name = str(fd, "name");
  if (!name) fail(back, "Pozisyon adı zorunludur.");
  try {
    const p = await prisma.position.update({
      where: { id },
      data: {
        name,
        machineName: str(fd, "machineName") || "PM-1",
        minStock: int(fd, "minStock") ?? 1,
      },
    });
    await audit(s, "TANIM", `Pozisyon güncellendi: ${p.machineName} / ${p.name}`, "Position", id);
  } catch {
    fail(back, "Bu makinede aynı isimde bir pozisyon zaten var.");
  }
  refresh();
  done(back, "Pozisyon güncellendi.");
}

export async function deletePositionAction(id: number) {
  const back = "/pozisyonlar";
  const s = await requirePerm("islem_tanim", back);
  const activeCount = await prisma.installation.count({ where: { positionId: id, active: true } });
  if (activeCount > 0) fail(back, "Üzerinde aktif ürün olan pozisyon silinemez. Önce söküm yapın.");
  const p = await prisma.position.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(s, "TANIM", `Pozisyon silindi (soft-delete): ${p.name}`, "Position", id);
  refresh();
  done(back, "Pozisyon silindi (geçmiş kayıtlar korunur).");
}

// ---------------------------------------------------------------------------
// Söküm nedenleri / üretici / tedarikçi
// ---------------------------------------------------------------------------

export async function createReasonAction(fd: FormData) {
  const back = "/tanimlar";
  const s = await requirePerm("islem_tanim", back);
  const name = str(fd, "name");
  if (!name) fail(back, "Neden adı zorunludur.");
  try {
    await prisma.failureReason.create({
      data: { name, planned: str(fd, "planned") === "1", sortOrder: int(fd, "sortOrder") ?? 99 },
    });
  } catch {
    fail(back, "Bu neden zaten kayıtlı.");
  }
  await audit(s, "TANIM", `Yeni söküm nedeni eklendi: ${name}`);
  refresh();
  done(back, "Söküm nedeni eklendi.");
}

export async function deleteReasonAction(id: number) {
  const back = "/tanimlar";
  const s = await requirePerm("islem_tanim", back);
  const r = await prisma.failureReason.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(s, "TANIM", `Söküm nedeni silindi: ${r.name}`);
  refresh();
  done(back, "Neden silindi.");
}

export async function createNamedAction(kind: "manufacturer" | "supplier", fd: FormData) {
  const back = "/tanimlar";
  const s = await requirePerm("islem_tanim", back);
  const name = str(fd, "name");
  if (!name) fail(back, "Ad zorunludur.");
  const model = kind === "manufacturer" ? prisma.manufacturer : prisma.supplier;
  try {
    await (model as typeof prisma.manufacturer).create({ data: { name } });
  } catch {
    fail(back, "Bu ad zaten kayıtlı.");
  }
  await audit(s, "TANIM", `${kind === "manufacturer" ? "Üretici" : "Tedarikçi"} eklendi: ${name}`);
  refresh();
  done(back, "Kayıt eklendi.");
}

export async function deleteNamedAction(kind: "manufacturer" | "supplier", id: number) {
  const back = "/tanimlar";
  const s = await requirePerm("islem_tanim", back);
  const model = kind === "manufacturer" ? prisma.manufacturer : prisma.supplier;
  const r = await (model as typeof prisma.manufacturer).update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await audit(s, "TANIM", `${kind === "manufacturer" ? "Üretici" : "Tedarikçi"} silindi: ${r.name}`);
  refresh();
  done(back, "Kayıt silindi.");
}

// ---------------------------------------------------------------------------
// Kullanıcı yönetimi
// ---------------------------------------------------------------------------

const VALID_ROLES = ["YONETICI", "BAKIM", "OPERATOR", "IZLEYICI"] as const;

export async function createUserAction(fd: FormData) {
  const back = "/kullanicilar";
  const s = await requireRole(isAdmin, back);
  const username = str(fd, "username");
  const fullName = str(fd, "fullName");
  const password = str(fd, "password");
  const role = str(fd, "role") as (typeof VALID_ROLES)[number];
  if (!username || !fullName) fail(back, "Kullanıcı adı ve ad soyad zorunludur.");
  if (password.length < 6) fail(back, "Şifre en az 6 karakter olmalıdır.");
  if (!VALID_ROLES.includes(role)) fail(back, "Geçersiz rol.");
  try {
    const u = await prisma.user.create({
      data: { username, fullName, role, passwordHash: bcrypt.hashSync(password, 10) },
    });
    await audit(s, "SISTEM", `Yeni kullanıcı: ${username} (${ROLE_LABELS[role]})`, "User", u.id);
  } catch {
    fail(back, "Bu kullanıcı adı zaten kayıtlı.");
  }
  refresh();
  done(back, "Kullanıcı eklendi.");
}

export async function updateUserAction(id: number, fd: FormData) {
  const back = "/kullanicilar";
  const s = await requireRole(isAdmin, back);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) fail(back, "Kullanıcı bulunamadı.");
  const op = str(fd, "op");
  if (op === "toggle") {
    if (id === s.uid) fail(back, "Kendi hesabınızı pasife alamazsınız.");
    await prisma.user.update({ where: { id }, data: { active: !user.active } });
    await audit(s, "SISTEM", `Kullanıcı ${user.active ? "pasife alındı" : "aktifleştirildi"}: ${user.username}`, "User", id);
  } else if (op === "role") {
    const role = str(fd, "role") as (typeof VALID_ROLES)[number];
    if (!VALID_ROLES.includes(role)) fail(back, "Geçersiz rol.");
    if (id === s.uid && role !== "YONETICI") fail(back, "Kendi yönetici rolünüzü düşüremezsiniz.");
    await prisma.user.update({ where: { id }, data: { role } });
    await audit(s, "SISTEM", `Rol değiştirildi: ${user.username} → ${ROLE_LABELS[role]}`, "User", id);
  } else if (op === "password") {
    const password = str(fd, "password");
    if (password.length < 6) fail(back, "Şifre en az 6 karakter olmalıdır.");
    await prisma.user.update({
      where: { id },
      data: { passwordHash: bcrypt.hashSync(password, 10) },
    });
    await audit(s, "SISTEM", `Şifre sıfırlandı: ${user.username}`, "User", id);
  } else if (op === "delete") {
    if (id === s.uid) fail(back, "Kendi hesabınızı silemezsiniz.");
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    await audit(s, "SISTEM", `Kullanıcı silindi (soft-delete): ${user.username}`, "User", id);
  }
  refresh();
  done(back, "İşlem tamamlandı.");
}

// ---------------------------------------------------------------------------
// Rol yetkileri (yalnızca yönetici)
// ---------------------------------------------------------------------------

export async function updateRolePermissionsAction(fd: FormData) {
  const back = "/kullanicilar";
  const s = await requireRole(isAdmin, back);
  for (const role of EDITABLE_ROLES) {
    const granted = ALL_PERMS.filter((p) => fd.get(`${role}:${p}`) === "on");
    await prisma.rolePermission.deleteMany({ where: { role } });
    await prisma.rolePermission.createMany({
      data: [CONFIGURED_MARKER, ...granted].map((permission) => ({ role, permission })),
    });
    await audit(
      s,
      "SISTEM",
      `${ROLE_LABELS[role]} rolünün yetkileri güncellendi (${granted.length} yetki).`,
      "RolePermission"
    );
  }
  refresh();
  done(back, "Rol yetkileri kaydedildi. Değişiklikler kullanıcıların bir sonraki sayfa yüklemesinde geçerli olur.");
}
