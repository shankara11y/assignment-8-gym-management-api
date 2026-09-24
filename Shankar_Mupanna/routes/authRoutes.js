const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', ensureAuthenticated, authController.logout);
router.get('/me', ensureAuthenticated, authController.getMe);

module.exports = router;
