import express from "express";
import { createServer as createViteServer } from "vite";
import { Pool } from "pg";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from 'path';
import Stripe from "stripe";
import webpush from 'web-push';

// Handle BigInt serialization for JSON
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const usePostgres = !!process.env.DATABASE_URL;
const pool = usePostgres ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
}) : null;

const sqlite = !usePostgres ? new Database("database.db") : null;

// Helper to convert PG SQL to SQLite SQL
const translateSql = (sql: string) => {
  if (usePostgres) return sql;
  return sql
    .replace(/\$\d+/g, '?')
    .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/DOUBLE PRECISION/gi, 'REAL')
    .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/gi, 'DATETIME DEFAULT CURRENT_TIMESTAMP')
    .replace(/TIMESTAMP/gi, 'DATETIME');
};

const db = {
  query: async (text: string, params: any[] = []) => {
    if (usePostgres) {
      return pool!.query(text, params);
    } else {
      const translated = translateSql(text);
      const stmt = sqlite!.prepare(translated);
      if (translated.trim().toUpperCase().startsWith('SELECT')) {
        return { rows: stmt.all(params) };
      } else {
        const result = stmt.run(params);
        return { rows: [result], rowCount: result.changes };
      }
    }
  },
  connect: async () => {
    if (usePostgres) {
      return pool!.connect();
    } else {
      return {
        query: async (text: string, params: any[] = []) => db.query(text, params),
        release: () => {},
      };
    }
  }
};

// Ensure SuperAdmin exists
const ensureAdmin = async () => {
  const res = await db.query("SELECT * FROM users WHERE role = 'SuperAdmin'");
  const admin = res.rows[0];
  if (!admin) {
    const hashedPassword = bcrypt.hashSync("admin123", 10);
    await db.query("INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, 'SuperAdmin', $3)",
      ["admin", hashedPassword, "مدير النظام"]);
  }
};

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-123";

// --- Stripe Initialization ---
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

const PLANS = {
  Premium: process.env.STRIPE_PRICE_ID_PREMIUM,
};

