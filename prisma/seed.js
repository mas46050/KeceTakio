// Başlangıç verileri: admin kullanıcı, pozisyonlar, söküm nedenleri, örnek kayıtlar
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const POSITIONS = [
  // Elekler
  { name: "Alt Elek", type: "ELEK", sortOrder: 1 },
  { name: "Üst Elek", type: "ELEK", sortOrder: 2 },
  { name: "Forming Fabric 1", type: "ELEK", sortOrder: 3 },
  { name: "Forming Fabric 2", type: "ELEK", sortOrder: 4 },
  // Keçeler
  { name: "1. Press Keçesi", type: "KECE", sortOrder: 5 },
  { name: "2. Press Keçesi", type: "KECE", sortOrder: 6 },
  { name: "3. Press Keçesi", type: "KECE", sortOrder: 7 },
  { name: "4. Press Keçesi", type: "KECE", sortOrder: 8 },
];

const REASONS = [
  { name: "Normal ömür sonu", planned: true, sortOrder: 1 },
  { name: "Planlı değişim", planned: true, sortOrder: 2 },
  { name: "Yırtılma", planned: false, sortOrder: 3 },
  { name: "Kenar hasarı", planned: false, sortOrder: 4 },
  { name: "Delik", planned: false, sortOrder: 5 },
  { name: "Aşınma", planned: false, sortOrder: 6 },
  { name: "Kimyasal hasar", planned: false, sortOrder: 7 },
  { name: "Kırışma", planned: false, sortOrder: 8 },
  { name: "Kirlilik", planned: false, sortOrder: 9 },
  { name: "Mekanik hasar", planned: false, sortOrder: 10 },
  { name: "Plansız değişim", planned: false, sortOrder: 11 },
  { name: "Kalite problemi", planned: false, sortOrder: 12 },
  { name: "Diğer", planned: false, sortOrder: 13 },
];

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("Veritabanı zaten dolu, seed atlandı.");
    return;
  }

  await prisma.user.create({
    data: {
      username: "admin",
      passwordHash: bcrypt.hashSync("admin123", 10),
      fullName: "Sistem Yöneticisi",
      role: "YONETICI",
    },
  });

  for (const p of POSITIONS) await prisma.position.create({ data: p });
  for (const r of REASONS) await prisma.failureReason.create({ data: r });

  const m1 = await prisma.manufacturer.create({ data: { name: "Valmet" } });
  const m2 = await prisma.manufacturer.create({ data: { name: "Heimbach" } });
  const s1 = await prisma.supplier.create({ data: { name: "Örnek Tedarik A.Ş." } });

  const pos = await prisma.position.findMany();
  const byName = (n) => pos.find((p) => p.name === n);

  // Örnek başlangıç kayıtları (stokta)
  await prisma.product.create({
    data: {
      code: "KCE-0001",
      type: "KECE",
      status: "STOKTA",
      positionId: byName("2. Press Keçesi").id,
      manufacturerId: m2.id,
      supplierId: s1.id,
      brand: "Prima",
      productCode: "PF-2200",
      serialNo: "SN-2024-118",
      widthMm: 4200,
      lengthMm: 18500,
      gsm: 1450,
      expectedLifeDays: 60,
      unitPrice: 185000,
      currency: "TRY",
      stockDate: new Date(),
      warehouseLocation: "Ana Depo",
      shelfLocation: "R-3",
    },
  });
  await prisma.product.create({
    data: {
      code: "ELK-0001",
      type: "ELEK",
      status: "STOKTA",
      positionId: byName("Alt Elek").id,
      manufacturerId: m1.id,
      supplierId: s1.id,
      brand: "FormMax",
      productCode: "FM-810",
      serialNo: "SN-2024-204",
      widthMm: 4300,
      lengthMm: 24000,
      expectedLifeDays: 120,
      unitPrice: 240000,
      currency: "TRY",
      stockDate: new Date(),
      warehouseLocation: "Ana Depo",
      shelfLocation: "R-1",
    },
  });

  await prisma.auditLog.create({
    data: { action: "SISTEM", description: "Sistem kuruldu, başlangıç verileri yüklendi." },
  });

  console.log("Seed tamamlandı. Giriş: admin / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
