import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import { escapeRegex } from './sanitize.js';

/**
 * Resolves the Customer identity safely according to Phase 5 rules.
 * @param {Object} customerInfo - Public payload { firstName, lastName, email, phone, ... }
 * @param {String} authenticatedCustomerId - ID from req.user if authenticated
 * @param {Object} session - Mongoose transaction session
 * @returns {Promise<String|null>} Resolved Customer ObjectId or null if ambiguous
 */
export const resolveCustomerIdentity = async (customerInfo, authenticatedCustomerId = null, session = null) => {
    // Rule 1 & 3: Authenticated user is authoritative
    if (authenticatedCustomerId) {
        const existingAuth = await Customer.findById(authenticatedCustomerId).session(session);
        if (existingAuth) {
            return existingAuth._id;
        }
    }

    if (!customerInfo) return null;

    const email = customerInfo.email?.trim();
    const phone = customerInfo.phone?.trim();

    if (!email && !phone) return null;

    // Build soft match criteria
    const matchCriteria = [];
    if (email) matchCriteria.push({ email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') } });
    if (phone) matchCriteria.push({ phone });

    // Rule 1: Find Confident Match
    const matches = await Customer.find({ isActive: true, $or: matchCriteria }).session(session);

    if (matches.length === 1) {
        // Exactly one reliable match
        // Rule 2: DO NOT overwrite customerType, name, phone, email simply because of public request
        return matches[0]._id;
    }

    if (matches.length > 1) {
        // Rule 1: If ambiguous, do NOT automatically merge.
        // Returning null forces the application to rely on the historical snapshot for this request,
        // leaving the Admin to manually resolve it later.
        console.warn(`[IdentityResolver] Ambiguous customer match for email: ${email}, phone: ${phone}`);
        return null; 
    }

    // Zero matches: Create new Customer (Rule 21: Single source of truth)
    const fullName = customerInfo.fullName || `${customerInfo.firstName || ''} ${customerInfo.lastName || ''}`.trim() || 'Unknown Customer';
    
    const newCustomer = await Customer.create([{
        name: fullName,
        email: email || undefined,
        phone: phone || undefined,
        customerType: 'regular' // Defaults to regular for public requests
    }], { session });

    return newCustomer[0]._id;
};

/**
 * Resolves the Vehicle identity safely according to Phase 5 rules.
 * @param {Object} vehicleInfo - Public payload { make, model, year, regNo, vin, ... }
 * @param {String} customerId - Resolved Customer ObjectId
 * @param {String} authenticatedVehicleId - Explicit vehicle ID if provided securely
 * @param {Object} session - Mongoose transaction session
 * @returns {Promise<String|null>} Resolved Vehicle ObjectId or null
 */
export const resolveVehicleIdentity = async (vehicleInfo, customerId, authenticatedVehicleId = null, session = null) => {
    // Rule 4: Priority 1 - Authenticated Vehicle ID
    if (authenticatedVehicleId) {
        const existingAuthVehicle = await Vehicle.findById(authenticatedVehicleId).session(session);
        if (existingAuthVehicle) {
            return existingAuthVehicle._id;
        }
    }

    if (!vehicleInfo || !customerId) return null;

    const vin = vehicleInfo.vin?.trim();
    const regNo = vehicleInfo.regNo?.trim();

    // Rule 4: Priority 2 - VIN/Chassis
    if (vin) {
        const vinMatch = await Vehicle.findOne({ isActive: true, vin: { $regex: new RegExp(`^${escapeRegex(vin)}$`, 'i') } }).session(session);
        if (vinMatch) {
            // Check if it belongs to someone else
            if (vinMatch.customerId.toString() !== customerId.toString()) {
                console.warn(`[IdentityResolver] VIN ${vin} belongs to a different customer.`);
                return null; // Ambiguous/Conflict: Do not merge
            }
            return vinMatch._id;
        }
    }

    // Rule 4 & 5: Priority 3 - Rego + Customer ID
    if (regNo) {
        const escapedRegNo = escapeRegex(regNo);
        // Must match BOTH regNo and customerId to prevent cross-customer hijacking
        const regMatch = await Vehicle.findOne({ 
            isActive: true,
            registrationNumber: { $regex: new RegExp(`^${escapedRegNo}$`, 'i') },
            customerId: customerId
        }).session(session);

        if (regMatch) {
            return regMatch._id;
        }

        // Rule 5: What if regNo matches a DIFFERENT customer?
        const crossMatch = await Vehicle.findOne({
            isActive: true,
            registrationNumber: { $regex: new RegExp(`^${escapedRegNo}$`, 'i') }
        }).session(session);

        if (crossMatch) {
            // Rule 6: Do not silently merge it with an existing vehicle if it belongs to someone else
            console.warn(`[IdentityResolver] RegNo ${regNo} belongs to a different customer. Rejecting auto-merge.`);
            return null;
        }
    }

    // If we have minimum info, create a new vehicle linked to the customer
    if (regNo || vin || vehicleInfo.make || vehicleInfo.brand) {
        const newVehicle = await Vehicle.create([{
            customerId: customerId,
            brand: vehicleInfo.make || vehicleInfo.brand || 'Unknown',
            model: vehicleInfo.model || 'Unknown',
            year: vehicleInfo.year,
            registrationNumber: regNo ? regNo.toUpperCase() : undefined,
            vin: vin ? vin.toUpperCase() : undefined,
            mileage: vehicleInfo.kilometers,
            transmission: vehicleInfo.transmission
        }], { session });

        return newVehicle[0]._id;
    }

    return null;
};
