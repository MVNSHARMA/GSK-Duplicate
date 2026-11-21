import mongoose from 'mongoose';

const bookingSlotSchema = new mongoose.Schema({
    date: { 
        type: String, 
        required: true,
        index: true
    },
    time: { 
        type: String, 
        required: true 
    },
    capacity: { 
        type: Number, 
        default: 3 
    },
    isDisabled: { 
        type: Boolean, 
        default: false 
    },
    lastBookedAt: {
        type: Date
    }
}, { timestamps: true });

// Ensure unique slot per date and time
bookingSlotSchema.index({ date: 1, time: 1 }, { unique: true });

export default mongoose.model('BookingSlot', bookingSlotSchema);
