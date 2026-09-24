const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');

router.get('/expired', memberController.getExpiredMembers);
router.patch('/:id/renew', memberController.renewMembership);

module.exports = router;
