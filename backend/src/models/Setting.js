import mongoose from 'mongoose';
import { OFFICIAL_BUSINESS_NAME, OFFICIAL_BUSINESS_ADDRESS, OFFICIAL_BUSINESS_PHONE } from '../utils/businessInfo.js';

const settingSchema = new mongoose.Schema({
    businessName: { type: String, default: OFFICIAL_BUSINESS_NAME },
    businessAddress: { type: String, default: OFFICIAL_BUSINESS_ADDRESS },
    businessPhone: { type: String, default: OFFICIAL_BUSINESS_PHONE },
    businessEmail: { type: String, default: 'info@gskautomotive.com.au' },
    logoUrl: { type: String, default: '' },
    businessHours: { 
        type: [{
            day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
            isOpen: { type: Boolean, default: true },
            openTime: { type: String, default: '08:00' },
            closeTime: { type: String, default: '17:00' }
        }], 
        default: [
            { day: 'Monday', isOpen: true, openTime: '08:00', closeTime: '17:00' },
            { day: 'Tuesday', isOpen: true, openTime: '08:00', closeTime: '17:00' },
            { day: 'Wednesday', isOpen: true, openTime: '08:00', closeTime: '17:00' },
            { day: 'Thursday', isOpen: true, openTime: '08:00', closeTime: '17:00' },
            { day: 'Friday', isOpen: true, openTime: '08:00', closeTime: '17:00' },
            { day: 'Saturday', isOpen: false, openTime: '09:00', closeTime: '13:00' },
            { day: 'Sunday', isOpen: false, openTime: '00:00', closeTime: '00:00' }
        ]
    },
    timezone: { type: String, default: 'Australia/Sydney' },
    defaultBookingCapacity: { type: Number, default: 3 },
    invoicePrefix: { type: String, default: 'INV-' },
    inventoryWarningThreshold: { type: Number, default: 5 },
    gstRate: { type: Number, default: 10 },
    standardLabourRate: { type: Number, default: 120 },
    invoiceTerms: { type: String, default: '• All work carried out with due care and skill.\n• Parts used may be OEM or equivalent quality.\n• Warranty applies to parts and labour as per workshop policy.\n• Customer advised of any additional work prior to completion.' },
    defaultEmployeePermissions: {
        admin: {
            pagePermissions: {
                type: Map,
                of: Boolean,
                default: {
                    dashboard: true,
                    customers: true,
                    regularCustomers: true,
                    vehicles: true,
                    importTrackers: false,
                    dailySales: false,
                    rentals: false,
                    invoices: true,
                    jobCards: true,
                    inventory: true,
                    dealerCars: false,
                    communications: true,
                    notifications: true,
                    settings: false,
                    auditLogs: false
                }
            },
            additionalPageAccess: [{ type: String }],
            additionalActionPermissions: [{ type: String }]
        },
        mechanic: {
            pagePermissions: {
                type: Map,
                of: Boolean,
                default: {
                    dashboard: true,
                    customers: true,
                    regularCustomers: true,
                    vehicles: true,
                    importTrackers: false,
                    dailySales: false,
                    rentals: false,
                    invoices: true,
                    jobCards: true,
                    inventory: true,
                    dealerCars: false,
                    communications: true,
                    notifications: true,
                    settings: false,
                    auditLogs: false
                }
            },
            additionalPageAccess: [{ type: String }],
            additionalActionPermissions: [{ type: String }]
        }
    }
}, { timestamps: true });

export default mongoose.model('Setting', settingSchema);
