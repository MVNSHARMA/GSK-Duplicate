import mongoose from "mongoose";
import Customer from "../models/Customer.js";

/**
 * Middleware to enforce that the authenticated user is a valid customer portal user.
 * 
 * Verifies:
 * 1. user exists (req.user)
 * 2. role is 'user' (or explicitly allowed for portal)
 * 3. customerId exists and is a valid ObjectId
 * 4. customer exists and is active in the database
 */
export const requireCustomerUser = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        // Must be the 'user' role. We do not allow admin/mechanic into the customer portal via this middleware.
        if (req.user.role !== 'user') {
            return res.status(403).json({ success: false, error: 'Access denied. Must be a customer user.' });
        }

        if (!req.user.customerId) {
            return res.status(403).json({ success: false, error: 'User is not linked to a customer account.' });
        }

        if (!mongoose.Types.ObjectId.isValid(req.user.customerId)) {
            return res.status(400).json({ success: false, error: 'Invalid customer link.' });
        }

        const customer = await Customer.findById(req.user.customerId).lean();

        if (!customer) {
            return res.status(404).json({ success: false, error: 'Customer account not found.' });
        }

        if (customer.isActive === false) {
            return res.status(403).json({ success: false, error: 'Customer account is inactive.' });
        }

        // Make customer record available for downstream use if needed
        req.customer = customer;

        next();
    } catch (error) {
        console.error("Error in requireCustomerUser middleware:", error);
        res.status(500).json({ success: false, error: 'Server error during customer authorization.' });
    }
};
export const requireB2BCustomer = async (req, res, next) => {
    try {
        if (!req.customer) {
            return res.status(401).json({ success: false, error: 'Customer not loaded.' });
        }
        
        if (req.customer.customerType === 'regular') {
            return res.status(403).json({ success: false, error: 'Access denied. B2B functionality is not available for regular customers.' });
        }
        
        next();
    } catch (error) {
        console.error("Error in requireB2BCustomer middleware:", error);
        res.status(500).json({ success: false, error: 'Server error during B2B authorization.' });
    }
};
