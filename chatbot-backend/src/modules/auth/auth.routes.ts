import { Router } from 'express';
import { loginLimit } from '../../middlewares/rate-limit.middleware';
import { adminLogin } from '../auth/auth.controller';
const router = Router();
router.post('/admin/login', loginLimit, adminLogin);
export default router;
