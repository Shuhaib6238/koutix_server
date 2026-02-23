require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/product.model");
const Transaction = require("../models/transaction.model");
const Organization = require("../models/organization.model");
const Branch = require("../models/branch.model");

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
    }

    // 3. Create Demo Products
    const demoProducts = [
      {
        name: "Nesto Premium Rice 5kg",
        price: 25.50,
        stock: 50,
        sku: "RICE-5KG",
        category: "Grains",
        sapMaterialId: "SAP-MAT-001",
        org_id: org._id
      },
      {
        name: "Fresh Orange Juice 1L",
        price: 8.00,
        stock: 120,
        sku: "JUICE-ORG-1L",
        category: "Beverages",
        sapMaterialId: "SAP-MAT-002",
        org_id: org._id
      },
      {
        name: "Organic Eggs 12pk",
        price: 12.75,
        stock: 30,
        sku: "EGGS-12PK",
        category: "Dairy",
        sapMaterialId: "SAP-MAT-003",
        org_id: org._id
      }
    ];

    const createdProducts = [];
    for (const p of demoProducts) {
      const existing = await Product.findOne({ sapMaterialId: p.sapMaterialId });
      if (!existing) {
        const newProduct = await Product.create(p);
        createdProducts.push(newProduct);
        console.log(`📦 Created Product: ${p.name}`);
      } else {
        createdProducts.push(existing);
      }
    }

    // 4. Create Demo Transactions
    const demoTransactions = [
      {
        transactionId: "TX-" + Date.now() + "-1",
        org_id: org._id,
        branch_id: branch._id,
        items: [
          {
            product_id: createdProducts[0]._id,
            name: createdProducts[0].name,
            quantity: 2,
            price: createdProducts[0].price,
            total: createdProducts[0].price * 2
          },
          {
            product_id: createdProducts[1]._id,
            name: createdProducts[1].name,
            quantity: 1,
            price: createdProducts[1].price,
            total: createdProducts[1].price * 1
          }
        ],
        totalAmount: (createdProducts[0].price * 2) + createdProducts[1].price,
        paymentMethod: "Card",
        status: "Completed"
      },
      {
        transactionId: "TX-" + Date.now() + "-2",
        org_id: org._id,
        branch_id: branch._id,
        items: [
          {
            product_id: createdProducts[2]._id,
            name: createdProducts[2].name,
            quantity: 5,
            price: createdProducts[2].price,
            total: createdProducts[2].price * 5
          }
        ],
        totalAmount: createdProducts[2].price * 5,
        paymentMethod: "Cash",
        status: "Completed"
      }
    ];

    for (const t of demoTransactions) {
      await Transaction.create(t);
      console.log(`🧾 Created Transaction: ${t.transactionId}`);
    }

    console.log("🎉 Seeding Demo Data Complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding demo data:", err.message);
    process.exit(1);
  }
};

seedDemoData();
