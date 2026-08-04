import { Router } from 'express';
import { requireAdmin, verifyToken } from '../../middlewares/auth.middleware';
import { getMySites, getSites, updateSite } from './sites.controller';
const router = Router();
router.get('/', verifyToken, getSites);
router.put('/:siteId', verifyToken, requireAdmin, updateSite);
router.get('/my-sites', verifyToken, getMySites);
export default router;
