import mongoose from 'mongoose';

/**
 * Calculates the financial breakdown for a set of parts and labour.
 * 
 * @param {Object} params
 * @param {Array} params.partsAndLabour - Array of items with { qty, price }
 * @param {Number} params.labourHours - Labour hours (used if hourlyRate is provided)
 * @param {Number} params.hourlyRate - Hourly rate
 * @param {Object} params.charges - Extra charges like lubricantsOil, etc.
 * @param {Number} params.gstRate - Optional explicit GST rate to use. If not provided, it fetches from Settings.
 * @returns {Promise<Object>} { subtotal, gstRate, gstAmount, totalAmount }
 */
export const calculateTaxAndTotals = async ({
    partsAndLabour = [],
    labourHours = 0,
    hourlyRate = 0,
    charges = {},
    discountAmount = 0,
    finalAmountOverride = null,
    gstRate = null
}) => {
    let grossSubtotal = 0;

    // 1. Calculate from partsAndLabour array (Invoice style)
    if (partsAndLabour && partsAndLabour.length > 0) {
        grossSubtotal += partsAndLabour.reduce((sum, item) => sum + ((item.qty || 1) * (item.price || 0)), 0);
    }

    // 2. Calculate from separate labour/charges fields (JobCard style)
    const labourTotal = (labourHours || 0) * (hourlyRate || 0);
    const partsTotal = (charges?.lubricantsOil || 0) + 
                     (charges?.differentialOil || 0) + 
                     (charges?.miscellaneous || 0) + 
                     (charges?.transmission || 0) + 
                     (charges?.brakeFluid || 0);
    
    grossSubtotal += labourTotal + partsTotal;

    const validDiscount = Math.max(0, Number(discountAmount) || 0);
    let subtotal = Math.max(0, grossSubtotal - validDiscount);

    // 3. Determine GST Rate
    let appliedGstRate = gstRate;
    if (appliedGstRate === null || appliedGstRate === undefined) {
        try {
            const Setting = mongoose.model('Setting');
            const settings = await Setting.findOne();
            appliedGstRate = settings?.gstRate ?? 10;
        } catch (err) {
            appliedGstRate = 10; // Fallback
        }
    }

    // 4. Calculate GST and Total
    let gstAmount = (subtotal * appliedGstRate) / 100;
    let totalAmount = subtotal + gstAmount;

    if (finalAmountOverride !== null && finalAmountOverride !== undefined && finalAmountOverride !== '') {
        const parsedFinal = Number(finalAmountOverride);
        if (!Number.isNaN(parsedFinal) && parsedFinal >= 0) {
            totalAmount = parsedFinal;
            if (appliedGstRate > 0) {
                subtotal = Number((totalAmount / (1 + appliedGstRate / 100)).toFixed(2));
                gstAmount = Number((totalAmount - subtotal).toFixed(2));
            } else {
                subtotal = totalAmount;
                gstAmount = 0;
            }
        }
    }

    return {
        subtotal,
        gstRate: appliedGstRate,
        gstAmount,
        totalAmount
    };
};
