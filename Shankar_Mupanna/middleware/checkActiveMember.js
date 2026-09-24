const User = require('../models/User');

const checkActiveMember = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized. Please log in first.' });
  }

  const now = new Date();
  const expiryDate = new Date(req.user.membershipExpiryDate);

  if (req.user.membershipStatus !== 'active' || expiryDate < now) {
    if (expiryDate < now && req.user.membershipStatus !== 'expired') {
      try {
        await User.findByIdAndUpdate(req.user._id, { membershipStatus: 'expired' });
      } catch (err) {
        console.error('Error updating membership status:', err);
      }
    }
    return res.status(400).json({
      message: 'Membership expired or inactive. Please renew your membership to book classes.'
    });
  }

  next();
};

module.exports = { checkActiveMember };
