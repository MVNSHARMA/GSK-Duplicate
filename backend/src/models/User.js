import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please provide a name"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Please provide an email"],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, "Please provide a password"],
    minlength: 6,
    select: false, // Don't return password by default
  },
  role: {
    type: String,
    enum: ["user", "admin", "super_admin", "mechanic"],
    default: "user",
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
  },
  status: {
    type: String,
    enum: ["active", "disabled"],
    default: "active",
  },
  pagePermissions: {
    type: Map,
    of: Boolean,
    default: {
      dashboard: true,
      customers: true,
      regularCustomers: true,
      vehicles: true,
      importTrackers: false,
      dailySales: false,
      rentals: false,
      invoices: true,
      jobCards: true,
      inventory: true,
      dealerCars: false,
      communications: true,
      notifications: true,
      settings: false,
      auditLogs: false
    }
  },
  additionalPageAccess: {
    type: [String],
    default: [],
    validate: {
      validator: (pages) => new Set(pages).size === pages.length,
      message: "Additional page access cannot contain duplicates",
    },
  },
  additionalActionPermissions: {
    type: [String],
    default: [],
    validate: {
      validator: (actions) => new Set(actions).size === actions.length,
      message: "Additional action permissions cannot contain duplicates",
    },
  },
  lastLoginAt: {
    type: Date,
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
}, { timestamps: true });

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password token
userSchema.methods.getResetPasswordToken = function () {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString("hex");

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set expire (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model("User", userSchema);
export default User;
