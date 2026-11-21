import VehicleTemplate from '../models/VehicleTemplate.js';
import Customer from '../models/Customer.js';

// @desc    Get all active vehicle templates for a customer
// @route   GET /api/vehicle-templates/customer/:customerId
// @access  Private
export const getCustomerTemplates = async (req, res) => {
    try {
        const { customerId } = req.params;
        const templates = await VehicleTemplate.find({ 
            customerId, 
            isActive: true 
        }).sort({ createdAt: -1 });

        res.json({ success: true, count: templates.length, data: templates });
    } catch (error) {
        console.error("Error fetching templates:", error);
        res.status(500).json({ success: false, error: "Server Error fetching vehicle templates" });
    }
};

// @desc    Create a vehicle template
// @route   POST /api/vehicle-templates
// @access  Private/Admin
export const createTemplate = async (req, res) => {
    try {
        const { customerId, make, model, year, variant, notes } = req.body;

        if (!customerId || !make || !model) {
            return res.status(400).json({ success: false, error: "Please provide customerId, make, and model" });
        }

        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({ success: false, error: "Customer not found" });
        }

        if (customer.customerType === 'regular') {
            return res.status(400).json({ success: false, error: "Regular customers cannot have vehicle types" });
        }

        const newTemplate = await VehicleTemplate.create({
            customerId,
            make,
            model,
            year,
            variant,
            notes
        });

        res.status(201).json({ success: true, data: newTemplate });
    } catch (error) {
        console.error("Error creating template:", error);
        res.status(500).json({ success: false, error: "Server Error creating vehicle template" });
    }
};

// @desc    Update a vehicle template
// @route   PUT /api/vehicle-templates/:id
// @access  Private/Admin
export const updateTemplate = async (req, res) => {
    try {
        const { make, model, year, variant, notes } = req.body;

        const template = await VehicleTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ success: false, error: "Vehicle template not found" });
        }

        template.make = make || template.make;
        template.model = model || template.model;
        template.year = year !== undefined ? year : template.year;
        template.variant = variant !== undefined ? variant : template.variant;
        template.notes = notes !== undefined ? notes : template.notes;

        await template.save();

        res.json({ success: true, data: template });
    } catch (error) {
        console.error("Error updating template:", error);
        res.status(500).json({ success: false, error: "Server Error updating vehicle template" });
    }
};

// @desc    Deactivate a vehicle template
// @route   DELETE /api/vehicle-templates/:id
// @access  Private/Admin
export const deactivateTemplate = async (req, res) => {
    try {
        const template = await VehicleTemplate.findById(req.params.id);
        if (!template) {
            return res.status(404).json({ success: false, error: "Vehicle template not found" });
        }

        template.isActive = false;
        await template.save();

        res.json({ success: true, data: {} });
    } catch (error) {
        console.error("Error deactivating template:", error);
        res.status(500).json({ success: false, error: "Server Error deactivating vehicle template" });
    }
};
