/**
 * Shared booking service identifiers and Import Compliance validation.
 *
 * The service id is stored verbatim in `Booking.services[]` (same pattern as
 * 'Pink Slip' / 'Blue Slip') and must match the id used by the booking page
 * (frontend/src/pages/BookService.jsx).
 */

export const IMPORT_COMPLIANCE_SERVICE = 'Import Compliance';

export const IMPORT_APPROVAL_STATUSES = [
    'Approved',
    'Application in Progress',
    'Not Yet Applied',
    'Not Sure'
];

const MAX_VIN_LENGTH = 50;
const MAX_COUNTRY_LENGTH = 80;
const MAX_NOTES_LENGTH = 1000;
// Chassis numbers on older imports can be short / hyphenated (e.g. GX71-123456), so don't force 17-char VINs.
const VIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-\s]{2,}$/;

export const bookingIncludesImportCompliance = (services) =>
    Array.isArray(services) && services.includes(IMPORT_COMPLIANCE_SERVICE);

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Validates one vehicle entry of a booking request that includes Import Compliance.
 * Make / model / year are the booking's existing vehicleInfo fields (reused, not duplicated);
 * VIN, country, approval status and notes live in `importVehicleInfo`.
 *
 * @param {{ vehicleInfo?: object, importVehicleInfo?: object }} vehicle
 * @returns {{ error: string|null, importVehicleInfo?: object }}
 */
export const validateImportComplianceVehicle = (vehicle = {}) => {
    const info = vehicle.vehicleInfo || {};
    const raw = vehicle.importVehicleInfo || {};

    if (!clean(String(info.make ?? ''))) return { error: 'Vehicle make is required for Import Compliance.' };
    if (!clean(String(info.model ?? ''))) return { error: 'Vehicle model is required for Import Compliance.' };

    const year = Number.parseInt(info.year, 10);
    const maxYear = new Date().getFullYear() + 1;
    if (!Number.isInteger(year) || year < 1900 || year > maxYear) {
        return { error: `Manufacturing year is required for Import Compliance (between 1900 and ${maxYear}).` };
    }

    const vin = clean(raw.vin).toUpperCase();
    if (!vin) return { error: 'VIN / Chassis number is required for Import Compliance.' };
    if (vin.length > MAX_VIN_LENGTH || !VIN_PATTERN.test(vin)) {
        return { error: 'Please enter a valid VIN / Chassis number (letters, numbers and hyphens only).' };
    }

    const countryOfOrigin = clean(raw.countryOfOrigin);
    if (!countryOfOrigin) return { error: 'Country of origin is required for Import Compliance.' };
    if (countryOfOrigin.length > MAX_COUNTRY_LENGTH) return { error: 'Country of origin is too long.' };

    const approvalStatus = clean(raw.approvalStatus);
    if (!IMPORT_APPROVAL_STATUSES.includes(approvalStatus)) {
        return { error: `Import approval status must be one of: ${IMPORT_APPROVAL_STATUSES.join(', ')}.` };
    }

    const additionalInfo = clean(raw.additionalInfo);
    if (additionalInfo.length > MAX_NOTES_LENGTH) {
        return { error: `Import additional information must be ${MAX_NOTES_LENGTH} characters or fewer.` };
    }

    return {
        error: null,
        importVehicleInfo: { vin, countryOfOrigin, approvalStatus, additionalInfo }
    };
};

