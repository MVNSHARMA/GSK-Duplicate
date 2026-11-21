import { v2 as cloudinary } from 'cloudinary';

// Lazy-configure: env vars may not be loaded when this module is first imported.
// Calling getCloudinary() ensures cloudinary.config() runs after dotenv has loaded.
let configured = false;

const getCloudinary = () => {
    if (!configured) {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });
        configured = true;
    }
    return cloudinary;
};

export default getCloudinary;