// --- Web Push Initialization ---
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BM27JQ2WqUCQULvJj030BNR3H2yLlzNt5lm0MCUwJcxUxmiHz781H98L-C-yAeE7c2GMMRG6tvMX3-InlQIIiJM";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "eEm6MDKjOAk6oiR68g-lW54xt3mQu5WcanXSD3KuJas";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:info.mohamed35@gmail.com";

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// --- Database Initialization ---
const initDb = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS stations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      subscription_plan TEXT DEFAULT 'Basic',
      subscription_expires_at TIMESTAMP,
      is_active INTEGER DEFAULT 0,
      subscription_status TEXT DEFAULT 'Inactive',
      owner_username TEXT,
      owner_password_plain TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      slug TEXT UNIQUE,
      logo_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add columns if they don't exist (for existing databases)
  try { await db.query("ALTER TABLE stations ADD COLUMN slug TEXT"); } catch(e) {}
  try { await db.query("ALTER TABLE stations ADD COLUMN logo_url TEXT"); } catch(e) {}
  try { await db.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_stations_slug ON stations(slug)"); } catch(e) {}
  
  // Notification settings for stations
  try { await db.query("ALTER TABLE stations ADD COLUMN notifications_enabled INTEGER DEFAULT 1"); } catch(e) {}
  try { await db.query("ALTER TABLE stations ADD COLUMN notify_expenses INTEGER DEFAULT 1"); } catch(e) {}
  try { await db.query("ALTER TABLE stations ADD COLUMN notify_withdrawals INTEGER DEFAULT 1"); } catch(e) {}
  try { await db.query("ALTER TABLE stations ADD COLUMN notify_commercial_sales INTEGER DEFAULT 1"); } catch(e) {}

  await db.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      station_id INTEGER NOT NULL REFERENCES stations(id),
      subscription_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loans (
      id SERIAL PRIMARY KEY,
      station_id INTEGER NOT NULL REFERENCES stations(id),
      employee_name TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      loan_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loan_repayments (
      id SERIAL PRIMARY KEY,
      loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      amount DOUBLE PRECISION NOT NULL,
      repayment_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      station_id INTEGER REFERENCES stations(id),
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'Employee',
      full_name TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      station_id INTEGER NOT NULL REFERENCES stations(id),
      name TEXT NOT NULL,
      buy_price DOUBLE PRECISION NOT NULL,
      sell_price DOUBLE PRECISION NOT NULL,
      stock_quantity DOUBLE PRECISION DEFAULT 0,
      low_stock_threshold DOUBLE PRECISION DEFAULT 1000,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pumps (
      id SERIAL PRIMARY KEY,
      station_id INTEGER NOT NULL REFERENCES stations(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      name TEXT NOT NULL,
      last_meter_reading_1 DOUBLE PRECISION DEFAULT 0,
      last_meter_reading_2 DOUBLE PRECISION DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS meter_readings (
      id SERIAL PRIMARY KEY,
      station_id INTEGER NOT NULL REFERENCES stations(id),
      pump_id INTEGER NOT NULL REFERENCES pumps(id),
      reading_date DATE NOT NULL,
      opening_meter_1 DOUBLE PRECISION NOT NULL,
      closing_meter_1 DOUBLE PRECISION NOT NULL,
      opening_meter_2 DOUBLE PRECISION NOT NULL,
      closing_meter_2 DOUBLE PRECISION NOT NULL,
      liters_sold DOUBLE PRECISION NOT NULL,
      price_per_liter DOUBLE PRECISION NOT NULL,
      total_amount DOUBLE PRECISION NOT NULL,
      profit DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      station_id INTEGER NOT NULL REFERENCES stations(id),
      expense_date DATE NOT NULL,
      category TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id SERIAL PRIMARY KEY,
      station_id INTEGER NOT NULL REFERENCES stations(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      transaction_date DATE NOT NULL,
      type TEXT NOT NULL,
      quantity DOUBLE PRECISION NOT NULL,
      unit_price DOUBLE PRECISION,
      supplier_name TEXT
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id SERIAL PRIMARY KEY,
      station_id INTEGER NOT NULL REFERENCES stations(id),
      withdrawal_date DATE NOT NULL,
      quantity DOUBLE PRECISION NOT NULL,
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS commercial_sales (
      id SERIAL PRIMARY KEY,
      station_id INTEGER NOT NULL REFERENCES stations(id),
      sale_date DATE NOT NULL,
      quantity DOUBLE PRECISION NOT NULL,
      commercial_price DOUBLE PRECISION NOT NULL,
      default_price DOUBLE PRECISION NOT NULL,
      difference DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await ensureAdmin();
};

initDb().catch(err => console.error("Database initialization failed:", err));

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// --- Middleware ---
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Forbidden" });
    req.user = user;
    next();
  });
};

const checkSubscription = async (req: any, res: any, next: any) => {
  if (req.user.role === 'SuperAdmin') return next();
  
  const rawStationId = req.user.station_id;
  if (rawStationId === undefined || rawStationId === null) {
    return res.status(403).json({ error: "لا يوجد محطة مرتبطة بهذا الحساب", code: "NO_STATION" });
  }
  
  const stationId = Number(rawStationId);
  if (isNaN(stationId)) {
    return res.status(403).json({ error: "رقم المحطة غير صالح", code: "INVALID_STATION_ID" });
  }

  const result = await db.query("SELECT is_active, subscription_expires_at FROM stations WHERE id = $1", [stationId]);
  const station = result.rows[0];
  
  if (!station) {
    console.error(`Station not found for ID: ${stationId} (User: ${req.user.username})`);
    return res.status(403).json({ error: "المحطة غير موجودة أو تم حذفها", code: "STATION_NOT_FOUND" });
  }
  
  if (!station.is_active) {
    return res.status(403).json({ error: "المحطة غير نشطة حالياً", code: "STATION_INACTIVE" });
  }
  
  if (station.subscription_expires_at) {
    const expiry = new Date(station.subscription_expires_at);
    if (expiry < new Date()) {
      return res.status(403).json({ error: "انتهت صلاحية الاشتراك", code: "SUBSCRIPTION_EXPIRED" });
    }
  }
  
  next();
};

// --- Push Notification Helper ---
const sendPushNotification = async (stationId: number, title: string, body: string, type: 'expense' | 'withdrawal' | 'commercial_sale') => {
  try {
    // 1. Check if notifications are enabled for this station and type
    const stationRes = await db.query(`
      SELECT notifications_enabled, notify_expenses, notify_withdrawals, notify_commercial_sales 
      FROM stations WHERE id = $1
    `, [stationId]);
    
    const station = stationRes.rows[0];
    if (!station || !station.notifications_enabled) return;
    
    if (type === 'expense' && !station.notify_expenses) return;
    if (type === 'withdrawal' && !station.notify_withdrawals) return;
    if (type === 'commercial_sale' && !station.notify_commercial_sales) return;

    // 2. Get all subscriptions for the owner of this station
    // We only notify the owner
    const subscriptionsRes = await db.query(`
      SELECT ps.subscription_json, ps.id
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.id
      WHERE ps.station_id = $1 AND u.role = 'Owner'
    `, [stationId]);

    const payload = JSON.stringify({ title, body });

    for (const subRow of subscriptionsRes.rows) {
      try {
        const subscription = JSON.parse(subRow.subscription_json);
        await webpush.sendNotification(subscription, payload);
      } catch (err: any) {
        console.error("Push delivery failed for subscription ID:", subRow.id, err.statusCode);
        // If subscription is invalid/expired, remove it
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db.query("DELETE FROM push_subscriptions WHERE id = $1", [subRow.id]);
        }
      }
    }
  } catch (err) {
    console.error("sendPushNotification error:", err);
  }
};

// --- Routes ---

// Auth
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const result = await db.query(`
    SELECT u.*, s.name as station_name 
    FROM users u 
    LEFT JOIN stations s ON u.station_id = s.id 
    WHERE u.username = $1
  `, [username]);
  const user = result.rows[0];
  
  if (user && bcrypt.compareSync(password, user.password)) {
    // Defensive check for station_id
    const stationId = user.station_id ? Number(user.station_id) : null;
    
    if (user.role !== 'SuperAdmin' && !stationId) {
      console.error(`Login warning: User ${user.username} (role: ${user.role}) has no station_id`);
    }

    const token = jwt.sign({ 
      id: Number(user.id), 
      station_id: stationId, 
      role: user.role, 
      username: user.username,
      station_name: user.station_name 
    }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ 
      token, 
      user: { 
        id: Number(user.id), 
        username: user.username, 
        role: user.role, 
        station_id: stationId, 
        full_name: user.full_name,
        station_name: user.station_name
      } 
    });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// Stations (SuperAdmin only)
app.get("/api/stations", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ error: "Access denied" });
  const result = await db.query("SELECT * FROM stations");
  res.json(result.rows);
});

