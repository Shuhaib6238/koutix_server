const Product = require('../products/product.model');
const admin = require('../../config/firebase');
const sapConfig = require('../../config/sap.config');

class SAPController {
  /**
   * Webhook: SAP triggers this when Inventory changes
   * Production requirement: Header validation for security
   */
  async handleInventorySync(req, res) {
    const sapSignature = req.headers['x-sap-signature'];
    
    // In production, validate signature or secret
    if (process.env.NODE_ENV === 'production' && !sapSignature) {
      return res.status(401).json({ message: 'Unauthorized webhook source' });
    }

    const { materialId, quantity, branchId, orgId } = req.body;

    if (!materialId || quantity === undefined) {
      return res.status(400).json({ message: 'Missing materialId or quantity' });
    }

    try {
      // 1. Sync to MongoDB
      const product = await Product.findOneAndUpdate(
        { sapMaterialId: materialId },
        { 
          $set: { 
            stock: quantity,
            'sapMetadata.lastSyncAt': new Date()
          } 
        },
        { upsert: true, new: true }
      );

      // 2. Real-time update to Firebase Firestore (Optional/Resilient)
      if (orgId && branchId) {
        try {
          await admin.firestore()
            .collection('organizations')
            .doc(orgId.toString())
            .collection('branches')
            .doc(branchId.toString())
            .collection('inventory')
            .doc(materialId)
            .set({
              stock: quantity,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (firebaseError) {
          console.warn('⚠️ Firestore Sync Failed (API might be disabled):', firebaseError.message);
        }
      }

      // 3. Trigger Push Notification if stock is critically low (Optional/Resilient)
      if (quantity < 5) {
        try {
          const topic = `alerts_${orgId}_${branchId}`;
          await admin.messaging().send({
            topic,
            notification: {
              title: 'Critical Stock Alert!',
              body: `Material ${materialId} is almost out of stock (${quantity} left).`
            },
            data: {
              materialId,
              type: 'INVENTORY_ALERT'
            }
          });
          console.log(`⚠️  ALERT: Critical Stock Alert sent for ${materialId} (Stock: ${quantity})`);
        } catch (fcmError) {
          console.warn('⚠️ FCM Notification Failed:', fcmError.message);
        }
      }

      console.log(`📦 Sync Success: ${materialId} -> ${quantity}`);
      res.status(200).json({ status: 'success', materialId });
    } catch (error) {
      console.error('❌ SAP Sync Error:', error.message);
      res.status(500).json({ message: 'Internal Server Error during sync' });
    }
  }

  /**
   * Webhook: SAP triggers this when a Sales Order/Bill is created
   */
  async handleBillGenerated(req, res) {
    const { billNumber, amount, customerEmail } = req.body;
    
    try {
      // Logic for storing transaction and notifying user
      console.log(`🧾 Bill Generated: ${billNumber} for ${amount}`);
      
      // Notify via Firebase Cloud Messaging to customer app
      if (customerEmail) {
        // Find user FCM token in Mongo and send...
      }

      res.status(200).json({ status: 'received' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = new SAPController();
