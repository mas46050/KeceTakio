#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KeçeTakip — Kâğıt fabrikaları için keçe & elek stok ve ömür takip programı.

Özellikler:
  - Kullanıcı girişi ve rol tabanlı yetki (admin / operator / izleyici)
  - Keçe & elek stok takibi (giriş, düzeltme, minimum stok uyarısı)
  - Makine pozisyonlarına montaj / söküm, çalışma durumu
  - Kalan ömür hesabı ve uyarıları
  - Maliyet raporları (aylık alım, makine bazlı kullanım, ömür performansı)
  - Tüm işlemler için kullanıcı bazlı hareket (audit) kaydı
"""

import os
import sqlite3
import functools
from datetime import datetime, date

from flask import (
    Flask, g, render_template, request, redirect,
    url_for, session, flash, abort
)
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("KECETAKIP_DB", os.path.join(BASE_DIR, "kecetakip.db"))

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "kecetakip-gizli-anahtar-degistirin")

ROLES = {"admin": "Yönetici", "operator": "Operatör", "izleyici": "İzleyici"}
CATEGORIES = ["Keçe", "Elek"]
MOVEMENT_TYPES = {
    "GIRIS": "Stok Girişi",
    "MONTAJ": "Montaj (Stoktan Çıkış)",
    "SOKUM": "Söküm",
    "DUZELTME": "Stok Düzeltme",
    "TANIM": "Kart Tanım/Değişiklik",
    "SISTEM": "Sistem",
}
REMOVAL_REASONS = ["Normal aşınma", "Hasar / yırtılma", "Kalite problemi", "Deneme", "Diğer"]


# ----------------------------------------------------------------------------
# Veritabanı
# ----------------------------------------------------------------------------

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,            -- Keçe / Elek
    supplier TEXT DEFAULT '',
    width_mm REAL,
    length_mm REAL,
    gsm REAL,                          -- gramaj (g/m2)
    unit_cost REAL NOT NULL DEFAULT 0, -- birim maliyet (adet)
    expected_life_days INTEGER NOT NULL DEFAULT 60,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 1,
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Keçe',
    UNIQUE(machine_id, name)
);

CREATE TABLE IF NOT EXISTS installations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position_id INTEGER NOT NULL REFERENCES positions(id),
    item_id INTEGER NOT NULL REFERENCES items(id),
    serial_no TEXT DEFAULT '',
    install_date TEXT NOT NULL,
    expected_life_days INTEGER NOT NULL,
    removed_date TEXT,
    removal_reason TEXT,
    status TEXT NOT NULL DEFAULT 'calisiyor',  -- calisiyor / sokuldu
    installed_by INTEGER REFERENCES users(id),
    removed_by INTEGER REFERENCES users(id),
    note TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    item_id INTEGER REFERENCES items(id),
    installation_id INTEGER REFERENCES installations(id),
    qty INTEGER NOT NULL DEFAULT 0,
    unit_cost REAL NOT NULL DEFAULT 0,
    note TEXT DEFAULT '',
    user_id INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL
);
"""

SEED_POSITIONS = [
    ("Pick-up Keçesi", "Keçe"),
    ("1. Pres Keçesi", "Keçe"),
    ("2. Pres Keçesi", "Keçe"),
    ("3. Pres Keçesi", "Keçe"),
    ("Yaş Elek (Alt)", "Elek"),
    ("Yaş Elek (Üst)", "Elek"),
    ("1. Grup Kurutma Eleği", "Elek"),
    ("2. Grup Kurutma Eleği", "Elek"),
]


