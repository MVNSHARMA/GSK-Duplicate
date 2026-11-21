import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import Invoice from '../models/Invoice.js';
import JobCard from '../models/JobCard.js';
import DealerCar from '../models/DealerCar.js';
import Rental from '../models/RentalServiceEntry.js';
import Sale from '../models/Sale.js';
import Contact from '../models/Contact.js';
import Quote from '../models/Quote.js';
import Booking from '../models/Booking.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import AuditLog from '../models/AuditLog.js';
import { escapeRegex } from '../utils/sanitize.js';
import { computeInvoiceRetentionInfo } from '../utils/retentionPolicy.js';

const getModelConfig = (type) => {
    switch(type) {
        case 'Customer': return { model: Customer, labelField: 'name' };
        case 'Vehicle': return { model: Vehicle, labelField: 'registrationNumber' };
        case 'Invoice': return { model: Invoice, labelField: 'invoiceNo' };
        case 'JobCard': return { model: JobCard, labelField: '_id' };
        case 'DealerCar': return { model: DealerCar, labelField: 'make' };
        case 'Rental': return { model: Rental, labelField: '_id' };
        case 'Sale': return { model: Sale, labelField: '_id' };
        case 'Contact': return { model: Contact, labelField: 'email' };
        case 'Quote': return { model: Quote, labelField: '_id' };
        case 'Booking': return { model: Booking, labelField: '_id' };
        case 'PurchaseOrder': return { model: PurchaseOrder, labelField: 'purchaseOrderNumber' };
        default: return null;
    }
};

const getSearchFilter = (type, search) => {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    switch(type) {
        case 'Customer': return { $or: [{ name: regex }, { email: regex }, { phone: regex }] };
        case 'Vehicle': return { $or: [{ registrationNumber: regex }, { make: regex }, { model: regex }] };
        case 'Invoice': return { invoiceNo: regex };
        case 'JobCard': return {}; // Searching by ID regex is complex, skip for now or add jobCardNumber if it exists
        case 'DealerCar': return { $or: [{ make: regex }, { model: regex }, { stockNumber: regex }] };
        case 'Rental': return {};
        case 'Sale': return {};
        case 'Contact': return { $or: [{ firstName: regex }, { email: regex }, { subject: regex }] };
        case 'Quote': return { $or: [{ 'customerInfo.fullName': regex }, { 'vehicleInfo.regNo': regex }] };
        case 'Booking': return { $or: [{ 'customerInfo.firstName': regex }, { 'vehicleInfo.regNo': regex }] };
        case 'PurchaseOrder': return { purchaseOrderNumber: regex };
        default: return {};
    }
};

// @desc    Get all soft-deleted items across collections
// @route   GET /api/trash
// @access  Private (Admin/SuperAdmin)
export const getTrashItems = async (req, res) => {
    try {
        const { page = 1, limit = 15, search = '', type = 'All' } = req.query;
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
        const skip = (safePage - 1) * parsedLimit;

        const formatTrash = (items, typeName, labelField) => 
            items.map(i => ({ 
                _id: i._id, 
                type: typeName, 
                label: i[labelField] || i.invoiceNo || i.registrationNumber || (i.customerInfo ? i.customerInfo.fullName : null) || i.email || i._id,
                deletedAt: i.updatedAt 
            }));

        let total = 0;
        let trash = [];

        if (type !== 'All') {
            const config = getModelConfig(type);
            if (!config) return res.status(400).json({ success: false, error: "Invalid type" });
            
            const filter = { isActive: false, ...(search ? getSearchFilter(type, search) : {}) };
            
            const [items, count] = await Promise.all([
                config.model.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(parsedLimit).lean(),
                config.model.countDocuments(filter)
            ]);
            
            trash = formatTrash(items, type, config.labelField);
            total = count;
        } else {
            // Aggregate from all types
            const types = ['Customer', 'Vehicle', 'Invoice', 'JobCard', 'DealerCar', 'Rental', 'Sale', 'Contact', 'Quote', 'Booking', 'PurchaseOrder'];
            
            // To support pagination across multiple collections without massive memory overhead:
            // We cap per-collection fetch at 200 items so deep page numbers cannot exhaust heap memory.
            const fetchLimit = 200;
            
            const promises = types.map(async t => {
                const config = getModelConfig(t);
                const filter = { isActive: false, ...(search ? getSearchFilter(t, search) : {}) };
                const items = await config.model.find(filter)
                    .select('_id updatedAt name registrationNumber invoiceNo make email customerInfo purchaseOrderNumber')
                    .sort({ updatedAt: -1 })
                    .limit(fetchLimit)
                    .lean();
                const count = items.length < fetchLimit
                    ? items.length
                    : await config.model.countDocuments(filter);
                return { type: t, items, labelField: config.labelField, count };
            });
            
            const results = await Promise.all(promises);
            
            let allItems = [];
            results.forEach(res => {
                total += res.count;
                allItems = [...allItems, ...formatTrash(res.items, res.type, res.labelField)];
            });
            
            // Sort merged items descending by deletedAt
            allItems.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
            
            // Apply skip and limit
            trash = allItems.slice(skip, skip + parsedLimit);
        }

        res.status(200).json({ 
            success: true, 
            data: trash,
            pagination: {
                total,
                page: parseInt(page),
                limit: parsedLimit,
                pages: Math.ceil(total / parsedLimit)
            }
        });
    } catch (error) {
        console.error("Error fetching trash:", error);
        res.status(500).json({ success: false, error: "Server Error fetching trash" });
    }
};

