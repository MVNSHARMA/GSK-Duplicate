import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import AuditLog from "../models/AuditLog.js";
import EmailService from "../services/EmailService.js";

/**
 * Generate a JWT token for a given user ID.
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

/**
 * POST /api/auth/register
 * Register a new public user
 */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Please provide name, email, and password" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "An account with this email already exists" });
    }

    const newUser = await User.create({
      name,
      email,
      password,
      role: "user", // Explicitly force the role
    });

    await AuditLog.create({
      actor: newUser._id,
      action: "USER_REGISTERED",
      target: newUser._id,
      metadata: { role: newUser.role, email: newUser.email },
      ipAddress: req.ip
    });

    const token = generateToken(newUser._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * POST /api/auth/login
 * Authenticate user & return JWT token.
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Please provide email and password" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      // Audit log failed login
      await AuditLog.create({
        action: "LOGIN_FAILED",
        target: email,
        metadata: { reason: "User not found" },
        ipAddress: req.ip
      });
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    if (user.status === "disabled") {
      await AuditLog.create({
        actor: user._id,
        action: "LOGIN_FAILED",
        target: email,
        metadata: { reason: "Account disabled" },
        ipAddress: req.ip
      });
      return res.status(401).json({ success: false, error: "Invalid email or password" }); // Generic error
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      await AuditLog.create({
        actor: user._id,
        action: "LOGIN_FAILED",
        target: email,
        metadata: { reason: "Invalid password" },
        ipAddress: req.ip
      });
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    user.lastLoginAt = new Date();
    await user.save();

    await AuditLog.create({
      actor: user._id,
      action: "LOGIN_SUCCESS",
      target: user._id,
      ipAddress: req.ip
    });

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        pagePermissions: user.pagePermissions,
        additionalPageAccess: user.additionalPageAccess || [],
        additionalActionPermissions: user.additionalActionPermissions || [],
        customerId: user.customerId || null,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * GET /api/auth/me
 * Get currently authenticated user's profile.
 */
export const getMe = async (req, res) => {
  try {
    let customerType = null;
    if (req.user.customerId) {
      const Customer = (await import("../models/Customer.js")).default;
      const customer = await Customer.findById(req.user.customerId).lean();
      if (customer) {
        customerType = customer.customerType;
      }
    }
    res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        status: req.user.status,
        pagePermissions: req.user.pagePermissions,
        additionalPageAccess: req.user.additionalPageAccess || [],
        additionalActionPermissions: req.user.additionalActionPermissions || [],
        customerId: req.user.customerId || null,
        customerType: customerType
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * POST /api/auth/accept-invite
 * Validates a token and creates a new admin user.
 */
export const acceptInvitation = async (req, res) => {
  try {
    const { token, name, password } = req.body;

    if (!token || !name || !password) {
      return res.status(400).json({ success: false, error: "Please provide all required fields" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await Invitation.findOne({
      token: hashedToken,
      status: "pending",
      expiresAt: { $gt: Date.now() },
    });

    if (!invitation) {
      return res.status(400).json({ success: false, error: "Invalid or expired invitation token" });
    }

    const existingUser = await User.findOne({ email: invitation.email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "User already exists with this email" });
    }

    const newUser = await User.create({
      name,
      email: invitation.email,
      password,
      role: invitation.role,
      pagePermissions: invitation.pagePermissions,
      additionalPageAccess: invitation.additionalPageAccess || [],
      additionalActionPermissions: invitation.additionalActionPermissions || [],
    });

    invitation.status = "accepted";
    invitation.acceptedAt = new Date();
    await invitation.save();

    await AuditLog.create({
      actor: newUser._id,
      action: "INVITATION_ACCEPTED",
      target: invitation._id,
      metadata: { role: newUser.role, email: newUser.email },
      ipAddress: req.ip
    });

    const authToken = generateToken(newUser._id);

    res.status(201).json({
      success: true,
      token: authToken,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        pagePermissions: newUser.pagePermissions,
        additionalPageAccess: newUser.additionalPageAccess || [],
        additionalActionPermissions: newUser.additionalActionPermissions || [],
      },
    });

  } catch (error) {
    console.error("Accept Invite Error:", error);
    res.status(500).json({ success: false, error: "Server error accepting invitation" });
  }
};

/**
 * POST /api/auth/forgotpassword
 * Generate a reset token and email it to user
 */
export const forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      // Return success anyway to prevent email enumeration
      return res.status(200).json({ success: true, message: "If an account exists, an email has been sent" });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Create reset url
    const baseUrl = process.env.FRONTEND_URL || (req ? `${req.protocol}://${req.get('host')}` : 'https://gskautomotive.vercel.app');
    const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

    try {
      await EmailService.sendPasswordReset(user, resetUrl);
      res.status(200).json({ success: true, message: "If an account exists, an email has been sent" });
    } catch (err) {
      console.error("Email send error:", err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({ success: false, error: "Email could not be sent" });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * PUT /api/auth/resetpassword/:resettoken
 * Reset password using the token
 */
export const resetPassword = async (req, res) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.resettoken)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, error: "Invalid or expired reset token" });
    }

    if (!req.body.password || req.body.password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    await AuditLog.create({
      actor: user._id,
      action: "PASSWORD_RESET",
      target: user._id,
      ipAddress: req.ip
    });

    // Generate new token and log user in automatically
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};