def init_db():
    db = sqlite3.connect(DB_PATH)
    db.executescript(SCHEMA)
    cur = db.execute("SELECT COUNT(*) FROM users")
    if cur.fetchone()[0] == 0:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        db.execute(
            "INSERT INTO users (username, password_hash, full_name, role, active, created_at)"
            " VALUES (?,?,?,?,1,?)",
            ("admin", generate_password_hash("admin123"), "Sistem Yöneticisi", "admin", now),
        )
        cur = db.execute("INSERT INTO machines (name, notes) VALUES (?,?)",
                         ("PM-1", "Örnek kâğıt makinesi — pozisyonları düzenleyebilirsiniz"))
        machine_id = cur.lastrowid
        for pname, pcat in SEED_POSITIONS:
            db.execute("INSERT INTO positions (machine_id, name, category) VALUES (?,?,?)",
                       (machine_id, pname, pcat))
        db.commit()
    db.close()


def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def log_movement(mtype, item_id=None, installation_id=None, qty=0, unit_cost=0.0, note=""):
    db = get_db()
    db.execute(
        "INSERT INTO movements (type, item_id, installation_id, qty, unit_cost, note, user_id, created_at)"
        " VALUES (?,?,?,?,?,?,?,?)",
        (mtype, item_id, installation_id, qty, unit_cost, note,
         session.get("user_id"), now_str()),
    )


# ----------------------------------------------------------------------------
# Yetkilendirme
# ----------------------------------------------------------------------------

def login_required(view):
    @functools.wraps(view)
    def wrapped(**kwargs):
        if not session.get("user_id"):
            return redirect(url_for("login", next=request.path))
        return view(**kwargs)
    return wrapped


def role_required(*roles):
    def decorator(view):
        @functools.wraps(view)
        def wrapped(**kwargs):
            if not session.get("user_id"):
                return redirect(url_for("login", next=request.path))
            if session.get("role") not in roles:
                flash("Bu işlem için yetkiniz yok.", "error")
                return redirect(url_for("dashboard"))
            return view(**kwargs)
        return wrapped
    return decorator


@app.context_processor
def inject_globals():
    return {
        "ROLES": ROLES,
        "MOVEMENT_TYPES": MOVEMENT_TYPES,
        "current_role": session.get("role"),
        "current_user": session.get("full_name"),
        "today": date.today().isoformat(),
    }


# ----------------------------------------------------------------------------
# Ömür hesabı
# ----------------------------------------------------------------------------

