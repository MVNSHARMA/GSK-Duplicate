import JobCard from '../models/JobCard.js';
import Invoice from '../models/Invoice.js';
import Quote from '../models/Quote.js';
import Booking from '../models/Booking.js';
import Rental from '../models/RentalServiceEntry.js';
import RentalVehicle from '../models/RentalServiceEntryVehicle.js';
import DealerCar from '../models/DealerCar.js';

/**
 * Fetch unified history for a given query (e.g., vehicleId or customerId)
 */
export const getUnifiedHistory = async ({
    query,
    typeFilter = 'All',
    page = 1,
    limit = 20,
    userRole
}) => {
    // Determine which collections to query based on typeFilter
    let fetchBookings = true, fetchQuotes = true, fetchJobCards = true, fetchInvoices = true, fetchRentals = true;
    
    const t = typeFilter.toLowerCase();
    if (t !== 'all') {
        fetchBookings = t === 'bookings';
        fetchQuotes = t === 'quotes';
        fetchJobCards = t === 'services';
        fetchInvoices = t === 'invoices';
        fetchRentals = t === 'rentals';
    }

    const populateVehicle = { path: 'vehicleId', select: 'make model registrationNumber' };
    const populateTrackerCar = { path: 'trackerCarId', select: 'make model registrationNumber vin' };
    const populateCustomer = { path: 'customerId', select: 'name email phone customerType' };

    const promises = [];

    if (fetchBookings) promises.push(Booking.find(query).populate(populateVehicle).populate(populateCustomer).lean());
    else promises.push(Promise.resolve([]));

    if (fetchQuotes) promises.push(Quote.find(query).populate(populateVehicle).populate(populateCustomer).lean());
    else promises.push(Promise.resolve([]));

    if (fetchJobCards) promises.push(JobCard.find(query).populate(populateVehicle).populate(populateTrackerCar).populate(populateCustomer).lean());
    else promises.push(Promise.resolve([]));

    if (fetchInvoices) promises.push(Invoice.find(query).populate(populateVehicle).populate(populateTrackerCar).populate(populateCustomer).lean());
    else promises.push(Promise.resolve([]));

    if (fetchRentals) {
        if (query.vehicleId) {
            promises.push(RentalVehicle.find({ vehicleId: query.vehicleId }).populate({ path: 'serviceEntryId', populate: { path: 'customerId', select: 'name email phone customerType' } }).populate('vehicleId').lean());
        } else {
            promises.push(Rental.find(query).populate(populateCustomer).lean());
        }
    } else {
        promises.push(Promise.resolve([]));
    }

    const [bookings, quotes, jobCards, invoices, rentals] = await Promise.all(promises);

    const isMechanic = userRole === 'mechanic';

    let groupedEvents = [];
    
    const processedBookings = new Set();
    const processedJobCards = new Set();
    const processedInvoices = new Set();
    const processedRentals = new Set();

    // 1. Process JobCards (can contain Bookings and Invoices)
    for (const jc of jobCards) {
        let event = {
            id: jc._id.toString(),
            type: 'Service',
            title: jc.servicesOrdered && jc.servicesOrdered.length > 0 ? jc.servicesOrdered.join(', ') : 'Service',
            status: jc.status,
            date: jc.createdAt,
            vehicle: jc.vehicleId || jc.trackerCarId,
            customer: jc.customerId,
            jobCard: {
                id: jc._id,
                status: jc.status,
                totalAmount: isMechanic ? undefined : jc.totalAmount, // Will be recalculated
            },
            invoice: null,
            booking: null
        };
        
        // Recalculate job card total since .lean() drops virtuals
        let jcTotal = (jc.labourHours || 0) * (jc.hourlyRate || 0);
        jcTotal += (jc.charges?.lubricantsOil || 0) + (jc.charges?.differentialOil || 0) + (jc.charges?.miscellaneous || 0) + (jc.charges?.transmission || 0) + (jc.charges?.brakeFluid || 0);
        if (!isMechanic) {
            event.jobCard.totalAmount = jcTotal;
        }

        // Find linked invoices
        const linkedInvoices = invoices.filter(inv => inv.jobCardId?.toString() === jc._id.toString());
        event.invoices = [];
        if (linkedInvoices.length > 0) {
            let totalInvoicesAmount = 0;
            for (const linkedInvoice of linkedInvoices) {
                let invTotal = (linkedInvoice.partsAndLabour || []).reduce((sum, item) => sum + (item.qty * item.price), 0);
                event.invoices.push({
                    id: linkedInvoice._id,
                    invoiceNo: linkedInvoice.invoiceNo,
                    status: linkedInvoice.status,
                    totalAmount: isMechanic ? undefined : invTotal
                });
                processedInvoices.add(linkedInvoice._id.toString());
                totalInvoicesAmount += invTotal;
            }
            // Use the date of the most recent invoice if available
            event.date = linkedInvoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt;
        }

        // Find linked booking
        if (jc.bookingId) {
            const linkedBooking = bookings.find(b => b._id.toString() === jc.bookingId.toString());
            if (linkedBooking) {
                event.booking = {
                    id: linkedBooking._id,
                    status: linkedBooking.status
                };
                processedBookings.add(linkedBooking._id.toString());
            }
        }

        groupedEvents.push(event);
        processedJobCards.add(jc._id.toString());
    }

    // 2. Process remaining Invoices (Standalone or Rental Invoices)
    for (const inv of invoices) {
        if (processedInvoices.has(inv._id.toString())) continue;
        
        let invTotal = (inv.partsAndLabour || []).reduce((sum, item) => sum + (item.qty * item.price), 0);
        
        let event = {
            id: inv._id.toString(),
            type: 'Invoice',
            title: inv.type || 'Invoice',
            status: inv.status,
            date: inv.createdAt,
            vehicle: inv.vehicleId || inv.trackerCarId,
            customer: inv.customerId,
            invoice: {
                id: inv._id,
                invoiceNo: inv.invoiceNo,
                status: inv.status,
                totalAmount: isMechanic ? undefined : invTotal
            },
            rental: null
        };

        // Find linked rental
        if (inv.rentalId) {
            const linkedRental = rentals.find(r => r._id.toString() === inv.rentalId.toString());
            if (linkedRental) {
                event.type = 'Rental';
                event.title = 'Rental Service';
                event.rental = {
                    id: linkedRental._id,
                    status: linkedRental.status
                };
                processedRentals.add(linkedRental._id.toString());
                // Optionally find other invoices for this same rental and group them
                const otherRentalInvoices = invoices.filter(otherInv => 
                    otherInv.rentalId?.toString() === linkedRental._id.toString() && 
                    otherInv._id.toString() !== inv._id.toString()
                );
                event.invoices = [event.invoice];
                delete event.invoice; // Replace single invoice object with invoices array
                
                for (const other of otherRentalInvoices) {
                    let otherTotal = (other.partsAndLabour || []).reduce((sum, item) => sum + (item.qty * item.price), 0);
                    event.invoices.push({
                        id: other._id,
                        invoiceNo: other.invoiceNo,
                        status: other.status,
                        totalAmount: isMechanic ? undefined : otherTotal
                    });
                    processedInvoices.add(other._id.toString());
                }
            }
        }

        groupedEvents.push(event);
    }

    // 3. Process remaining Rentals
    for (const r of rentals) {
        if (processedRentals.has(r._id.toString())) continue;
        
        let rTotal = 0;
        
        const isRentalVehicle = r.serviceEntryId !== undefined;
        
        const customer = isRentalVehicle ? r.serviceEntryId?.customerId : r.customerId;
        const status = r.status || (isRentalVehicle ? 'Received' : 'Active');
        const rentalId = isRentalVehicle ? r.serviceEntryId?._id : r._id;
        const date = isRentalVehicle ? (r.statusUpdatedAt || r.createdAt) : r.createdAt;
        const completionOdometer = isRentalVehicle ? r.completionOdometer : undefined;
        const vehicle = isRentalVehicle ? r.vehicleId : r.vehicleId; // r.vehicleId is populated in both

        groupedEvents.push({
            id: r._id.toString(),
            type: 'Rental',
            title: 'Rental Service Entry',
            status: status,
            date: date,
            vehicle: vehicle,
            customer: customer,
            rental: {
                id: rentalId,
                status: status,
                totalAmount: isMechanic ? undefined : rTotal,
                completionOdometer
            }
        });
    }

    // 4. Process remaining Bookings
    for (const b of bookings) {
        if (processedBookings.has(b._id.toString())) continue;
        groupedEvents.push({
            id: b._id.toString(),
            type: 'Booking',
            title: b.services && b.services.length > 0 ? b.services.join(', ') : 'Booking',
            status: b.status,
            date: b.createdAt,
            vehicle: b.vehicleId,
            customer: b.customerId,
            booking: {
                id: b._id,
                status: b.status
            }
        });
    }

    // 5. Process Quotes
    for (const q of quotes) {
        groupedEvents.push({
            id: q._id.toString(),
            type: 'Quote',
            title: q.services && q.services.length > 0 ? q.services.join(', ') : 'Quote',
            status: q.status,
            date: q.createdAt,
            vehicle: q.vehicleId,
            customer: q.customerId,
            quote: {
                id: q._id,
                status: q.status
            }
        });
    }



    // Sort by date descending
    groupedEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate metrics before pagination
    const totalVisits = groupedEvents.filter(e => ['Service', 'Invoice'].includes(e.type)).length;
    const lastServiceEvent = groupedEvents.find(e => e.type === 'Service' && e.status === 'Completed');
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEvents = groupedEvents.slice(startIndex, endIndex);

    return {
        events: paginatedEvents,
        metrics: {
            totalVisits,
            lastService: lastServiceEvent ? lastServiceEvent.date : null,
            totalEvents: groupedEvents.length
        },
        pagination: {
            total: groupedEvents.length,
            page: parseInt(page),
            pages: Math.ceil(groupedEvents.length / limit)
        }
    };
};
