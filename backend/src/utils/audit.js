import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import ImportTracker from '../models/ImportTracker.js';
import RentalServiceEntry from '../models/RentalServiceEntry.js';
import JobCard from '../models/JobCard.js';
import Invoice from '../models/Invoice.js';
import Booking from '../models/Booking.js';
import Quote from '../models/Quote.js';

export const runAudit = async (req, res) => {
    try {
        const issues = [];
        const customers = await Customer.find({});
        const vehicles = await Vehicle.find({});
        const trackers = await ImportTracker.find({});
        const rentals = await RentalServiceEntry.find({});

        // 1. Duplicate Customers Check
        const emails = customers.map(c => c.email).filter(Boolean);
        const duplicateEmails = emails.filter((item, index) => emails.indexOf(item) !== index);
        if (duplicateEmails.length > 0) issues.push({ type: 'DUPLICATE_CUSTOMERS', data: [...new Set(duplicateEmails)] });

        // 2. Duplicate Vehicles Check
        const regNos = vehicles.map(v => v.registrationNumber).filter(Boolean);
        const duplicateRegs = regNos.filter((item, index) => regNos.indexOf(item) !== index);
        if (duplicateRegs.length > 0) issues.push({ type: 'DUPLICATE_VEHICLES', data: [...new Set(duplicateRegs)] });

        // 3. Vehicles with Missing/Invalid Customer
        const customerIds = new Set(customers.map(c => c._id.toString()));
        const orphanedVehicles = vehicles.filter(v => v.customerId && !customerIds.has(v.customerId.toString()));
        if (orphanedVehicles.length > 0) issues.push({ type: 'ORPHANED_VEHICLES', count: orphanedVehicles.length, ids: orphanedVehicles.map(v => v._id) });

        // 4. Import Tracker Integrity
        const invalidTrackers = trackers.filter(t => {
            if (!t.customerId || !t.vehicleId) return true;
            if (!customerIds.has(t.customerId.toString())) return true;
            const c = customers.find(cust => cust._id.toString() === t.customerId.toString());
            if (c.customerType !== 'import_company') return true;
            return false;
        });
        if (invalidTrackers.length > 0) issues.push({ type: 'INVALID_IMPORT_TRACKERS', count: invalidTrackers.length });

        // 5. Rental Integrity
        const invalidRentals = rentals.filter(r => {
            if (!r.customerId || !r.vehicleId) return true;
            if (!customerIds.has(r.customerId.toString())) return true;
            const c = customers.find(cust => cust._id.toString() === r.customerId.toString());
            if (c.customerType !== 'rental_company') return true;
            return false;
        });
        if (invalidRentals.length > 0) issues.push({ type: 'INVALID_RENTALS', count: invalidRentals.length });

        const counts = {
            customers: customers.length,
            vehicles: vehicles.length,
            trackers: trackers.length,
            rentals: rentals.length
        };

        res.json({ success: true, counts, issues });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
