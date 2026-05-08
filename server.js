const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "YOUR_MONGODB_CONNECTION_STRING";
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// ─── Schemas ──────────────────────────────────────────────────────────────────

const submissionSchema = new mongoose.Schema({
  type:      { type: String, enum: ["contact", "quote"], required: true },
  name:      String,
  company:   String,
  email:     String,
  phone:     String,
  product:   String,
  message:   String,
  status:    { type: String, default: "new" }, // new | read | replied
  createdAt: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  tag:         String,
  description: String,
  specs:       [String],
  image:       String,   // filename from img/ folder
  active:      { type: Boolean, default: true },
  order:       { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now }
});

const Submission = mongoose.model("Submission", submissionSchema);
const Product    = mongoose.model("Product", productSchema);

// ─── Simple admin auth middleware ─────────────────────────────────────────────
const ADMIN_KEY = process.env.ADMIN_KEY || "vishAdmin2025";

function adminAuth(req, res, next) {
  const key = req.headers["x-admin-key"] || req.query.key;
  if (key !== ADMIN_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Submit contact / quote form
app.post("/api/submit", async (req, res) => {
  try {
    const doc = new Submission(req.body);
    await doc.save();
    res.json({ success: true, id: doc._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get active products (for the public site)
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find({ active: true }).sort({ order: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES  (protected by x-admin-key header)
// ═══════════════════════════════════════════════════════════════════════════════

// Get all submissions
app.get("/api/admin/submissions", adminAuth, async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = {};
    if (type)   filter.type   = type;
    if (status) filter.status = status;
    const docs = await Submission.find(filter).sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update submission status
app.patch("/api/admin/submissions/:id", adminAuth, async (req, res) => {
  try {
    const doc = await Submission.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete submission
app.delete("/api/admin/submissions/:id", adminAuth, async (req, res) => {
  try {
    await Submission.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all products (admin sees inactive too)
app.get("/api/admin/products", adminAuth, async (req, res) => {
  try {
    const products = await Product.find().sort({ order: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add product
app.post("/api/admin/products", adminAuth, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product
app.patch("/api/admin/products/:id", adminAuth, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete product
app.delete("/api/admin/products/:id", adminAuth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seed default products (run once)
app.post("/api/admin/seed", adminAuth, async (req, res) => {
  try {
    const count = await Product.countDocuments();
    if (count > 0) return res.json({ message: "Already seeded" });

    const defaults = [
      { name: "Liquid Filling Machine",        tag: "Filling",           image: "liquid_filling_machine.jpg",    description: "High-precision volumetric filling systems designed for thin to viscous liquids. Suitable for pharmaceuticals, syrups, oils, and chemical solutions.", specs: ["Fill range: 5ml – 5000ml", "Speed: up to 80 fills/min", "GMP compliant & SS316 construction"], order: 1 },
      { name: "Tube Filling & Sealing Machine", tag: "Filling & Sealing", image: "tube_filling_machine.jpg",      description: "Fully automatic tube filling and sealing for laminate, plastic, and aluminium tubes. Ideal for creams, gels, ointments, and toothpaste.", specs: ["Tube diameter: 13mm – 50mm", "Output: up to 60 tubes/min", "PLC-controlled with HMI touchscreen"], order: 2 },
      { name: "Jar & Bottle Filling Machine",   tag: "Filling",           image: "jar_bottle_filling_machine.jpg", description: "Versatile filling systems for wide-mouth jars and bottles. Handles powders, granules, creams, and liquids with automatic container detection.", specs: ["Container size: 20ml – 5L", "Multi-head auger & piston options", "Quick changeover < 15 minutes"], order: 3 },
      { name: "End Line Packaging System",      tag: "Packaging",         image: "end_to_end_packaging.jpg",      description: "Complete downstream packaging automation from product collation to secondary carton packing. Integrates seamlessly with existing filling lines.", specs: ["Carton erecting, packing & closing", "Configurable for batch/lot coding", "Line speed: up to 120 packs/min"], order: 4 },
      { name: "Taping Machine",                 tag: "Sealing",           image: "taping_machine.jpg",            description: "Heavy-duty automatic carton sealing with top and bottom tape application. Built for high-throughput dispatch lines.", specs: ["Carton height: 50mm – 500mm", "Speed: up to 25 cartons/min", "Auto size adjustment – no tools"], order: 5 },
    ];
    await Product.insertMany(defaults);
    res.json({ message: "Seeded successfully", count: defaults.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
