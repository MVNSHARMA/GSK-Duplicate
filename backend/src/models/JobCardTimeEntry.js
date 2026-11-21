import mongoose from 'mongoose';

const jobCardTimeEntrySchema = new mongoose.Schema({
    jobCardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'JobCard',
        required: true
    },
    mechanicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    clockIn: {
        type: Date,
        required: true,
        default: Date.now
    },
    clockOut: {
        type: Date,
        default: null
    },
    durationMinutes: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['Active', 'Completed'],
        default: 'Active'
    }
}, { timestamps: true });

// Ensure getters/virtuals are included
jobCardTimeEntrySchema.set('toJSON', { getters: true, virtuals: true });
jobCardTimeEntrySchema.set('toObject', { getters: true, virtuals: true });

// Prevent multiple active sessions for the same mechanic on the same job card
jobCardTimeEntrySchema.index(
    { jobCardId: 1, mechanicId: 1 },
    { unique: true, partialFilterExpression: { status: 'Active' } }
);

jobCardTimeEntrySchema.index({ jobCardId: 1 });
jobCardTimeEntrySchema.index({ mechanicId: 1 });
jobCardTimeEntrySchema.index({ status: 1 });

export default mongoose.model('JobCardTimeEntry', jobCardTimeEntrySchema);
