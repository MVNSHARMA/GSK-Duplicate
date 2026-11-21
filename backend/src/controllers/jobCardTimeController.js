import JobCardTimeEntry from '../models/JobCardTimeEntry.js';
import JobCard from '../models/JobCard.js';

// @desc    Get all time entries for a specific Job Card
// @route   GET /api/job-cards/:id/time-entries
// @access  Private
export const getJobCardTimeEntries = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find job card to verify it exists
        const jobCard = await JobCard.findById(id);
        if (!jobCard) {
            return res.status(404).json({ success: false, error: 'Job Card not found' });
        }
        
        // Mechanic can only view if it's assigned to them, but we'll let existing UI filter
        const isMechanic = req.user.role === 'mechanic';
        if (isMechanic && jobCard.technicianId?.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, error: 'Unauthorized to view this Job Card' });
        }

        const entries = await JobCardTimeEntry.find({ jobCardId: id })
            .populate('mechanicId', 'firstName lastName name email')
            .sort({ clockIn: -1 });

        res.status(200).json({
            success: true,
            data: entries
        });
    } catch (error) {
        console.error("Error fetching time entries:", error);
        res.status(500).json({ success: false, error: 'Server Error fetching time entries' });
    }
};

// @desc    Clock into a Job Card
// @route   POST /api/job-cards/:id/time-entries/clock-in
// @access  Private
export const clockIn = async (req, res) => {
    try {
        const { id } = req.params;
        const mechanicId = req.user._id;

        const jobCard = await JobCard.findById(id);
        if (!jobCard) {
            return res.status(404).json({ success: false, error: 'Job Card not found' });
        }

        // Validate status
        if (jobCard.status === 'Completed' || jobCard.status === 'Cancelled') {
            return res.status(400).json({ success: false, error: `Cannot clock into a ${jobCard.status} Job Card` });
        }

        // Validate authorization
        const isMechanic = req.user.role === 'mechanic';
        if (isMechanic && jobCard.technicianId?.toString() !== mechanicId.toString()) {
            return res.status(403).json({ success: false, error: 'You are not authorized to work on this Job Card' });
        }

        // Check for active session
        const activeSession = await JobCardTimeEntry.findOne({
            jobCardId: id,
            mechanicId: mechanicId,
            status: 'Active'
        });

        if (activeSession) {
            return res.status(409).json({ success: false, error: 'Mechanic already has an active session for this Job Card.' });
        }

        // Optionally, transition status to "In Progress" if it is "Open"
        // Following prompt rules: "If appropriate... ONLY do this if it is consistent with the existing Job Card workflow."
        // We will leave status alone to avoid unintentional side effects, unless explicitly requested.

        const newEntry = await JobCardTimeEntry.create({
            jobCardId: id,
            mechanicId: mechanicId,
            clockIn: new Date(),
            status: 'Active'
        });

        const populatedEntry = await JobCardTimeEntry.findById(newEntry._id)
            .populate('mechanicId', 'firstName lastName name');

        res.status(201).json({
            success: true,
            data: populatedEntry
        });

    } catch (error) {
        // Handle MongoDB unique constraint violation
        if (error.code === 11000) {
            return res.status(409).json({ success: false, error: 'Mechanic already has an active session for this Job Card.' });
        }
        console.error("Error clocking in:", error);
        res.status(500).json({ success: false, error: 'Server Error clocking in' });
    }
};

// @desc    Clock out of a Job Card
// @route   POST /api/job-cards/:id/time-entries/:timeEntryId/clock-out
// @access  Private
export const clockOut = async (req, res) => {
    try {
        const { id, timeEntryId } = req.params;

        const entry = await JobCardTimeEntry.findById(timeEntryId);
        if (!entry) {
            return res.status(404).json({ success: false, error: 'Time entry not found' });
        }

        if (entry.jobCardId.toString() !== id.toString()) {
            return res.status(400).json({ success: false, error: 'Time entry does not belong to this Job Card' });
        }

        // Verify authorization
        const isMechanic = req.user.role === 'mechanic';
        if (isMechanic && entry.mechanicId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, error: 'You are not authorized to clock out this session' });
        }

        if (entry.status === 'Completed') {
            return res.status(400).json({ success: false, error: 'This time session has already been completed.' });
        }

        const clockOutTime = new Date();
        const durationMs = clockOutTime.getTime() - new Date(entry.clockIn).getTime();
        const durationMinutes = Math.floor(durationMs / 60000);

        entry.clockOut = clockOutTime;
        entry.durationMinutes = durationMinutes;
        entry.status = 'Completed';
        await entry.save();

        const populatedEntry = await JobCardTimeEntry.findById(entry._id)
            .populate('mechanicId', 'firstName lastName name');

        res.status(200).json({
            success: true,
            data: populatedEntry
        });

    } catch (error) {
        console.error("Error clocking out:", error);
        res.status(500).json({ success: false, error: 'Server Error clocking out' });
    }
};
