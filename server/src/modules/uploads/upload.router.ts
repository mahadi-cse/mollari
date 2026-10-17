import { Router } from 'express';
import multer from 'multer';
import cloudinary from '../../config/cloudinary';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ok } from '../../shared/utils/apiResponse';
import { authenticate, authorize } from '../../middleware/authenticate';
import { USER_TYPE_CODES } from '../../shared/types/auth.types';

const router = Router();

// Multer — memory storage (buffer), max 5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

/**
 * POST /api/uploads/image
 * Accepts a single image (field name "image"), uploads to Cloudinary,
 * returns the secure URL.
 */
router.post(
  '/image',
  authenticate,
  authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER, USER_TYPE_CODES.CUSTOMER),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No image file provided' });
      return;
    }

    const requestedFolder = (req.query.folder as string) || 'mollari/products';
    
    // Whitelist allowed folders to prevent asset injection
    const allowedFolders = [
      'mollari/products', 'mollari/categories', 'mollari/users', 'mollari/promotions',
      'mouchak/products', 'mouchak/categories', 'mouchak/users', 'mouchak/promotions'
    ];
    const folder = allowedFolders.includes(requestedFolder) ? requestedFolder : 'mollari/products';

    // Upload buffer to Cloudinary via stream
    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      stream.end(req.file!.buffer);
    });

    res.json(
      ok({
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
      }, 'Image uploaded'),
    );
  }),
);

export default router;