// @desc    Restore a soft-deleted item
// @route   PUT /api/trash/:type/:id/restore
// @access  Private (Admin/SuperAdmin)
export const restoreItem = async (req, res) => {
    try {
        const { type, id } = req.params;
        const config = getModelConfig(type);
        if (!config) return res.status(400).json({ success: false, error: "Invalid item type" });

        const item = await config.model.findById(id);
        if (!item) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }

        // Conflict check could be implemented here for unique constraints

        item.isActive = true;
        await item.save();

        await AuditLog.create({
            actor: req.user._id,
            action: 'RESTORE_ITEM',
            target: item._id.toString(),
            metadata: { type },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: item });
    } catch (error) {
        console.error("Error restoring item:", error);
        res.status(500).json({ success: false, error: "Server Error restoring item" });
    }
};

// Helper for checking dependencies
const checkDeleteDependencies = async (type, id) => {
    switch(type) {
        case 'Customer': 
            const activeVehicles = await Vehicle.countDocuments({ customerId: id, isActive: { $ne: false } });
            const activeInvoices = await Invoice.countDocuments({ customerId: id, $or: [{ isActive: { $ne: false } }, { status: { $in: ['Unpaid', 'Partially Paid', 'Paid', 'Cancelled', 'Voided'] } }] });
            const activeJobCardsC = await JobCard.countDocuments({ customerId: id, isActive: { $ne: false } });
            const activeRentalsC = await Rental.countDocuments({ customerId: id, isActive: { $ne: false } });
            const activeSalesC = await Sale.countDocuments({ customerId: id, isActive: { $ne: false } });
            const activeQuotesC = await Quote.countDocuments({ customerId: id, isActive: { $ne: false } });
            const activeBookingsC = await Booking.countDocuments({ customerId: id, isActive: { $ne: false } });
            const activeContactsC = await Contact.countDocuments({ customerId: id, isActive: { $ne: false } });
            
            if (activeVehicles > 0 || activeInvoices > 0 || activeJobCardsC > 0 || activeRentalsC > 0 || activeSalesC > 0 || activeQuotesC > 0 || activeBookingsC > 0 || activeContactsC > 0) {
                return "Cannot delete customer with active dependent records.";
            }
            break;
        case 'Vehicle': 
            const activeInvoicesV = await Invoice.countDocuments({ vehicleId: id, isActive: { $ne: false } });
            const activeJobCardsV = await JobCard.countDocuments({ vehicleId: id, isActive: { $ne: false } });
            const activeRentalsV = await Rental.countDocuments({ vehicleId: id, isActive: { $ne: false } });
            const activeQuotesV = await Quote.countDocuments({ vehicleId: id, isActive: { $ne: false } });
            const activeBookingsV = await Booking.countDocuments({ vehicleId: id, isActive: { $ne: false } });
            if (activeInvoicesV > 0 || activeJobCardsV > 0 || activeRentalsV > 0 || activeQuotesV > 0 || activeBookingsV > 0) {
                return "Cannot delete vehicle with active invoices, job cards, quotes, bookings, or rentals.";
            }
            break;
        case 'Invoice': {
            const invoiceDoc = await Invoice.findById(id).populate('jobCardId', 'status').lean();
            if (invoiceDoc) {
                const retention = computeInvoiceRetentionInfo(invoiceDoc);
                if (!retention.canDeletePermanently) {
                    const reasonText = retention.blockingReasons.length > 0
                        ? retention.blockingReasons.join(' ')
                        : 'Financial invoices require explicit post-5-year retention review and disposal authorization (approved_for_disposal) before permanent deletion.';
                    return `Cannot permanently delete invoice ${invoiceDoc.invoiceNo}: ${reasonText}`;
                }
            }
            break;
        }
        case 'Quote': {
            const quoteDoc = await Quote.findById(id).lean();
            if (quoteDoc && quoteDoc.convertedToInvoiceId) {
                return 'Cannot permanently delete a Quote that has been converted into an Invoice.';
            }
            break;
        }
    }
    return null; // No errors
};

