import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Please provide an email for the invitation"],
    unique: true,
    lowercase: true,
    trim: true,
  },
  role: {
    type: String,
    enum: ["admin", "super_admin", "mechanic"],
    default: "admin",
  },
  token: {
    type: String,
    required: true, // This will be the hashed token stored in DB
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "revoked", "expired", "used"],
    default: "pending",
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  pagePermissions: {
    type: Map,
    of: Boolean,
    default: () => new Map()
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
  acceptedAt: {
    type: Date,
  },
  revokedAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, { timestamps: true });

const Invitation = mongoose.model("Invitation", invitationSchema);
export default Invitation;
