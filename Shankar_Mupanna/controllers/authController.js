const passport = require('passport');
const User = require('../models/User');

// Register new member
exports.register = async (req, res) => {
  try {
    const { username, email, password, membershipTier, durationMonths, emergencyContact } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required.' });
    }

    const existingUser = await User.findOne({
      $or: [{ username: username.trim() }, { email: email.trim().toLowerCase() }]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already exists.' });
    }

    // Calculate membership expiry date (default 1 month = 30 days)
    const months = parseInt(durationMonths) || 1;
    const membershipExpiryDate = new Date();
    membershipExpiryDate.setDate(membershipExpiryDate.getDate() + (months * 30));

    const user = new User({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      membershipTier: membershipTier || 'Bronze',
      membershipStatus: 'active',
      membershipExpiryDate,
      emergencyContact
    });

    await user.save();

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Error logging in user after registration.', error: err.message });
      }

      const userResponse = {
        _id: user._id,
        username: user.username,
        email: user.email,
        membershipTier: user.membershipTier,
        membershipStatus: user.membershipStatus,
        membershipExpiryDate: user.membershipExpiryDate,
        emergencyContact: user.emergencyContact,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      return res.status(201).json({
        message: 'Member registered successfully.',
        user: userResponse
      });
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// Login via Passport Local Strategy
exports.login = (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({ message: info?.message || 'Invalid credentials' });
    }

    req.login(user, (err) => {
      if (err) {
        return next(err);
      }

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
        message: 'Logged in successfully',
        user: userResponse
      });
    });
  })(req, res, next);
};

// Logout user session
exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Could not log out, please try again.' });
      }
      res.clearCookie('connect.sid');
      return res.status(200).json({ message: 'Logged out successfully' });
    });
  });
};

// Fetch current user profile & calculated remaining days
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    const expiry = new Date(user.membershipExpiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    return res.status(200).json({
      user,
      remainingDays
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
