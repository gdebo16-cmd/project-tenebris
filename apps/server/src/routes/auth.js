// Logging in and out, registering, and "who am I?". Mounted inside routes/api.js, so these sit under /api.
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { me, login, logout, register } from '../controllers/apiUserController.js';

// At most 5 tries per 15 minutes in production; off in local dev so smoke tests can log in freely
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: { error: 'Too many attempts. Please try again in 15 minutes.' },
    skip: () => process.env.NODE_ENV !== 'production',
});

const router = Router();

router.post('/login', loginLimiter, login);
router.post('/register', loginLimiter, register);
router.get('/me', me);
router.post('/logout', logout);

export default router;
