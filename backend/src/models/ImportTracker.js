import mongoose from 'mongoose';

const importTrackerSchema = new mongoose.Schema({
    vehicleId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Vehicle', 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['NEED PREP', 'IN TRANSIT', 'COMPLIANCE', 'READY'],
        required: true,
        default: 'NEED PREP'
    },
    customerId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Customer' 
    },
    notes: { 
        type: String 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { timestamps: true });

export default mongoose.model('ImportTracker', importTrackerSchema);
