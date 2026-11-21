import getCloudinary from './src/config/cloudinary.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const cloudinary = getCloudinary();

cloudinary.uploader.upload('../frontend/public/Logo.png', { folder: 'gsk-automotive/assets', public_id: 'logo' }, function(error, result) {
    if(error) {
        console.error("Error uploading to Cloudinary:", error);
    } else {
        console.log("CLOUDINARY_URL:", result.secure_url);
    }
});
