require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const USER = process.env.ADMIN_USERNAME || "M6813.mm";
const PASS = process.env.ADMIN_PASSWORD;
const mongoUri = process.env.MONGODB_URI;
const sessionSecret = process.env.SESSION_SECRET;

if (!PASS || PASS.includes("Put-A-Long")) {
  console.error("Set ADMIN_PASSWORD in your .env file before starting.");
  process.exit(1);
}
if (!sessionSecret || sessionSecret.includes("replace-this")) {
  console.error("Set a long random SESSION_SECRET in your .env file.");
  process.exit(1);
}

const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
const productsFile = path.join(dataDir, "products.json");
const settingsFile = path.join(dataDir, "site-settings.json");
if (!fs.existsSync(productsFile)) fs.writeFileSync(productsFile, "[]");
const defaultSettings = {
  brand: "M6813.mm", eyebrow: "فروشگاه لوازم هنری و گل‌سازی",
  headline: "رنگ و زیبایی برای هنر دست شما",
  subtitle: "انواع پیپ‌پاکن، روبان و ملزومات ساخت گل‌های دست‌ساز",
  buttonText: "دیدن محصولات", productsTitle: "محصولات", reelsTitle: "ریلزها",
  reelsEyebrow: "ویدئوهای کوتاه فروشگاه", aboutTitle: "درباره فروشگاه",
  aboutText: "به فروشگاه ما خوش آمدید؛ اینجا می‌توانید لوازم موردنیاز هنر گل‌سازی را پیدا کنید.",
  announcement: "", phone: "", instagram: "", footer: "ساخته‌شده با عشق ❤️"
};
if (!fs.existsSync(settingsFile)) fs.writeFileSync(settingsFile, JSON.stringify(defaultSettings, null, 2));
const SiteSettings = mongoUri ? mongoose.model("SiteSettings", new mongoose.Schema({ key: String, value: mongoose.Schema.Types.Mixed })) : null;

const Reel = mongoUri ? mongoose.model("Reel", new mongoose.Schema({
  title: { type: String, required: true },
  description: String, video: String,
  createdAt: { type: Date, default: Date.now }
})) : null;
const Product = mongoUri ? mongoose.model("Product", new mongoose.Schema({
  name: { type: String, required: true },
  category: String, price: String, description: String, image: String,
  createdAt: { type: Date, default: Date.now }
})) : null;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "public")));

const sessionOptions = {
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === "production" }
};
if (mongoUri) sessionOptions.store = MongoStore.create({ mongoUrl: mongoUri, ttl: 30 * 24 * 60 * 60 });
app.use(session(sessionOptions));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2, 9) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const isImage = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
    const isVideo = /^video\/(mp4|webm|quicktime)$/.test(file.mimetype);
    cb(null, isImage || isVideo);
  }
});

