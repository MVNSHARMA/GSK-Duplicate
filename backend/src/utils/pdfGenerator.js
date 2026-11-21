import mongoose from 'mongoose';
import { generateInvoicePDF } from './generateInvoicePDF.js';

export const generateInvoicePDFContent = async (invoice) => {
  let settings = {};

  try {
    const Setting = mongoose.model('Setting');
    settings = await Setting.findOne().lean() || {};
  } catch (error) {
    settings = {};
  }

  return generateInvoicePDF(invoice, settings);
};