app.get("/api/station-info", authenticateToken, async (req: any, res) => {
  if (!req.user.station_id) return res.json(null);
  const result = await db.query("SELECT * FROM stations WHERE id = $1", [req.user.station_id]);
  res.json(result.rows[0] || null);
});

app.post("/api/request-manual-activation", authenticateToken, async (req: any, res) => {
  await db.query("UPDATE stations SET subscription_status = 'Pending' WHERE id = $1", [req.user.station_id]);
  res.json({ success: true });
});

app.post("/api/stations", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ error: "Access denied" });
  const { name, address, phone, subscription_plan, months, owner_username, owner_password } = req.body;
  
  if (!name || !owner_username || !owner_password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + parseInt(months || '1'));

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    // Check if username already exists
    const existingUser = await client.query("SELECT id FROM users WHERE username = $1", [owner_username]);
    if (existingUser.rows.length > 0) {
      throw new Error("Username already exists");
    }

    const stationRes = await client.query(
      "INSERT INTO stations (name, address, phone, subscription_plan, subscription_expires_at, is_active, subscription_status, owner_username, owner_password_plain) VALUES ($1, $2, $3, $4, $5, 0, 'Inactive', $6, $7) RETURNING id",
      [name, address, phone, subscription_plan || 'Basic', null, owner_username, owner_password]
    );
    
    const stationId = stationRes.rows[0].id;
    const hashedPassword = bcrypt.hashSync(owner_password, 10);
    
    await client.query(
      "INSERT INTO users (station_id, username, password, role, full_name) VALUES ($1, $2, $3, 'Owner', $4)",
      [stationId, owner_username, hashedPassword, `مالك ${name}`]
    );
    
    await client.query('COMMIT');
    res.json({ id: stationId });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error("Error creating station:", err);
    res.status(400).json({ error: err.message || "Failed to create station" });
  } finally {
    client.release();
  }
});

app.delete("/api/stations/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ error: "Access denied" });
  const { id } = req.params;
  const stationId = parseInt(id);
  
  if (isNaN(stationId)) {
    return res.status(400).json({ error: "Invalid station ID" });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Delete all related data in order to satisfy foreign key constraints
    await client.query("DELETE FROM meter_readings WHERE station_id = $1", [stationId]);
    await client.query("DELETE FROM inventory_transactions WHERE station_id = $1", [stationId]);
    await client.query("DELETE FROM pumps WHERE station_id = $1", [stationId]);
    await client.query("DELETE FROM products WHERE station_id = $1", [stationId]);
    await client.query("DELETE FROM expenses WHERE station_id = $1", [stationId]);
    await client.query("DELETE FROM users WHERE station_id = $1", [stationId]);
    await client.query("DELETE FROM stations WHERE id = $1", [stationId]);
    await client.query('COMMIT');
    
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Delete station error:", err);
    res.status(500).json({ error: "Internal server error during deletion" });
  } finally {
    client.release();
  }
});

app.post("/api/stations/:id/renew", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ error: "Access denied" });
  const { id } = req.params;
  const { months, plan } = req.body;
  
  const result = await db.query("SELECT subscription_expires_at FROM stations WHERE id = $1", [id]);
  const station = result.rows[0];
  if (!station) return res.status(404).json({ error: "Station not found" });

  let currentExpiry = station.subscription_expires_at ? new Date(station.subscription_expires_at) : new Date();
  if (currentExpiry < new Date()) currentExpiry = new Date();
  
  const newExpiry = new Date(currentExpiry);
  newExpiry.setMonth(newExpiry.getMonth() + parseInt(months));
  
  await db.query(
    "UPDATE stations SET subscription_expires_at = $1, subscription_plan = $2, is_active = 1, subscription_status = 'Active' WHERE id = $3",
    [newExpiry.toISOString(), plan || 'Basic', id]
  );
    
  res.json({ success: true, newExpiry: newExpiry.toISOString() });
});

app.post("/api/stations/:id/toggle", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ error: "Access denied" });
  const { id } = req.params;
  const { is_active } = req.body;
  
  await db.query("UPDATE stations SET is_active = $1 WHERE id = $2", [is_active ? 1 : 0, id]);
  res.json({ success: true });
});

app.put("/api/stations/:id", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ error: "Access denied" });
  const { id } = req.params;
  const { name, address, phone, slug, logo_url } = req.body;
  
  try {
    await db.query(
      "UPDATE stations SET name = $1, address = $2, phone = $3, slug = $4, logo_url = $5 WHERE id = $6",
      [name, address, phone, slug, logo_url, id]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error updating station:", err);
    res.status(400).json({ error: err.message || "Failed to update station" });
  }
});

