import CustomerServiceUpdate from '../models/CustomerServiceUpdate.js';
import JobCard from '../models/JobCard.js';
import EmailService from '../services/EmailService.js';

// @desc    Get customer updates for a job card (Admin)
// @route   GET /api/job-cards/:id/customer-updates
// @access  Private (Admin/SuperAdmin)
export const getCustomerServiceUpdates = async (req, res) => {
    try {
        const updates = await CustomerServiceUpdate.find({ jobCardId: req.params.id, isActive: true })
            .populate('createdBy', 'name role')
            .sort({ createdAt: -1 });
        
        res.status(200).json({ success: true, data: updates });
    } catch (error) {
        console.error("Error fetching customer updates:", error);
        res.status(500).json({ success: false, error: 'Server Error fetching customer updates' });
    }
};

// @desc    Create a customer update for a job card
// @route   POST /api/job-cards/:id/customer-updates
// @access  Private (Admin/SuperAdmin)
export const createCustomerServiceUpdate = async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const jobCard = await JobCard.findById(req.params.id)
            .populate('customerId', 'email name')
            .populate('vehicleId', 'registrationNumber brand model');
            
        if (!jobCard) {
            return res.status(404).json({ success: false, error: 'Job Card not found' });
        }
        const payload = {
            customerId: jobCard.customerId._id,
            jobCardId: jobCard._id,
            message,
            createdBy: req.user._id
        };
        if (jobCard.vehicleId) {
            payload.vehicleId = jobCard.vehicleId._id;
        }

        const update = await CustomerServiceUpdate.create(payload);

        // Send email notification (fire-and-forget — update is already saved)
        if (jobCard.customerId.email) {
            try {
                await EmailService.sendCustomerServiceUpdateEmail({
                    customerEmail: jobCard.customerId.email,
                    customerName: jobCard.customerId.name,
                    vehicleRego: jobCard.vehicleId ? jobCard.vehicleId.registrationNumber : (jobCard.trackerCarId ? 'Tracker Car' : 'N/A'),
                    message
                });
            } catch (emailError) {
                console.error("Email failed, but update was created successfully:", emailError);
            }
        }

        const populatedUpdate = await CustomerServiceUpdate.findById(update._id).populate('createdBy', 'name role');

        res.status(201).json({ success: true, data: populatedUpdate });
    } catch (error) {
        console.error("Error creating customer update:", error);
        res.status(500).json({ success: false, error: 'Server Error creating customer update' });
    }
};

// @desc    Delete a customer update (soft delete)
// @route   DELETE /api/job-cards/:id/customer-updates/:updateId
// @access  Private (Admin/SuperAdmin)
export const deleteCustomerServiceUpdate = async (req, res) => {
    try {
        const update = await CustomerServiceUpdate.findOneAndUpdate(
            { _id: req.params.updateId, jobCardId: req.params.id },
            { isActive: false },
            { new: true }
        );

        if (!update) {
            return res.status(404).json({ success: false, error: 'Update not found' });
        }

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error("Error deleting customer update:", error);
        res.status(500).json({ success: false, error: 'Server Error deleting customer update' });
    }
};
