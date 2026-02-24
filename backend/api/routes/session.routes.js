const express = require('express');
const router = express.Router();
const sessionService = require('../services/session.services');
const { optionalAuth, extractSession } = require('../middleware/auth.middleware');

// ======================== SESSION ROUTES ========================

// Create new guest session
router.post('/create', async (req, res, next) => {
    try {
        const session = await sessionService.getOrCreateSession();
        res.json({
            success: true,
            sessionId: session.sessionId,
            expiresAt: session.expiresAt,
        });
    } catch (error) {
        next(error);
    }
});

// Validate session
router.get('/validate', extractSession, async (req, res, next) => {
    try {
        const sessionId = req.sessionId;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required',
            });
        }

        const isValid = await sessionService.validateSession(sessionId);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired session',
            });
        }

        res.json({
            success: true,
            message: 'Session is valid',
        });
    } catch (error) {
        next(error);
    }
});

// Migrate session to user account (called after login)
router.post('/migrate', optionalAuth, extractSession, async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const sessionId = req.sessionId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User authentication required',
            });
        }

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required',
            });
        }

        const result = await sessionService.migrateSessionToUser(sessionId, userId);

        res.json({
            success: true,
            message: 'Session migrated successfully',
            ...result,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