// Public route to get station info by slug
app.get("/api/public/stations/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const result = await db.query("SELECT name, logo_url, slug FROM stations WHERE slug = $1", [slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Station not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Products (Tenant Isolated)
app.get("/api/products", authenticateToken, checkSubscription, async (req: any, res) => {
  const result = await db.query("SELECT * FROM products WHERE station_id = $1", [req.user.station_id]);
  res.json(result.rows);
});

app.post("/api/products", authenticateToken, checkSubscription, async (req: any, res) => {
  const { name, buy_price, sell_price, low_stock_threshold } = req.body;
  const result = await db.query(
    "INSERT INTO products (station_id, name, buy_price, sell_price, low_stock_threshold) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [req.user.station_id, name, buy_price, sell_price, low_stock_threshold]
  );
  res.json({ id: result.rows[0].id });
});

app.put("/api/products/:id", authenticateToken, checkSubscription, async (req: any, res) => {
  const { id } = req.params;
  const { buy_price, sell_price, low_stock_threshold, name } = req.body;
  
  await db.query(`
    UPDATE products 
    SET buy_price = $1, sell_price = $2, low_stock_threshold = $3, name = $4
    WHERE id = $5 AND station_id = $6
  `, [buy_price, sell_price, low_stock_threshold, name, id, req.user.station_id]);
  
  res.json({ success: true });
});

// Pumps (Tenant Isolated)
app.get("/api/pumps", authenticateToken, checkSubscription, async (req: any, res) => {
  const result = await db.query(`
    SELECT p.*, pr.name as product_name 
    FROM pumps p 
    JOIN products pr ON p.product_id = pr.id 
    WHERE p.station_id = $1
  `, [req.user.station_id]);
  res.json(result.rows);
});

app.post("/api/pumps", authenticateToken, checkSubscription, async (req: any, res) => {
  const { product_id, name } = req.body;
  const result = await db.query(
    "INSERT INTO pumps (station_id, product_id, name) VALUES ($1, $2, $3) RETURNING id",
    [req.user.station_id, product_id, name]
  );
  res.json({ id: result.rows[0].id });
});

// Meter Readings (Tenant Isolated)
app.get("/api/meter-readings", authenticateToken, checkSubscription, async (req: any, res) => {
  const { date } = req.query;
  const result = await db.query(`
    SELECT m.*, p.name as pump_name, pr.name as product_name
    FROM meter_readings m
    JOIN pumps p ON m.pump_id = p.id
    JOIN products pr ON p.product_id = pr.id
    WHERE m.station_id = $1 AND m.reading_date = $2
  `, [req.user.station_id, date]);
  res.json(result.rows);
});

app.post("/api/meter-readings", authenticateToken, checkSubscription, async (req: any, res) => {
  const { pump_id, reading_date, opening_meter_1, closing_meter_1, opening_meter_2, closing_meter_2 } = req.body;
  
  // Validation
  if (closing_meter_1 < opening_meter_1 || closing_meter_2 < opening_meter_2) {
    return res.status(400).json({ error: "Closing meter cannot be less than opening meter" });
  }
  
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    const pumpRes = await client.query("SELECT * FROM pumps WHERE id = $1 AND station_id = $2", [pump_id, req.user.station_id]);
    const pump = pumpRes.rows[0];
    if (!pump) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Pump not found" });
    }

    const productRes = await client.query("SELECT * FROM products WHERE id = $1 AND station_id = $2", [pump.product_id, req.user.station_id]);
    const product = productRes.rows[0];
    if (!product) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Product not found" });
    }
    
    const liters_sold_1 = closing_meter_1 - opening_meter_1;
    const liters_sold_2 = closing_meter_2 - opening_meter_2;
    const liters_sold = liters_sold_1 + liters_sold_2;
    
    const total_amount = liters_sold * product.sell_price;
    const profit = liters_sold * (product.sell_price - product.buy_price);

    // Insert reading
    await client.query(`
      INSERT INTO meter_readings (
        station_id, pump_id, reading_date, 
        opening_meter_1, closing_meter_1, 
        opening_meter_2, closing_meter_2, 
        liters_sold, price_per_liter, total_amount, profit
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      req.user.station_id, pump_id, reading_date, 
      opening_meter_1, closing_meter_1, 
      opening_meter_2, closing_meter_2, 
      liters_sold, product.sell_price, total_amount, profit
    ]);

    // Update pump last readings
    await client.query("UPDATE pumps SET last_meter_reading_1 = $1, last_meter_reading_2 = $2 WHERE id = $3",
      [closing_meter_1, closing_meter_2, pump_id]);

    // Update product stock
    await client.query("UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2", [liters_sold, product.id]);

    // Record inventory transaction
    await client.query("INSERT INTO inventory_transactions (station_id, product_id, transaction_date, type, quantity) VALUES ($1, $2, $3, 'OUT', $4)",
      [req.user.station_id, product.id, reading_date, liters_sold]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Meter reading error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Inventory Transactions (Imports)
app.get("/api/inventory-transactions", authenticateToken, checkSubscription, async (req: any, res) => {
  const { date } = req.query;
  let query = "SELECT t.*, p.name as product_name FROM inventory_transactions t JOIN products p ON t.product_id = p.id WHERE t.station_id = $1 AND t.type = 'IN'";
  const params: any[] = [req.user.station_id];

  if (date) {
    query += " AND t.transaction_date = $2";
    params.push(date);
  }

  query += " ORDER BY t.id DESC";
  const result = await db.query(query, params);
  res.json(result.rows);
});

app.post("/api/inventory-transactions", authenticateToken, checkSubscription, async (req: any, res) => {
  const { product_id, transaction_date, quantity, unit_price, supplier_name } = req.body;
  
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Check if product exists
    const productCheck = await client.query("SELECT id FROM products WHERE id = $1 AND station_id = $2", [product_id, req.user.station_id]);
    if (!productCheck.rows || productCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Product not found" });
    }

    // Record transaction
    await client.query(
      "INSERT INTO inventory_transactions (station_id, product_id, transaction_date, type, quantity, unit_price, supplier_name) VALUES ($1, $2, $3, 'IN', $4, $5, $6)",
      [req.user.station_id, product_id, transaction_date, quantity, unit_price, supplier_name]
    );
    
    // Update product stock and buy price
    await client.query("UPDATE products SET stock_quantity = stock_quantity + $1, buy_price = $2 WHERE id = $3",
      [quantity, unit_price, product_id]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Inventory transaction error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

app.delete("/api/inventory-transactions/:id", authenticateToken, checkSubscription, async (req: any, res) => {
  const { id } = req.params;
  const result = await db.query("SELECT * FROM inventory_transactions WHERE id = $1 AND station_id = $2", [id, req.user.station_id]);
  const transaction = result.rows[0];
  
  if (!transaction) return res.status(404).json({ error: "Transaction not found" });
  
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Revert stock change
    if (transaction.type === 'IN') {
      await client.query("UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2", [transaction.quantity, transaction.product_id]);
    } else {
      await client.query("UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2", [transaction.quantity, transaction.product_id]);
    }
    
    await client.query("DELETE FROM inventory_transactions WHERE id = $1", [id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Delete transaction error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Dashboard Stats
app.post("/api/dashboard/recalculate", authenticateToken, checkSubscription, async (req: any, res) => {
  const { date } = req.body;
  
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const readingsRes = await client.query("SELECT * FROM meter_readings WHERE station_id = $1 AND reading_date = $2", [req.user.station_id, date]);
    const readings = readingsRes.rows;
    
    for (const reading of readings) {
      const productRes = await client.query(`
        SELECT pr.* 
        FROM products pr
        JOIN pumps p ON p.product_id = pr.id
        WHERE p.id = $1
      `, [reading.pump_id]);
      const product = productRes.rows[0];
      
      if (product) {
        const total_amount = reading.liters_sold * product.sell_price;
        const profit = reading.liters_sold * (product.sell_price - product.buy_price);
        
        await client.query(`
          UPDATE meter_readings 
          SET price_per_liter = $1, total_amount = $2, profit = $3
          WHERE id = $4
        `, [product.sell_price, total_amount, profit, reading.id]);
      }
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Recalculate error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

app.get("/api/dashboard/stats", authenticateToken, checkSubscription, async (req: any, res) => {
  const { date } = req.query;
  
  const productStatsRes = await db.query(`
    SELECT 
      pr.name, 
      SUM(m.liters_sold) as total_liters, 
      SUM(m.total_amount) as total_sales, 
      SUM(m.profit) as total_profit,
      pr.stock_quantity,
      pr.low_stock_threshold
    FROM products pr
    LEFT JOIN pumps p ON p.product_id = pr.id
    LEFT JOIN meter_readings m ON m.pump_id = p.id AND m.reading_date = $1
    WHERE pr.station_id = $2
    GROUP BY pr.id, pr.name, pr.stock_quantity, pr.low_stock_threshold
  `, [date, req.user.station_id]);

  const totalExpensesRes = await db.query("SELECT SUM(amount) as total FROM expenses WHERE station_id = $1 AND expense_date = $2",
    [req.user.station_id, date]);

  const withdrawalsRes = await db.query("SELECT * FROM withdrawals WHERE station_id = $1 AND withdrawal_date = $2",
    [req.user.station_id, date]);
  
  const commercialSalesRes = await db.query("SELECT SUM(quantity) as total_liters, SUM(difference) as total_diff FROM commercial_sales WHERE station_id = $1 AND sale_date = $2",
    [req.user.station_id, date]);

  res.json({
    products: productStatsRes.rows,
    totalExpenses: totalExpensesRes.rows[0]?.total || 0,
    withdrawals: withdrawalsRes.rows,
    commercialSummary: {
      totalLiters: commercialSalesRes.rows[0]?.total_liters || 0,
      totalDiff: commercialSalesRes.rows[0]?.total_diff || 0
    }
  });
});

// Reports
app.get("/api/reports", authenticateToken, checkSubscription, async (req: any, res) => {
  const { type, date } = req.query; // type: daily, monthly, yearly. date: YYYY-MM-DD or YYYY-MM or YYYY
  let dateFilter = "";
  let queryParams: any[] = [];

  if (type === 'daily') {
    dateFilter = "AND m.reading_date = $1";
    queryParams.push(date);
  } else if (type === 'monthly') {
    dateFilter = usePostgres 
      ? "AND TO_CHAR(m.reading_date, 'YYYY-MM') = $1" 
      : "AND strftime('%Y-%m', m.reading_date) = $1";
    queryParams.push(date);
  } else if (type === 'yearly') {
    dateFilter = usePostgres 
      ? "AND TO_CHAR(m.reading_date, 'YYYY') = $1" 
      : "AND strftime('%Y', m.reading_date) = $1";
    queryParams.push(date);
  }
  
  queryParams.push(req.user.station_id);
  const stationIdParamIndex = queryParams.length;

  const productStatsRes = await db.query(`
    SELECT 
      pr.name, 
      COALESCE(SUM(m.liters_sold), 0) as total_liters, 
      COALESCE(SUM(m.total_amount), 0) as total_sales, 
      COALESCE(SUM(m.profit), 0) as total_profit
    FROM products pr
    LEFT JOIN pumps p ON p.product_id = pr.id
    LEFT JOIN meter_readings m ON m.pump_id = p.id ${dateFilter}
    WHERE pr.station_id = $${stationIdParamIndex}
    GROUP BY pr.id, pr.name
  `, queryParams);

  let expenseParams: any[] = [req.user.station_id];
  let expenseFilter = "";
  if (type === 'daily') {
    expenseFilter = "AND expense_date = $2";
    expenseParams.push(date);
  } else if (type === 'monthly') {
    expenseFilter = usePostgres 
      ? "AND TO_CHAR(expense_date, 'YYYY-MM') = $2" 
      : "AND strftime('%Y-%m', expense_date) = $2";
    expenseParams.push(date);
  } else if (type === 'yearly') {
    expenseFilter = usePostgres 
      ? "AND TO_CHAR(expense_date, 'YYYY') = $2" 
      : "AND strftime('%Y', expense_date) = $2";
    expenseParams.push(date);
  }

  const totalExpensesRes = await db.query(`SELECT SUM(amount) as total FROM expenses WHERE station_id = $1 ${expenseFilter}`,
    expenseParams);

  res.json({
    products: productStatsRes.rows,
    totalExpenses: totalExpensesRes.rows[0]?.total || 0
  });
});

// Expenses
app.get("/api/expenses", authenticateToken, checkSubscription, async (req: any, res) => {
  const { date } = req.query;
  const result = await db.query("SELECT * FROM expenses WHERE station_id = $1 AND expense_date = $2",
    [req.user.station_id, date]);
  res.json(result.rows);
});

app.post("/api/expenses", authenticateToken, checkSubscription, async (req: any, res) => {
  const { expense_date, category, amount, notes } = req.body;
  await db.query("INSERT INTO expenses (station_id, expense_date, category, amount, notes) VALUES ($1, $2, $3, $4, $5)",
    [req.user.station_id, expense_date, category, amount, notes]);
  
  // Trigger notification
  sendPushNotification(
    req.user.station_id, 
    "مصروف جديد", 
    `تمت إضافة مصروف: ${category}\nالمبلغ: ${amount.toLocaleString()} د.ع\nبواسطة: ${req.user.username}\nالوقت: ${new Date().toLocaleTimeString('ar-IQ')}`,
    'expense'
  );

  res.json({ success: true });
});

// Withdrawals
app.get("/api/withdrawals", authenticateToken, checkSubscription, async (req: any, res) => {
  const { date } = req.query;
  const result = await db.query("SELECT * FROM withdrawals WHERE station_id = $1 AND withdrawal_date = $2",
    [req.user.station_id, date]);
  res.json(result.rows);
});

app.post("/api/withdrawals", authenticateToken, checkSubscription, async (req: any, res) => {
  const { withdrawal_date, quantity, reason } = req.body;
  
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    // Insert withdrawal
    await client.query("INSERT INTO withdrawals (station_id, withdrawal_date, quantity, reason) VALUES ($1, $2, $3, $4)",
      [req.user.station_id, withdrawal_date, quantity, reason]);
    
    // Deduct from fuel stock
    const productRes = await client.query("SELECT id FROM products WHERE station_id = $1 AND (name LIKE '%كاز%' OR name LIKE '%ديزل%') LIMIT 1", [req.user.station_id]);
    if (!productRes.rows || !productRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Fuel product (Gas/Diesel) not found for this station. Please ensure a product with 'كاز' or 'ديزل' in its name exists." });
    }

    await client.query("UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2", [quantity, productRes.rows[0].id]);
      
      // Record inventory transaction
      await client.query("INSERT INTO inventory_transactions (station_id, product_id, transaction_date, type, quantity) VALUES ($1, $2, $3, 'OUT', $4)",
        [req.user.station_id, productRes.rows[0].id, withdrawal_date, quantity]);

    await client.query('COMMIT');

    // Trigger notification
    sendPushNotification(
      req.user.station_id, 
      "سحب وقود جديد", 
      `تم تسجيل سحب: ${quantity.toLocaleString()} لتر\nالسبب: ${reason || 'غير محدد'}\nبواسطة: ${req.user.username}\nالوقت: ${new Date().toLocaleTimeString('ar-IQ')}`,
      'withdrawal'
    );

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Withdrawal error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

app.delete("/api/withdrawals/:id", authenticateToken, checkSubscription, async (req: any, res) => {
  const { id } = req.params;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const resW = await client.query("SELECT * FROM withdrawals WHERE id = $1 AND station_id = $2", [id, req.user.station_id]);
    const withdrawal = resW.rows[0];
    // Revert stock
    if (withdrawal) {
      const productRes = await client.query("SELECT id FROM products WHERE station_id = $1 AND (name LIKE '%كاز%' OR name LIKE '%ديزل%') LIMIT 1", [req.user.station_id]);
      if (productRes.rows && productRes.rows[0]) {
        await client.query("UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2", [withdrawal.quantity, productRes.rows[0].id]);
      }
      await client.query("DELETE FROM withdrawals WHERE id = $1", [id]);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Commercial Sales
app.get("/api/commercial-sales", authenticateToken, checkSubscription, async (req: any, res) => {
  const { date } = req.query;
  const result = await db.query("SELECT * FROM commercial_sales WHERE station_id = $1 AND sale_date = $2",
    [req.user.station_id, date]);
  res.json(result.rows);
});

app.post("/api/commercial-sales", authenticateToken, checkSubscription, async (req: any, res) => {
  const { sale_date, quantity, commercial_price } = req.body;
  
  try {
    // Fetch the default price of "كاز السيارات" or similar
    const productRes = await db.query(
      "SELECT sell_price FROM products WHERE station_id = $1 AND (name LIKE '%كاز%' OR name LIKE '%ديزل%') LIMIT 1", 
      [req.user.station_id]
    );
    
    if (!productRes.rows || !productRes.rows[0]) {
      return res.status(404).json({ error: "Fuel product (Gas/Diesel) not found for this station. Please ensure a product with 'كاز' or 'ديزل' in its name exists." });
    }
    
    const default_price = productRes.rows[0].sell_price;
    const difference = (commercial_price - default_price) * quantity;
    
    await db.query(
      "INSERT INTO commercial_sales (station_id, sale_date, quantity, commercial_price, default_price, difference) VALUES ($1, $2, $3, $4, $5, $6)",
      [req.user.station_id, sale_date, quantity, commercial_price, default_price, difference]
    );
    
    // Trigger notification
    sendPushNotification(
      req.user.station_id, 
      "بيع تجاري جديد", 
      `تم تسجيل بيع تجاري: ${quantity.toLocaleString()} لتر\nالسعر: ${commercial_price.toLocaleString()} د.ع\nبواسطة: ${req.user.username}\nالوقت: ${new Date().toLocaleTimeString('ar-IQ')}`,
      'commercial_sale'
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Commercial sale error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/commercial-sales/:id", authenticateToken, checkSubscription, async (req: any, res) => {
  const { id } = req.params;
  await db.query("DELETE FROM commercial_sales WHERE id = $1 AND station_id = $2", [id, req.user.station_id]);
  res.json({ success: true });
});

// --- Loans ---

app.get("/api/loans", authenticateToken, checkSubscription, async (req: any, res) => {
  if (req.user.role === 'Employee') return res.status(403).json({ error: "Access denied" });
  
  // Get loans with total paid amount
  const result = await db.query(`
    SELECT l.*, 
           COALESCE(SUM(lr.amount), 0) as total_paid
    FROM loans l
    LEFT JOIN loan_repayments lr ON l.id = lr.loan_id
    WHERE l.station_id = $1
    GROUP BY l.id
    ORDER BY l.loan_date DESC
  `, [req.user.station_id]);
  
  res.json(result.rows);
});

app.post("/api/loans", authenticateToken, checkSubscription, async (req: any, res) => {
  if (req.user.role === 'Employee') return res.status(403).json({ error: "Access denied" });
  const { employee_name, amount, loan_date } = req.body;
  
  await db.query("INSERT INTO loans (station_id, employee_name, amount, loan_date) VALUES ($1, $2, $3, $4)",
    [req.user.station_id, employee_name, amount, loan_date]);
    
  res.json({ success: true });
});

app.delete("/api/loans/:id", authenticateToken, checkSubscription, async (req: any, res) => {
  if (req.user.role === 'Employee') return res.status(403).json({ error: "Access denied" });
  const { id } = req.params;
  
  await db.query("DELETE FROM loans WHERE id = $1 AND station_id = $2", [id, req.user.station_id]);
  res.json({ success: true });
});

app.post("/api/loans/:id/repay", authenticateToken, checkSubscription, async (req: any, res) => {
  if (req.user.role === 'Employee') return res.status(403).json({ error: "Access denied" });
  const { id } = req.params;
  const { amount, repayment_date } = req.body;
  
  // Verify loan belongs to station
  const loanCheck = await db.query("SELECT id FROM loans WHERE id = $1 AND station_id = $2", [id, req.user.station_id]);
  if (loanCheck.rows.length === 0) return res.status(404).json({ error: "Loan not found" });

  await db.query("INSERT INTO loan_repayments (loan_id, amount, repayment_date) VALUES ($1, $2, $3)",
    [id, amount, repayment_date]);
    
  res.json({ success: true });
});

app.get("/api/loans/:id/history", authenticateToken, checkSubscription, async (req: any, res) => {
  if (req.user.role === 'Employee') return res.status(403).json({ error: "Access denied" });
  const { id } = req.params;
  
  // Verify loan belongs to station
  const loanCheck = await db.query("SELECT id FROM loans WHERE id = $1 AND station_id = $2", [id, req.user.station_id]);
  if (loanCheck.rows.length === 0) return res.status(404).json({ error: "Loan not found" });

  const result = await db.query("SELECT * FROM loan_repayments WHERE loan_id = $1 ORDER BY repayment_date DESC", [id]);
  res.json(result.rows);
});

// --- Notifications ---

app.get("/api/notifications/vapid-public-key", authenticateToken, (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post("/api/notifications/subscribe", authenticateToken, async (req: any, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: "Missing subscription" });

  const subscriptionJson = JSON.stringify(subscription);
  
  // Check if subscription already exists for this user
  const existing = await db.query("SELECT id FROM push_subscriptions WHERE user_id = $1 AND subscription_json = $2", 
    [req.user.id, subscriptionJson]);
    
  if (existing.rows.length === 0) {
    await db.query("INSERT INTO push_subscriptions (user_id, station_id, subscription_json) VALUES ($1, $2, $3)",
      [req.user.id, req.user.station_id, subscriptionJson]);
  }
  
  res.json({ success: true });
});

app.post("/api/notifications/unsubscribe", authenticateToken, async (req: any, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: "Missing subscription" });

  const subscriptionJson = JSON.stringify(subscription);
  await db.query("DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription_json = $2",
    [req.user.id, subscriptionJson]);
    
  res.json({ success: true });
});

app.put("/api/station-info/notifications", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'Owner') return res.status(403).json({ error: "Access denied" });
  const { notifications_enabled } = req.body;
  
  await db.query("UPDATE stations SET notifications_enabled = $1 WHERE id = $2", 
    [notifications_enabled ? 1 : 0, req.user.station_id]);
    
  res.json({ success: true });
});

// Update notification settings (SuperAdmin)
app.put("/api/stations/:id/notification-settings", authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ error: "Access denied" });
  const { id } = req.params;
  const { notifications_enabled, notify_expenses, notify_withdrawals, notify_commercial_sales } = req.body;
  
  await db.query(`
    UPDATE stations 
    SET notifications_enabled = $1, notify_expenses = $2, notify_withdrawals = $3, notify_commercial_sales = $4
    WHERE id = $5
  `, [
    notifications_enabled ? 1 : 0, 
    notify_expenses ? 1 : 0, 
    notify_withdrawals ? 1 : 0, 
    notify_commercial_sales ? 1 : 0, 
    id
  ]);
  
  res.json({ success: true });
});

// --- Stripe Endpoints ---

app.post("/api/create-checkout-session", authenticateToken, async (req: any, res) => {
  const { plan } = req.body;
  const priceId = (PLANS as any)[plan];

  if (!priceId) {
    return res.status(400).json({ error: "Invalid plan selected" });
  }

  try {
    const result = await db.query("SELECT * FROM stations WHERE id = $1", [req.user.station_id]);
    const station = result.rows[0];
    
    let customerId = station.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.username, // Using username as email for now
        name: station.name,
        metadata: { station_id: req.user.station_id.toString() }
      });
      customerId = customer.id;
      await db.query("UPDATE stations SET stripe_customer_id = $1 WHERE id = $2", [customerId, req.user.station_id]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.APP_URL}/?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.APP_URL}/?success=false`,
      metadata: {
        station_id: req.user.station_id.toString(),
        plan: plan
      }
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe session error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Webhook handler
app.post("/api/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      const stationId = session.metadata.station_id;
      const plan = session.metadata.plan;
      const subscriptionId = session.subscription;

      // Update station subscription
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1); // Default to 1 month for now, or get from Stripe

      await db.query("UPDATE stations SET subscription_plan = $1, subscription_expires_at = $2, stripe_subscription_id = $3, is_active = 1 WHERE id = $4",
        [plan, expiresAt.toISOString(), subscriptionId, stationId]);
      
      console.log(`Subscription completed for station ${stationId}`);
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as any;
      const result = await db.query("SELECT id FROM stations WHERE stripe_subscription_id = $1", [subscription.id]);
      const station = result.rows[0];
      if (station) {
        await db.query("UPDATE stations SET is_active = 0 WHERE id = $1", [station.id]);
        console.log(`Subscription deleted for station ${station.id}`);
      }
      break;
    }
  }

  res.json({ received: true });
});

// --- Vite Setup ---
async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      console.log("Starting Vite in middleware mode...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      console.log("Starting in production mode...");
      app.use(express.static(path.join(__dirname, ".." , "dist")));
      app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, ".." , "dist", "index.html"));
      });
    }

    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