function adminOnly(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: "برای این کار باید وارد پنل مدیریت شوید." });
}
async function getProducts() {
  if (Product) return Product.find().sort({ createdAt: -1 }).lean();
  return JSON.parse(fs.readFileSync(productsFile, "utf8"));
}
app.get("/api/products", async (_, res) => {
  try { res.json(await getProducts()); } catch { res.status(500).json({error:"خطا در دریافت محصولات"}); }
});
async function getSiteSettings() {
  if (SiteSettings) {
    const doc = await SiteSettings.findOne({ key: "main" }).lean();
    return { ...defaultSettings, ...(doc?.value || {}) };
  }
  return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsFile, "utf8")) };
}
app.get("/api/site-settings", async (_, res) => {
  try { res.json(await getSiteSettings()); } catch { res.status(500).json({ error: "خطا در دریافت متن‌های سایت" }); }
});
app.put("/api/site-settings", adminOnly, async (req, res) => {
  try {
    const allowed = Object.keys(defaultSettings);
    const values = {};
    for (const key of allowed) values[key] = String(req.body?.[key] ?? "").trim().slice(0, key === "aboutText" ? 3000 : 500);
    if (!values.brand || !values.headline) return res.status(400).json({ error: "نام فروشگاه و تیتر اصلی نمی‌توانند خالی باشند." });
    if (SiteSettings) await SiteSettings.updateOne({ key: "main" }, { $set: { value: values } }, { upsert: true });
    else fs.writeFileSync(settingsFile, JSON.stringify(values, null, 2));
    res.json({ ok: true, settings: values });
  } catch { res.status(500).json({ error: "ذخیره متن‌های سایت انجام نشد." }); }
});
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (username !== USER || typeof password !== "string" || password.length > 200) return res.status(401).json({error:"نام کاربری یا رمز عبور نادرست است."});
  // Password is compared using a hash, not stored in the product database.
  const hash = await bcrypt.hash(PASS, 12);
  if (!(await bcrypt.compare(password, hash))) return res.status(401).json({error:"نام کاربری یا رمز عبور نادرست است."});
  req.session.regenerate(err => {
    if (err) return res.status(500).json({error:"خطا در ورود"});
    req.session.isAdmin = true;
    req.session.save(() => res.json({ok:true}));
  });
});
app.post("/api/logout", (req,res) => req.session.destroy(() => {
  res.clearCookie("connect.sid"); res.json({ok:true});
}));
app.get("/api/me", (req,res) => res.json({isAdmin:!!req.session?.isAdmin}));
app.post("/api/products", adminOnly, upload.single("image"), async (req,res) => {
  try {
    const {name,category,price,description} = req.body;
    if (!name || !name.trim()) return res.status(400).json({error:"نام محصول لازم است."});
    const item = {id:Date.now().toString(),name:name.trim(),category:category||"سایر",price:price||"تماس بگیرید",description:description||"",image:req.file?"/uploads/"+req.file.filename:"",createdAt:new Date().toISOString()};
    if (Product) await Product.create(item);
    else {
      const list = JSON.parse(fs.readFileSync(productsFile,"utf8"));
      list.unshift(item); fs.writeFileSync(productsFile,JSON.stringify(list,null,2));
    }
    res.json({ok:true});
  } catch { res.status(500).json({error:"ذخیره محصول انجام نشد."}); }
});
app.delete("/api/products/:id", adminOnly, async (req,res) => {
  try {
    if (Product) await Product.deleteOne({_id:req.params.id});
    else {
      const list = JSON.parse(fs.readFileSync(productsFile,"utf8"));
      const next = list.filter(p=>p.id!==req.params.id);
      fs.writeFileSync(productsFile,JSON.stringify(next,null,2));
    }
    res.json({ok:true});
  } catch { res.status(500).json({error:"حذف محصول انجام نشد."}); }
});

async function getReels() {
  if (Reel) return Reel.find().sort({ createdAt: -1 }).lean();
  const file = path.join(dataDir, "reels.json");
  if (!fs.existsSync(file)) fs.writeFileSync(file, "[]");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
app.get("/api/reels", async (_, res) => {
  try { res.json(await getReels()); } catch { res.status(500).json({error:"خطا در دریافت ریلزها"}); }
});
app.post("/api/reels", adminOnly, upload.single("video"), async (req,res) => {
  try {
    const {title,description} = req.body;
    if (!title || !title.trim()) return res.status(400).json({error:"عنوان ریلز را وارد کنید."});
    if (!req.file || !req.file.mimetype.startsWith("video/")) return res.status(400).json({error:"یک فایل ویدیویی معتبر انتخاب کنید."});
    const item = {id:Date.now().toString(),title:title.trim(),description:description||"",video:"/uploads/"+req.file.filename,createdAt:new Date().toISOString()};
    if (Reel) await Reel.create(item);
    else {
      const file = path.join(dataDir,"reels.json");
      const list = JSON.parse(fs.readFileSync(file,"utf8"));
      list.unshift(item); fs.writeFileSync(file,JSON.stringify(list,null,2));
    }
    res.json({ok:true});
  } catch { res.status(500).json({error:"آپلود ریلز انجام نشد."}); }
});
app.delete("/api/reels/:id", adminOnly, async (req,res) => {
  try {
    if (Reel) await Reel.deleteOne({_id:req.params.id});
    else {
      const file = path.join(dataDir,"reels.json");
      const list = JSON.parse(fs.readFileSync(file,"utf8"));
      fs.writeFileSync(file,JSON.stringify(list.filter(x=>x.id!==req.params.id),null,2));
    }
    res.json({ok:true});
  } catch { res.status(500).json({error:"حذف ریلز انجام نشد."}); }
});

async function start() {
  if (mongoUri) {
    await mongoose.connect(mongoUri);
    console.log("Database: MongoDB");
  } else console.log("Database: local JSON (for testing on one computer only)");
  app.listen(PORT, () => console.log(`Store is running at http://localhost:${PORT}`));
}
start().catch(err => { console.error(err); process.exit(1); });
