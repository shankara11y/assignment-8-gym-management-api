const User = require('../models/User');

// Renew / extend membership expiry date
exports.renewMembership = async (req, res) => {
  try {
    const { additionalMonths, tier } = req.body;
    const months = parseInt(additionalMonths) || 1;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const now = new Date();
    let currentExpiry = new Date(user.membershipExpiryDate);

    if (isNaN(currentExpiry.getTime()) || currentExpiry < now || user.membershipStatus !== 'active') {
      currentExpiry = new Date();
    }

    currentExpiry.setDate(currentExpiry.getDate() + (months * 30));

    user.membershipExpiryDate = currentExpiry;
    user.membershipStatus = 'active';

    if (tier && ['Bronze', 'Silver', 'Gold', 'Platinum'].includes(tier)) {
      user.membershipTier = tier;
    }

    await user.save();

    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      membershipTier: user.membershipTier,
      membershipStatus: user.membershipStatus,
      membershipExpiryDate: user.membershipExpiryDate,
      emergencyContact: user.emergencyContact
    };

    return res.status(200).json({
      message: 'Membership renewed successfully',
      user: userResponse
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// Get list of all expired memberships
exports.getExpiredMembers = async (req, res) => {
  try {
    const now = new Date();

    await User.updateMany(
      { membershipExpiryDate: { $lt: now }, membershipStatus: 'active' },
      { membershipStatus: 'expired' }
    );

    const expiredMembers = await User.find({
      $or: [
        { membershipExpiryDate: { $lt: now } },
        { membershipStatus: 'expired' }
      ]
    }).select('-password').sort({ membershipExpiryDate: -1 });

    return res.status(200).json(expiredMembers);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