// @desc    Permanently delete an item
// @route   DELETE /api/trash/:type/:id
// @access  Private (SuperAdmin)
export const deleteItemPermanently = async (req, res) => {
    try {
        const { type, id } = req.params;
        const config = getModelConfig(type);
        if (!config) return res.status(400).json({ success: false, error: "Invalid item type" });

        const dependencyError = await checkDeleteDependencies(type, id);
        if (dependencyError) {
            return res.status(400).json({ success: false, error: dependencyError });
        }

        const item = await config.model.findByIdAndDelete(id);
        
        if (!item) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }

        await AuditLog.create({
            actor: req.user._id,
            action: 'PERMANENT_DELETE',
            target: id,
            metadata: { type },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error("Error deleting item permanently:", error);
        res.status(500).json({ success: false, error: "Server Error deleting item permanently" });
    }
};

// @desc    Permanently bulk delete items
// @route   POST /api/trash/bulk-delete
// @access  Private (SuperAdmin)
export const bulkDeleteItems = async (req, res) => {
    try {
        const { selectAll = false, filters = {}, items = [] } = req.body;
        let itemsToDelete = [];

        if (selectAll) {
            const { type = 'All', search = '' } = filters;
            
            if (type !== 'All') {
                const config = getModelConfig(type);
                if (!config) return res.status(400).json({ success: false, error: "Invalid type filter" });
                
                const filterQuery = { isActive: false, ...(search ? getSearchFilter(type, search) : {}) };
                const matchedIds = await config.model.find(filterQuery).select('_id').lean();
                itemsToDelete = matchedIds.map(i => ({ type, id: i._id.toString() }));
            } else {
                const types = ['Customer', 'Vehicle', 'Invoice', 'JobCard', 'DealerCar', 'Rental', 'Sale', 'Contact', 'Quote', 'Booking'];
                for (const t of types) {
                    const config = getModelConfig(t);
                    const filterQuery = { isActive: false, ...(search ? getSearchFilter(t, search) : {}) };
                    const matchedIds = await config.model.find(filterQuery).select('_id').lean();
                    matchedIds.forEach(i => itemsToDelete.push({ type: t, id: i._id.toString() }));
                }
            }
        } else {
            itemsToDelete = items;
        }

        if (!itemsToDelete || itemsToDelete.length === 0) {
            return res.status(400).json({ success: false, error: "No items selected for deletion" });
        }

        let deletedCount = 0;
        let skippedCount = 0;
        let errors = [];

        for (const item of itemsToDelete) {
            const { type, id } = item;
            try {
                const config = getModelConfig(type);
                if (!config) {
                    skippedCount++;
                    errors.push(`Invalid type ${type} for id ${id}`);
                    continue;
                }

                const dependencyError = await checkDeleteDependencies(type, id);
                if (dependencyError) {
                    skippedCount++;
                    errors.push(`Dependency error for ${type} ${id}: ${dependencyError}`);
                    continue;
                }

                // Actually perform deletion safely
                const deleted = await config.model.findOneAndDelete({ _id: id, isActive: false });
                if (deleted) {
                    deletedCount++;
                    await AuditLog.create({
                        actor: req.user._id,
                        action: 'PERMANENT_DELETE_BULK',
                        target: id.toString(),
                        metadata: { type },
                        ipAddress: req.ip
                    });
                } else {
                    skippedCount++;
                    errors.push(`${type} ${id} not found or already active/deleted.`);
                }
            } catch (err) {
                console.error(`Error processing bulk delete for ${type} ${id}:`, err);
                skippedCount++;
                errors.push(`Internal error processing ${type} ${id}`);
            }
        }

        res.status(200).json({ 
            success: true, 
            data: { 
                requested: itemsToDelete.length, 
                deleted: deletedCount, 
                skipped: skippedCount, 
                errors 
            } 
        });
    } catch (error) {
        console.error("Error bulk deleting items:", error);
        res.status(500).json({ success: false, error: "Server Error bulk deleting items" });
    }
};
