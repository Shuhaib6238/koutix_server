const partnerService = require('../services/partner.service');

class PartnerController {
  async signupChainManager(req, res) {
    try {
      const result = await partnerService.signupChainManager(req.body);
      res.status(201).json({
        message: 'Chain Manager signup successful. Pending SuperAdmin approval.',
        data: result
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new PartnerController();
