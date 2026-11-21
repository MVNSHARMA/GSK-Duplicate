import Supplier from '../models/Supplier.js';
import AuditLog from '../models/AuditLog.js';
import { AUDIT_EVENTS } from '../utils/auditEvents.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    Get all suppliers
// @route   GET /api/suppliers
// @access  Private/Admin
export const getSuppliers = async (req, res) => {
    try {
        const query = {};
        
        if (req.query.search) {
            query.$text = { $search: req.query.search };
        }
        
        if (req.query.status && req.query.status !== 'All') {
            query.isActive = req.query.status === 'Active';
        }

        const suppliers = await Supplier.find(query).sort({ name: 1 });
        res.json(suppliers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching suppliers' });
    }
};

// @desc    Get supplier by ID
// @route   GET /api/suppliers/:id
// @access  Private/Admin
export const getSupplierById = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) {
            return res.status(404).json({ message: 'Supplier not found' });
        }
        res.json(supplier);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching supplier' });
    }
};

// @desc    Create new supplier
// @route   POST /api/suppliers
// @access  Private/Admin
export const createSupplier = async (req, res) => {
    try {
        const { name, contactPerson, email, phone, address, notes, isActive } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Supplier name is required' });
        }

        const existingSupplier = await Supplier.findOne({ name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' } });
        if (existingSupplier) {
            return res.status(409).json({ message: 'A supplier with this name already exists' });
        }

        const supplier = await Supplier.create({
            name,
            contactPerson,
            email,
            phone,
            address,
            notes,
            isActive: isActive !== undefined ? isActive : true
        });

        await AuditLog.create({
            actor: req.user._id,
            action: AUDIT_EVENTS.SUPPLIER_CREATED,
            target: supplier._id.toString(),
            entityType: 'Supplier',
            entityId: supplier._id.toString(),
            entityDisplay: supplier.name,
            description: `Created supplier ${supplier.name}`,
            ipAddress: req.ip
        });

        res.status(201).json(supplier);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error creating supplier' });
    }
};

// @desc    Update supplier
// @route   PUT /api/suppliers/:id
// @access  Private/Admin
export const updateSupplier = async (req, res) => {
    try {
        const { name, contactPerson, email, phone, address, notes, isActive } = req.body;

        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).json({ message: 'Supplier not found' });
        }

        const wasActive = supplier.isActive;
        if (name && name.trim().toLowerCase() !== supplier.name.trim().toLowerCase()) {
            const duplicate = await Supplier.findOne({
                _id: { $ne: supplier._id },
                name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' }
            });
            if (duplicate) {
                return res.status(409).json({ message: 'A supplier with this name already exists' });
            }
        }
        supplier.name = name || supplier.name;
        supplier.contactPerson = contactPerson !== undefined ? contactPerson : supplier.contactPerson;
        supplier.email = email !== undefined ? email : supplier.email;
        supplier.phone = phone !== undefined ? phone : supplier.phone;
        supplier.address = address !== undefined ? address : supplier.address;
        supplier.notes = notes !== undefined ? notes : supplier.notes;
        
        if (isActive !== undefined) {
            supplier.isActive = isActive;
        }

        const updatedSupplier = await supplier.save();
        await AuditLog.create({
            actor: req.user._id,
            action: wasActive && updatedSupplier.isActive === false ? AUDIT_EVENTS.SUPPLIER_DEACTIVATED : AUDIT_EVENTS.SUPPLIER_UPDATED,
            target: updatedSupplier._id.toString(),
            entityType: 'Supplier',
            entityId: updatedSupplier._id.toString(),
            entityDisplay: updatedSupplier.name,
            description: `${wasActive && updatedSupplier.isActive === false ? 'Deactivated' : 'Updated'} supplier ${updatedSupplier.name}`,
            ipAddress: req.ip
        });
        res.json(updatedSupplier);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error updating supplier' });
    }
};
