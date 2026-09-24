const FitnessClass = require('../models/FitnessClass');
const User = require('../models/User');

// Fetch all classes (supports optional ?trainer=Maria)
exports.getAllClasses = async (req, res) => {
  try {
    const filter = {};
    if (req.query.trainer) {
      filter.trainerName = { $regex: req.query.trainer, $options: 'i' };
    }

    const classes = await FitnessClass.find(filter)
      .populate('enrolledMembers', 'username email membershipTier')
      .sort({ scheduleDate: 1 });

    return res.status(200).json(classes);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get single class details with enrolled members list
exports.getClassById = async (req, res) => {
  try {
    const fitnessClass = await FitnessClass.findById(req.params.id)
      .populate('enrolledMembers', 'username email membershipTier membershipStatus');

    if (!fitnessClass) {
      return res.status(404).json({ message: 'Fitness class not found' });
    }

    return res.status(200).json(fitnessClass);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Create a new workout class
exports.createClass = async (req, res) => {
  try {
    const { title, trainerName, scheduleDate, durationMinutes, maxCapacity } = req.body;

    if (!title || !trainerName || !scheduleDate || !maxCapacity) {
      return res.status(400).json({ message: 'Title, trainerName, scheduleDate, and maxCapacity are required.' });
    }

    if (maxCapacity < 1) {
      return res.status(400).json({ message: 'maxCapacity must be at least 1.' });
    }

    const newClass = new FitnessClass({
      title: title.trim(),
      trainerName: trainerName.trim(),
      scheduleDate,
      durationMinutes: durationMinutes || 60,
      maxCapacity
    });

    await newClass.save();

    return res.status(201).json({
      message: 'Fitness class created successfully',
      fitnessClass: newClass
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// Enroll logged-in user into class
exports.bookClass = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    const now = new Date();
    if (user.membershipStatus !== 'active' || new Date(user.membershipExpiryDate) < now) {
      if (new Date(user.membershipExpiryDate) < now && user.membershipStatus !== 'expired') {
        user.membershipStatus = 'expired';
        await user.save();
      }
      return res.status(400).json({
        message: 'Membership expired or inactive. Please renew your membership to book classes.'
      });
    }

    const fitnessClass = await FitnessClass.findById(req.params.id);
    if (!fitnessClass) {
      return res.status(404).json({ message: 'Fitness class not found' });
    }

    if (fitnessClass.enrolledMembers.length >= fitnessClass.maxCapacity) {
      return res.status(400).json({ message: 'Class capacity reached' });
    }

    const isEnrolled = fitnessClass.enrolledMembers.some(
      (memberId) => memberId.toString() === req.user._id.toString()
    );
    if (isEnrolled) {
      return res.status(400).json({ message: 'Member already booked in this class' });
    }

    fitnessClass.enrolledMembers.push(req.user._id);
    await fitnessClass.save();

    const updatedClass = await FitnessClass.findById(req.params.id)
      .populate('enrolledMembers', 'username email membershipTier');

    return res.status(200).json({
      message: 'Class booked successfully',
      fitnessClass: updatedClass
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Cancel member booking from class
exports.cancelBooking = async (req, res) => {
  try {
    const fitnessClass = await FitnessClass.findById(req.params.id);
    if (!fitnessClass) {
      return res.status(404).json({ message: 'Fitness class not found' });
    }

    const isEnrolled = fitnessClass.enrolledMembers.some(
      (memberId) => memberId.toString() === req.user._id.toString()
    );

    if (!isEnrolled) {
      return res.status(400).json({ message: 'Member is not enrolled in this class' });
    }

    fitnessClass.enrolledMembers = fitnessClass.enrolledMembers.filter(
      (memberId) => memberId.toString() !== req.user._id.toString()
    );

    await fitnessClass.save();

    return res.status(200).json({
      message: 'Booking cancelled successfully',
      fitnessClass
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
