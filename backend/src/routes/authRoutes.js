import express from "express";
import rateLimit from "express-rate-limit";
import { login, register, getMe, acceptInvitation, forgotPassword, resetPassword } from "../controllers/authController.js";
import protect from "../middleware/auth.js";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  skip: (req) => process.env.NODE_ENV === 'test' && req.headers['x-test-rate-limit'] !== 'true',
  message: { success: false, error: "Too many login attempts, please try again after 15 minutes" },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 password reset requests per 15 minutes
  skip: (req) => process.env.NODE_ENV === 'test' && req.headers['x-test-rate-limit'] !== 'true',
  message: { success: false, error: "Too many password reset requests. Please wait 15 minutes." },
});

router.post("/login", loginLimiter, login);
router.post("/register", loginLimiter, register);
router.post("/accept-invite", acceptInvitation);
router.post("/forgotpassword", passwordResetLimiter, forgotPassword);
router.put("/resetpassword/:resettoken", passwordResetLimiter, resetPassword);
router.get("/me", protect, getMe);

export default router;