def life_info(install_date_str, expected_days):
    """Kalan ömür bilgisi: geçen gün, kalan gün, yüzde ve durum sınıfı."""
    try:
        d0 = datetime.strptime(install_date_str[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        d0 = date.today()
    elapsed = (date.today() - d0).days
    expected = max(int(expected_days or 1), 1)
    remaining = expected - elapsed
    pct = max(min(round(remaining * 100.0 / expected), 100), 0)
    if pct <= 10:
        cls = "danger"
    elif pct <= 25:
        cls = "warn"
    else:
        cls = "ok"
    return {"elapsed": elapsed, "remaining": remaining, "pct": pct, "cls": cls,
            "expected": expected}


def active_installations():
    db = get_db()
    rows = db.execute("""
        SELECT ins.*, i.code AS item_code, i.name AS item_name, i.category,
               i.unit_cost, p.name AS position_name, m.name AS machine_name,
               u.full_name AS installed_by_name
        FROM installations ins
        JOIN items i ON i.id = ins.item_id
        JOIN positions p ON p.id = ins.position_id
        JOIN machines m ON m.id = p.machine_id
        LEFT JOIN users u ON u.id = ins.installed_by
        WHERE ins.status = 'calisiyor'
        ORDER BY m.name, p.name
    """).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["life"] = life_info(r["install_date"], r["expected_life_days"])
        result.append(d)
    return result


# ----------------------------------------------------------------------------
# Giriş / çıkış
# ----------------------------------------------------------------------------

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        db = get_db()
        user = db.execute("SELECT * FROM users WHERE username = ? AND active = 1",
                          (username,)).fetchone()
        if user and check_password_hash(user["password_hash"], password):
            session.clear()
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            session["full_name"] = user["full_name"]
            session["role"] = user["role"]
            log_movement("SISTEM", note=f"{user['full_name']} giriş yaptı")
            db.commit()
            return redirect(request.args.get("next") or url_for("dashboard"))
        flash("Kullanıcı adı veya şifre hatalı.", "error")
    return render_template("login.html")


@app.route("/logout")
def logout():
    if session.get("user_id"):
        log_movement("SISTEM", note=f"{session.get('full_name')} çıkış yaptı")
        get_db().commit()
    session.clear()
    return redirect(url_for("login"))


# ----------------------------------------------------------------------------
# Ana sayfa (dashboard)
# ----------------------------------------------------------------------------

@app.route("/")
@login_required
def dashboard():
    db = get_db()
    actives = active_installations()
    low_stock = db.execute(
        "SELECT * FROM items WHERE stock_qty <= min_stock ORDER BY stock_qty ASC"
    ).fetchall()
    life_warnings = [a for a in actives if a["life"]["cls"] in ("warn", "danger")]
    totals = {
        "stock_value": db.execute(
            "SELECT COALESCE(SUM(stock_qty * unit_cost), 0) FROM items").fetchone()[0],
        "item_count": db.execute("SELECT COUNT(*) FROM items").fetchone()[0],
        "running": len(actives),
        "running_value": sum(a["unit_cost"] or 0 for a in actives),
    }
    month = datetime.now().strftime("%Y-%m")
    month_cost = db.execute(
        "SELECT COALESCE(SUM(qty * unit_cost), 0) FROM movements"
        " WHERE type = 'GIRIS' AND substr(created_at, 1, 7) = ?", (month,)).fetchone()[0]
    recent = db.execute("""
        SELECT mv.*, i.code AS item_code, i.name AS item_name, u.full_name AS user_name
        FROM movements mv
        LEFT JOIN items i ON i.id = mv.item_id
        LEFT JOIN users u ON u.id = mv.user_id
        WHERE mv.type != 'SISTEM'
        ORDER BY mv.id DESC LIMIT 10
    """).fetchall()
    return render_template("dashboard.html", actives=actives, low_stock=low_stock,
                           life_warnings=life_warnings, totals=totals,
                           month_cost=month_cost, recent=recent)


# ----------------------------------------------------------------------------
# Stok
# ----------------------------------------------------------------------------

@app.route("/stok")
@login_required
def stok():
    db = get_db()
    q = request.args.get("q", "").strip()
    sql = "SELECT * FROM items"
    params = []
    if q:
        sql += " WHERE code LIKE ? OR name LIKE ? OR supplier LIKE ?"
        params = [f"%{q}%"] * 3
    sql += " ORDER BY category, code"
    items = db.execute(sql, params).fetchall()
    return render_template("stok.html", items=items, q=q, categories=CATEGORIES)


@app.route("/stok/yeni", methods=["GET", "POST"])
@role_required("admin", "operator")
def stok_yeni():
    return _stok_form(None)


@app.route("/stok/<int:item_id>/duzenle", methods=["GET", "POST"])
@role_required("admin", "operator")
def stok_duzenle(item_id):
    return _stok_form(item_id)


def _stok_form(item_id):
    db = get_db()
    item = None
    if item_id:
        item = db.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
        if not item:
            abort(404)
    if request.method == "POST":
        f = request.form
        vals = {
            "code": f.get("code", "").strip(),
            "name": f.get("name", "").strip(),
            "category": f.get("category", "Keçe"),
            "supplier": f.get("supplier", "").strip(),
            "width_mm": float(f.get("width_mm") or 0) or None,
            "length_mm": float(f.get("length_mm") or 0) or None,
            "gsm": float(f.get("gsm") or 0) or None,
            "unit_cost": float(f.get("unit_cost") or 0),
            "expected_life_days": int(f.get("expected_life_days") or 60),
            "min_stock": int(f.get("min_stock") or 1),
            "notes": f.get("notes", "").strip(),
        }
        if not vals["code"] or not vals["name"]:
            flash("Kod ve ad alanları zorunludur.", "error")
        else:
            try:
                if item:
                    db.execute("""UPDATE items SET code=:code, name=:name, category=:category,
                        supplier=:supplier, width_mm=:width_mm, length_mm=:length_mm, gsm=:gsm,
                        unit_cost=:unit_cost, expected_life_days=:expected_life_days,
                        min_stock=:min_stock, notes=:notes WHERE id=:id""",
                               {**vals, "id": item_id})
                    log_movement("TANIM", item_id=item_id,
                                 note=f"Kart güncellendi: {vals['code']} — {vals['name']}")
                else:
                    cur = db.execute("""INSERT INTO items (code, name, category, supplier,
                        width_mm, length_mm, gsm, unit_cost, expected_life_days, min_stock,
                        notes, created_at) VALUES (:code, :name, :category, :supplier,
                        :width_mm, :length_mm, :gsm, :unit_cost, :expected_life_days,
                        :min_stock, :notes, :created_at)""",
                                     {**vals, "created_at": now_str()})
                    log_movement("TANIM", item_id=cur.lastrowid,
                                 note=f"Yeni kart açıldı: {vals['code']} — {vals['name']}")
                db.commit()
                flash("Kayıt başarıyla kaydedildi.", "success")
                return redirect(url_for("stok"))
            except sqlite3.IntegrityError:
                flash("Bu kod başka bir kartta kullanılıyor.", "error")
    return render_template("stok_form.html", item=item, categories=CATEGORIES)


@app.route("/stok/<int:item_id>/giris", methods=["POST"])
@role_required("admin", "operator")
def stok_giris(item_id):
    db = get_db()
    item = db.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    if not item:
        abort(404)
    qty = int(request.form.get("qty") or 0)
    unit_cost = float(request.form.get("unit_cost") or item["unit_cost"])
    note = request.form.get("note", "").strip()
    if qty <= 0:
        flash("Miktar 0'dan büyük olmalıdır.", "error")
    else:
        db.execute("UPDATE items SET stock_qty = stock_qty + ?, unit_cost = ? WHERE id = ?",
                   (qty, unit_cost, item_id))
        log_movement("GIRIS", item_id=item_id, qty=qty, unit_cost=unit_cost,
                     note=note or f"Stok girişi: {item['code']}")
        db.commit()
        flash(f"{item['code']} için {qty} adet stok girişi yapıldı.", "success")
    return redirect(url_for("stok"))


@app.route("/stok/<int:item_id>/duzeltme", methods=["POST"])
@role_required("admin")
def stok_duzeltme(item_id):
    db = get_db()
    item = db.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    if not item:
        abort(404)
    new_qty = int(request.form.get("new_qty") or 0)
    note = request.form.get("note", "").strip()
    diff = new_qty - item["stock_qty"]
    db.execute("UPDATE items SET stock_qty = ? WHERE id = ?", (new_qty, item_id))
    log_movement("DUZELTME", item_id=item_id, qty=diff, unit_cost=item["unit_cost"],
                 note=note or f"Stok düzeltme: {item['stock_qty']} → {new_qty}")
    db.commit()
    flash("Stok miktarı düzeltildi.", "success")
    return redirect(url_for("stok"))


# ----------------------------------------------------------------------------
# Makineler ve pozisyonlar
# ----------------------------------------------------------------------------

@app.route("/makineler", methods=["GET", "POST"])
@login_required
def makineler():
    db = get_db()
    if request.method == "POST":
        if session.get("role") not in ("admin", "operator"):
            flash("Bu işlem için yetkiniz yok.", "error")
            return redirect(url_for("makineler"))
        action = request.form.get("action")
        try:
            if action == "add_machine":
                name = request.form.get("name", "").strip()
                if name:
                    db.execute("INSERT INTO machines (name, notes) VALUES (?,?)",
                               (name, request.form.get("notes", "").strip()))
                    log_movement("TANIM", note=f"Yeni makine eklendi: {name}")
                    db.commit()
                    flash("Makine eklendi.", "success")
            elif action == "add_position":
                machine_id = int(request.form.get("machine_id"))
                pname = request.form.get("pname", "").strip()
                pcat = request.form.get("pcat", "Keçe")
                if pname:
                    db.execute("INSERT INTO positions (machine_id, name, category) VALUES (?,?,?)",
                               (machine_id, pname, pcat))
                    log_movement("TANIM", note=f"Yeni pozisyon eklendi: {pname}")
                    db.commit()
                    flash("Pozisyon eklendi.", "success")
        except sqlite3.IntegrityError:
            flash("Bu isim zaten kayıtlı.", "error")
        return redirect(url_for("makineler"))

    machines = db.execute("SELECT * FROM machines ORDER BY name").fetchall()
    positions = db.execute("""
        SELECT p.*, m.name AS machine_name,
               ins.id AS active_installation_id, i.code AS active_item_code,
               i.name AS active_item_name, ins.install_date, ins.expected_life_days
        FROM positions p
        JOIN machines m ON m.id = p.machine_id
        LEFT JOIN installations ins ON ins.position_id = p.id AND ins.status = 'calisiyor'
        LEFT JOIN items i ON i.id = ins.item_id
        ORDER BY m.name, p.name
    """).fetchall()
    pos_list = []
    for p in positions:
        d = dict(p)
        d["life"] = (life_info(p["install_date"], p["expected_life_days"])
                     if p["active_installation_id"] else None)
        pos_list.append(d)
    return render_template("makineler.html", machines=machines, positions=pos_list,
                           categories=CATEGORIES)


# ----------------------------------------------------------------------------
# Çalışan keçe/elekler — montaj & söküm
# ----------------------------------------------------------------------------

@app.route("/calisan")
@login_required
def calisan():
    return render_template("calisan.html", actives=active_installations(),
                           removal_reasons=REMOVAL_REASONS)


@app.route("/montaj", methods=["GET", "POST"])
@role_required("admin", "operator")
def montaj():
    db = get_db()
    if request.method == "POST":
        position_id = int(request.form.get("position_id") or 0)
        item_id = int(request.form.get("item_id") or 0)
        install_date = request.form.get("install_date") or date.today().isoformat()
        serial_no = request.form.get("serial_no", "").strip()
        note = request.form.get("note", "").strip()

        item = db.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
        pos = db.execute("""SELECT p.*, m.name AS machine_name FROM positions p
                            JOIN machines m ON m.id = p.machine_id
                            WHERE p.id = ?""", (position_id,)).fetchone()
        occupied = db.execute(
            "SELECT id FROM installations WHERE position_id = ? AND status = 'calisiyor'",
            (position_id,)).fetchone()
        expected = int(request.form.get("expected_life_days")
                       or (item["expected_life_days"] if item else 60))

        if not item or not pos:
            flash("Pozisyon ve stok kartı seçmelisiniz.", "error")
        elif occupied:
            flash("Bu pozisyonda zaten çalışan bir keçe/elek var. Önce söküm yapın.", "error")
        elif item["stock_qty"] <= 0:
            flash("Bu karttan stokta ürün kalmamış.", "error")
        else:
            cur = db.execute("""INSERT INTO installations
                (position_id, item_id, serial_no, install_date, expected_life_days,
                 status, installed_by, note)
                VALUES (?,?,?,?,?,'calisiyor',?,?)""",
                             (position_id, item_id, serial_no, install_date,
                              expected, session["user_id"], note))
            db.execute("UPDATE items SET stock_qty = stock_qty - 1 WHERE id = ?", (item_id,))
            log_movement("MONTAJ", item_id=item_id, installation_id=cur.lastrowid,
                         qty=-1, unit_cost=item["unit_cost"],
                         note=f"{pos['machine_name']} / {pos['name']} pozisyonuna montaj")
            db.commit()
            flash("Montaj kaydedildi, stoktan 1 adet düşüldü.", "success")
            return redirect(url_for("calisan"))

    empty_positions = db.execute("""
        SELECT p.*, m.name AS machine_name FROM positions p
        JOIN machines m ON m.id = p.machine_id
        WHERE p.id NOT IN (SELECT position_id FROM installations WHERE status = 'calisiyor')
        ORDER BY m.name, p.name
    """).fetchall()
    stock_items = db.execute(
        "SELECT * FROM items WHERE stock_qty > 0 ORDER BY category, code").fetchall()
    return render_template("montaj.html", empty_positions=empty_positions,
                           stock_items=stock_items)


@app.route("/sokum/<int:installation_id>", methods=["POST"])
@role_required("admin", "operator")
def sokum(installation_id):
    db = get_db()
    ins = db.execute("""
        SELECT ins.*, i.code AS item_code, i.unit_cost, p.name AS position_name,
               m.name AS machine_name
        FROM installations ins
        JOIN items i ON i.id = ins.item_id
        JOIN positions p ON p.id = ins.position_id
        JOIN machines m ON m.id = p.machine_id
        WHERE ins.id = ? AND ins.status = 'calisiyor'
    """, (installation_id,)).fetchone()
    if not ins:
        flash("Kayıt bulunamadı veya zaten sökülmüş.", "error")
        return redirect(url_for("calisan"))
    reason = request.form.get("reason") or "Diğer"
    note = request.form.get("note", "").strip()
    removed_date = request.form.get("removed_date") or date.today().isoformat()
    db.execute("""UPDATE installations SET status = 'sokuldu', removed_date = ?,
                  removal_reason = ?, removed_by = ?,
                  note = CASE WHEN note = '' THEN ? ELSE note || ' | ' || ? END
                  WHERE id = ?""",
               (removed_date, reason, session["user_id"], note, note, installation_id))
    life = life_info(ins["install_date"], ins["expected_life_days"])
    log_movement("SOKUM", item_id=ins["item_id"], installation_id=installation_id,
                 unit_cost=ins["unit_cost"],
                 note=(f"{ins['machine_name']} / {ins['position_name']} söküm — "
                       f"{reason} — {life['elapsed']} gün çalıştı"))
    db.commit()
    flash(f"{ins['item_code']} söküldü ({life['elapsed']} gün çalıştı).", "success")
    return redirect(url_for("calisan"))


# ----------------------------------------------------------------------------
# Hareketler (audit log)
# ----------------------------------------------------------------------------

@app.route("/hareketler")
@login_required
def hareketler():
    db = get_db()
    mtype = request.args.get("tip", "")
    q = request.args.get("q", "").strip()
    sql = """
        SELECT mv.*, i.code AS item_code, i.name AS item_name, u.full_name AS user_name
        FROM movements mv
        LEFT JOIN items i ON i.id = mv.item_id
        LEFT JOIN users u ON u.id = mv.user_id
        WHERE 1=1
    """
    params = []
    if mtype:
        sql += " AND mv.type = ?"
        params.append(mtype)
    if q:
        sql += " AND (i.code LIKE ? OR i.name LIKE ? OR mv.note LIKE ? OR u.full_name LIKE ?)"
        params += [f"%{q}%"] * 4
    sql += " ORDER BY mv.id DESC LIMIT 500"
    movements = db.execute(sql, params).fetchall()
    return render_template("hareketler.html", movements=movements, mtype=mtype, q=q)


# ----------------------------------------------------------------------------
# Raporlar
# ----------------------------------------------------------------------------

@app.route("/raporlar")
@login_required
def raporlar():
    db = get_db()
    monthly_purchases = db.execute("""
        SELECT substr(created_at, 1, 7) AS ay,
               SUM(qty) AS adet, SUM(qty * unit_cost) AS tutar
        FROM movements WHERE type = 'GIRIS'
        GROUP BY ay ORDER BY ay DESC LIMIT 24
    """).fetchall()
    machine_usage = db.execute("""
        SELECT m.name AS machine_name, COUNT(*) AS adet,
               SUM(i.unit_cost) AS tutar
        FROM installations ins
        JOIN items i ON i.id = ins.item_id
        JOIN positions p ON p.id = ins.position_id
        JOIN machines m ON m.id = p.machine_id
        GROUP BY m.id ORDER BY tutar DESC
    """).fetchall()
    life_rows = db.execute("""
        SELECT ins.*, i.code AS item_code, i.name AS item_name, i.unit_cost,
               p.name AS position_name, m.name AS machine_name
        FROM installations ins
        JOIN items i ON i.id = ins.item_id
        JOIN positions p ON p.id = ins.position_id
        JOIN machines m ON m.id = p.machine_id
        WHERE ins.status = 'sokuldu'
        ORDER BY ins.removed_date DESC LIMIT 100
    """).fetchall()
    life_perf = []
    for r in life_rows:
        d = dict(r)
        try:
            d0 = datetime.strptime(r["install_date"][:10], "%Y-%m-%d").date()
            d1 = datetime.strptime(r["removed_date"][:10], "%Y-%m-%d").date()
            actual = (d1 - d0).days
        except (ValueError, TypeError):
            actual = 0
        expected = max(int(r["expected_life_days"] or 1), 1)
        d["actual_days"] = actual
        d["ratio"] = round(actual * 100.0 / expected)
        d["cost_per_day"] = round((r["unit_cost"] or 0) / max(actual, 1), 2)
        life_perf.append(d)
    return render_template("raporlar.html", monthly_purchases=monthly_purchases,
                           machine_usage=machine_usage, life_perf=life_perf)


# ----------------------------------------------------------------------------
# Kullanıcı yönetimi (yalnızca admin)
# ----------------------------------------------------------------------------

@app.route("/kullanicilar", methods=["GET", "POST"])
@role_required("admin")
def kullanicilar():
    db = get_db()
    if request.method == "POST":
        action = request.form.get("action")
        if action == "add":
            username = request.form.get("username", "").strip()
            full_name = request.form.get("full_name", "").strip()
            password = request.form.get("password", "")
            role = request.form.get("role", "operator")
            if not username or not full_name or len(password) < 6:
                flash("Kullanıcı adı, ad soyad ve en az 6 haneli şifre gereklidir.", "error")
            elif role not in ROLES:
                flash("Geçersiz rol.", "error")
            else:
                try:
                    db.execute("""INSERT INTO users (username, password_hash, full_name,
                        role, active, created_at) VALUES (?,?,?,?,1,?)""",
                               (username, generate_password_hash(password), full_name,
                                role, now_str()))
                    log_movement("SISTEM", note=f"Yeni kullanıcı eklendi: {username} ({ROLES[role]})")
                    db.commit()
                    flash("Kullanıcı eklendi.", "success")
                except sqlite3.IntegrityError:
                    flash("Bu kullanıcı adı zaten kayıtlı.", "error")
        elif action == "toggle":
            uid = int(request.form.get("user_id"))
            if uid == session["user_id"]:
                flash("Kendi hesabınızı pasife alamazsınız.", "error")
            else:
                user = db.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
                if user:
                    db.execute("UPDATE users SET active = 1 - active WHERE id = ?", (uid,))
                    log_movement("SISTEM",
                                 note=f"Kullanıcı {'pasife alındı' if user['active'] else 'aktifleştirildi'}: {user['username']}")
                    db.commit()
                    flash("Kullanıcı durumu güncellendi.", "success")
        elif action == "reset_password":
            uid = int(request.form.get("user_id"))
            password = request.form.get("password", "")
            user = db.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
            if not user or len(password) < 6:
                flash("En az 6 haneli yeni şifre girin.", "error")
            else:
                db.execute("UPDATE users SET password_hash = ? WHERE id = ?",
                           (generate_password_hash(password), uid))
                log_movement("SISTEM", note=f"Şifre sıfırlandı: {user['username']}")
                db.commit()
                flash("Şifre güncellendi.", "success")
        return redirect(url_for("kullanicilar"))
    users = db.execute("SELECT * FROM users ORDER BY username").fetchall()
    return render_template("kullanicilar.html", users=users)


# ----------------------------------------------------------------------------

init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
