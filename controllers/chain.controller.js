const User = require('../models/user.model');
const Branch = require('../models/branch.model');
const Invitation = require('../models/invitation.model');
const crypto = require('crypto');

class ChainController {
  async createBranch(req, res) {
    try {
      const { name, address, managerEmail } = req.body;
      const org_id = req.user?.org_id || null; // Optional: use user's org_id if available

      if (!name || !address) {
        return res.status(400).json({ message: 'Branch name and address are required' });
      }

      // 1. Create branch
      const branch = new Branch({
        org_id,
        name,
        address
      });
      await branch.save();

      let invitation = null;
      
      // 2. If managerEmail provided, create invitation
      if (managerEmail) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        invitation = new Invitation({
          email: managerEmail,
          role: 'BranchManager',
          org_id,
          branch_id: branch._id,
          token,
          expiresAt
        });
        await invitation.save();

        // 3. Send email notification (logged to console for now)
        const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/onboarding?token=${token}`;
        
        console.log(`
========================================
Branch Manager Invitation
========================================
To: ${managerEmail}
Branch: ${name}
Link: ${invitationLink}
Token: ${token}
========================================
        `);
      }

      res.status(201).json({ 
        message: managerEmail ? 'Branch created and invitation sent successfully' : 'Branch created successfully', 
        branch,
        invitation: invitation ? { email: managerEmail, token: invitation.token } : null
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async inviteBranchManager(req, res) {
    try {
      const { email, branch_id } = req.body;
      const org_id = req.user.org_id;

      if (!email || !branch_id) {
        return res.status(400).json({ message: 'Email and branch_id are required' });
      }

      // 1. Verify branch belongs to organization
      const branch = await Branch.findOne({ _id: branch_id, org_id });
      if (!branch) {
        return res.status(404).json({ message: 'Branch not found in your organization' });
      }

      // 2. Create invitation token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const invitation = new Invitation({
        email,
        role: 'BranchManager',
        org_id,
        branch_id,
        token,
        expiresAt
      });
      await invitation.save();

      // In a real app, send email here
      console.log(`Invitation link for ${email}: /onboarding?token=${token}`);

      res.status(201).json({ message: 'Invitation sent successfully', invitation });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async getBranches(req, res) {
    try {
      const branches = await Branch.find({ org_id: req.user.org_id }).populate('manager_id');
      res.status(200).json(branches);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new ChainController();
