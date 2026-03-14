import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('canteen.db');
const JWT_SECRET = process.env.JWT_SECRET || 'canteen-secret-key';

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    status TEXT DEFAULT 'available',
    available_at TEXT,
    category TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    phone TEXT,
    customer_name TEXT,
    payment_proof TEXT,
    transaction_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    user_id INTEGER,
    rating INTEGER,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Migration: Add user_id to orders and feedback if they don't exist
const orderTableInfo = db.prepare("PRAGMA table_info(orders)").all() as any[];
if (!orderTableInfo.map(c => c.name).includes('user_id')) {
  db.prepare("ALTER TABLE orders ADD COLUMN user_id INTEGER").run();
}

const feedbackTableInfo = db.prepare("PRAGMA table_info(feedback)").all() as any[];
if (!feedbackTableInfo.map(c => c.name).includes('user_id')) {
  db.prepare("ALTER TABLE feedback ADD COLUMN user_id INTEGER").run();
}

// Ensure other columns exist from previous turns
if (!orderTableInfo.map(c => c.name).includes('customer_name')) {
  db.prepare("ALTER TABLE orders ADD COLUMN customer_name TEXT").run();
}
if (!orderTableInfo.map(c => c.name).includes('payment_proof')) {
  db.prepare("ALTER TABLE orders ADD COLUMN payment_proof TEXT").run();
}
if (!orderTableInfo.map(c => c.name).includes('transaction_id')) {
  db.prepare("ALTER TABLE orders ADD COLUMN transaction_id TEXT").run();
}

// Seed initial data if empty
const mealCount = db.prepare('SELECT COUNT(*) as count FROM meals').get() as { count: number };
if (mealCount.count === 0) {
  const insertMeal = db.prepare('INSERT INTO meals (name, description, price, category) VALUES (?, ?, ?, ?)');
  insertMeal.run('Sadza & Beef', 'Traditional Zimbabwean staple with tender beef stew', 1.50, 'Main');
  insertMeal.run('Sadza & Chicken', 'Flame grilled chicken with sadza and greens', 1.50, 'Main');
  insertMeal.run('Rice & Chicken', 'Savory chicken served with white rice', 1.50, 'Main');
  insertMeal.run('Rice & Beef', 'Tender beef stew served with white rice', 1.50, 'Main');
  insertMeal.run('Sadza & Beans', 'Savory beans served with sadza', 1.00, 'Vegetarian');
  insertMeal.run('Pepsi 500ml', 'Refreshing cold beverage', 0.50, 'Drinks');
  insertMeal.run('Fresh Chips', 'Hot and crispy potato chips', 1.00, 'Sides');
}

// Seed default settings
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('ecocash_number', '0771234567')").run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_password', 'canteen123')").run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('ecocash_charges', '0.05')").run();
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('canteen_notice', 'Welcome to CanteenConnect! Today we have fresh Sadza.')").run();

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // WebSocket connection handling
  const clients = new Set<WebSocket>();
  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
  });

  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Auth Routes
  app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword);
      const token = jwt.sign({ id: result.lastInsertRowid, username }, JWT_SECRET);
      res.json({ token, user: { id: result.lastInsertRowid, username } });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: 'Username already exists' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username } });
  });

  app.post('/api/auth/change-admin-password', (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const adminPasswordSetting = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string };
    
    if (currentPassword !== adminPasswordSetting.value) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }

    db.prepare("UPDATE settings SET value = ? WHERE key = 'admin_password'").run(newPassword);
    res.json({ success: true });
  });

  // API Routes
  app.get('/api/settings', (req, res) => {
    const settings = db.prepare('SELECT * FROM settings').all();
    const settingsObj = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(settingsObj);
  });

  app.post('/api/settings', (req, res) => {
    const { key, value } = req.body;
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    res.json({ success: true });
  });

  app.get('/api/meals', (req, res) => {
    const meals = db.prepare('SELECT * FROM meals').all();
    res.json(meals);
  });

  app.post('/api/meals', (req, res) => {
    const { name, description, price, category } = req.body;
    const result = db.prepare('INSERT INTO meals (name, description, price, category) VALUES (?, ?, ?, ?)').run(
      name, description, price, category
    );
    broadcast({ type: 'MEAL_UPDATE' });
    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.put('/api/meals/:id', (req, res) => {
    const { id } = req.params;
    const { name, description, price, category, status } = req.body;
    db.prepare('UPDATE meals SET name = ?, description = ?, price = ?, category = ?, status = ? WHERE id = ?').run(
      name, description, price, category, status, id
    );
    broadcast({ type: 'MEAL_UPDATE', id });
    res.json({ success: true });
  });

  app.delete('/api/meals/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM meals WHERE id = ?').run(id);
    broadcast({ type: 'MEAL_UPDATE' });
    res.json({ success: true });
  });

  app.post('/api/meals/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, available_at } = req.body;
    db.prepare('UPDATE meals SET status = ?, available_at = ? WHERE id = ?').run(status, available_at, id);
    broadcast({ type: 'MEAL_UPDATE', id });
    res.json({ success: true });
  });

  app.get('/api/orders', (req, res) => {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    res.json(orders.map((o: any) => ({ ...o, items: JSON.parse(o.items) })));
  });

  app.get('/api/my-orders', authenticateToken, (req: any, res) => {
    const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json(orders.map((o: any) => ({ ...o, items: JSON.parse(o.items) })));
  });

  app.post('/api/orders', (req, res) => {
    try {
      const { items, total, type, phone, customer_name, payment_proof, transaction_id, user_id } = req.body;
      if (!items || !total || !type || !phone || !customer_name || (!payment_proof && !transaction_id)) {
        return res.status(400).json({ error: 'Missing required fields. Please provide payment proof or transaction ID.' });
      }
      const result = db.prepare('INSERT INTO orders (items, total, type, phone, customer_name, payment_proof, transaction_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        JSON.stringify(items), total, type, phone, customer_name, payment_proof || null, transaction_id || null, user_id || null
      );
      const orderId = result.lastInsertRowid;
      broadcast({ type: 'NEW_ORDER', orderId });
      res.json({ success: true, orderId });
    } catch (error: any) {
      console.error('Order creation error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  app.post('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
    broadcast({ type: 'ORDER_STATUS_UPDATE', id, status });
    res.json({ success: true });
  });

  app.post('/api/feedback', authenticateToken, (req: any, res) => {
    const { order_id, rating, comment } = req.body;
    db.prepare('INSERT INTO feedback (order_id, rating, comment, user_id) VALUES (?, ?, ?, ?)').run(order_id, rating, comment, req.user.id);
    res.json({ success: true });
  });

  app.get('/api/feedback', (req, res) => {
    const feedback = db.prepare(`
      SELECT f.*, o.items, u.username 
      FROM feedback f 
      LEFT JOIN orders o ON f.order_id = o.id 
      LEFT JOIN users u ON f.user_id = u.id
      ORDER BY f.created_at DESC
    `).all();
    res.json(feedback);
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
