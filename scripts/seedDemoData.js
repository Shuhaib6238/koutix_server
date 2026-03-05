require("dotenv").config();
const mongoose = require("mongoose");
const Product = require('../src/modules/products/product.model');
const Transaction = require('../src/modules/orders/transaction.model');
const Organization = require('../src/modules/tenants/organization.model');
const Branch = require('../src/modules/branches/branch.model');

const MONGO_URI = process.env.MONGO_URI;

const seedDemoData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // 1. Get or Create an Organization
    let org = await Organization.findOne();
    if (!org) {
      org = await Organization.create({
        name: "Demo Retail Chain",
        vat_trn: "TRN123456789",
        hq_address: "Tech Park, Dubai",
        status: "active"
      });
      console.log("🏢 Created Demo Organization");
    } else {
      console.log(`🏢 Using existing Organization: ${org.name} (${org._id})`);
    }

    // 2. Get or Create a Branch
    let branch = await Branch.findOne({ org_id: org._id });
    if (!branch) {
      branch = await Branch.create({
        org_id: org._id,
        name: "Sharjah Main Branch",
        branch_id: "BR-9999",
        address: "Al Wahda St, Sharjah",
        pos_api_key: "demo-pos-key-123"
      });
      console.log("📍 Created Demo Branch");
    } else {
      console.log(`📍 Using existing Branch: ${branch.name}`);
    }

    // 3. Create Demo Products (15 products across 5 categories)
    const demoProducts = [
      // ── Grains & Staples ──────────────────────────────────────
      { name: "Nesto Premium Rice 5kg",       price: 25.50, stock: 100, sku: "RICE-5KG",      category: "Grains",      sapMaterialId: "SAP-MAT-001" },
      { name: "Basmati Rice 1kg",              price: 8.00,  stock: 200, sku: "RICE-BAS-1KG",  category: "Grains",      sapMaterialId: "SAP-MAT-002" },
      { name: "Whole Wheat Flour 2kg",         price: 6.50,  stock: 80,  sku: "FLOUR-WW-2KG",  category: "Grains",      sapMaterialId: "SAP-MAT-003" },

      // ── Beverages ─────────────────────────────────────────────
      { name: "Fresh Orange Juice 1L",         price: 8.00,  stock: 120, sku: "JUICE-ORG-1L",  category: "Beverages",   sapMaterialId: "SAP-MAT-004" },
      { name: "Mineral Water 500ml",            price: 1.50,  stock: 500, sku: "WATER-MIN-500", category: "Beverages",   sapMaterialId: "SAP-MAT-005" },
      { name: "Laban Up Mango 250ml",          price: 2.25,  stock: 150, sku: "LABAN-MNG-250", category: "Beverages",   sapMaterialId: "SAP-MAT-006" },

      // ── Dairy & Eggs ──────────────────────────────────────────
      { name: "Organic Eggs 12pk",             price: 12.75, stock: 60,  sku: "EGGS-12PK",     category: "Dairy",       sapMaterialId: "SAP-MAT-007" },
      { name: "Full Cream Milk 1L",            price: 5.50,  stock: 90,  sku: "MILK-FC-1L",    category: "Dairy",       sapMaterialId: "SAP-MAT-008" },
      { name: "Labneh Cheese 500g",            price: 9.00,  stock: 40,  sku: "LBNEH-500G",    category: "Dairy",       sapMaterialId: "SAP-MAT-009" },

      // ── Snacks ────────────────────────────────────────────────
      { name: "Lay's Classic Chips 150g",      price: 4.50,  stock: 200, sku: "CHIPS-LAYS-150",category: "Snacks",      sapMaterialId: "SAP-MAT-010" },
      { name: "Digestive Biscuits 400g",       price: 6.00,  stock: 75,  sku: "BSCT-DIG-400",  category: "Snacks",      sapMaterialId: "SAP-MAT-011" },
      { name: "Mixed Nuts 250g",               price: 18.00, stock: 35,  sku: "NUTS-MIX-250",  category: "Snacks",      sapMaterialId: "SAP-MAT-012" },

      // ── Household ─────────────────────────────────────────────
      { name: "Ariel Washing Powder 3kg",      price: 22.00, stock: 50,  sku: "DETG-ARL-3KG",  category: "Household",   sapMaterialId: "SAP-MAT-013" },
      { name: "Fairy Dish Liquid 1L",          price: 9.50,  stock: 65,  sku: "DISH-FAR-1L",   category: "Household",   sapMaterialId: "SAP-MAT-014" },
      { name: "Dettol Handwash 500ml",         price: 11.00, stock: 80,  sku: "HAND-DET-500",  category: "Household",   sapMaterialId: "SAP-MAT-015" },
    ];

    console.log("\n📦 Seeding Products...");
    const createdProducts = [];
    for (const p of demoProducts) {
      const { sku, sapMaterialId, ...rest } = p;
      // Find by sku OR sapMaterialId to handle both new and existing records
      let product = await Product.findOne({ $or: [{ sku }, { sapMaterialId }] });
      if (product) {
        // Update in place to avoid duplicate key errors on unique indexes
        product.name = rest.name;
        product.price = rest.price;
        product.stock = rest.stock;
        product.category = rest.category;
        product.org_id = org._id;
        product.sku = sku;
        product.sapMaterialId = sapMaterialId;
        await product.save();
        console.log(`  ♻️  Updated: ${p.name}`);
      } else {
        product = await Product.create({ ...p, org_id: org._id });
        console.log(`  ✅ Created: ${p.name}`);
      }
      createdProducts.push(product);
    }

    // 4. Create Demo Transactions
    console.log("\n🧾 Seeding Transactions...");
    const demoTransactions = [
      {
        transactionId: "TX-DEMO-" + Date.now() + "-1",
        org_id: org._id,
        branch_id: branch._id,
        items: [
          { product_id: createdProducts[0]._id, name: createdProducts[0].name, quantity: 2, price: createdProducts[0].price, total: createdProducts[0].price * 2 },
          { product_id: createdProducts[3]._id, name: createdProducts[3].name, quantity: 3, price: createdProducts[3].price, total: createdProducts[3].price * 3 },
        ],
        totalAmount: (createdProducts[0].price * 2) + (createdProducts[3].price * 3),
        paymentMethod: "Card",
        status: "Completed"
      },
      {
        transactionId: "TX-DEMO-" + Date.now() + "-2",
        org_id: org._id,
        branch_id: branch._id,
        items: [
          { product_id: createdProducts[6]._id,  name: createdProducts[6].name,  quantity: 1, price: createdProducts[6].price,  total: createdProducts[6].price  },
          { product_id: createdProducts[9]._id,  name: createdProducts[9].name,  quantity: 2, price: createdProducts[9].price,  total: createdProducts[9].price * 2 },
          { product_id: createdProducts[12]._id, name: createdProducts[12].name, quantity: 1, price: createdProducts[12].price, total: createdProducts[12].price },
        ],
        totalAmount: createdProducts[6].price + (createdProducts[9].price * 2) + createdProducts[12].price,
        paymentMethod: "Cash",
        status: "Completed"
      },
      {
        transactionId: "TX-DEMO-" + Date.now() + "-3",
        org_id: org._id,
        branch_id: branch._id,
        items: [
          { product_id: createdProducts[1]._id,  name: createdProducts[1].name,  quantity: 5, price: createdProducts[1].price,  total: createdProducts[1].price * 5 },
          { product_id: createdProducts[11]._id, name: createdProducts[11].name, quantity: 2, price: createdProducts[11].price, total: createdProducts[11].price * 2 },
        ],
        totalAmount: (createdProducts[1].price * 5) + (createdProducts[11].price * 2),
        paymentMethod: "Card",
        status: "Completed"
      }
    ];

    for (const t of demoTransactions) {
      await Transaction.create(t);
      console.log(`  ✅ Created Transaction: ${t.transactionId} (AED ${t.totalAmount.toFixed(2)})`);
    }

    console.log("\n🎉 Seeding Complete!");
    console.log(`   Org ID     : ${org._id}`);
    console.log(`   Branch ID  : ${branch._id}`);
    console.log(`   Products   : ${createdProducts.length}`);
    console.log(`   Transactions: ${demoTransactions.length}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding demo data:", err.message);
    process.exit(1);
  }
};

seedDemoData();
