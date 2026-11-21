import fs from 'fs';
import path from 'path';

const controllerPath = path.resolve('src/controllers/vehicleBatchController.js');
let code = fs.readFileSync(controllerPath, 'utf8');

const newFunc = `export const getBatchVehicles = async (req, res) => {
    try {
        const { page = 1, limit = 50, search, status, complianceStatus, make, model } = req.query;
        const batchId = req.params.id;

        const batch = await mongoose.model('VehicleBatch').findById(batchId);
        if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' });

        // RBAC isolation
        if (req.user.role === 'user' && (!req.user.customerId || batch.customerId.toString() !== req.user.customerId.toString())) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const baseFilter = { batchId: batch._id, isActive: true };
        const filter = { ...baseFilter };

        // --- FILTER METADATA AGGREGATION ---
        const metadataAgg = await mongoose.model('VehicleBatchMembership').aggregate([
            { $match: baseFilter },
            {
                $lookup: {
                    from: "vehicles",
                    localField: "vehicleId",
                    foreignField: "_id",
                    as: "vehicleDocs"
                }
            },
            {
                $addFields: {
                    resolvedMake: { $cond: [{ $ifNull: ["$make", false] }, "$make", { $arrayElemAt: ["$vehicleDocs.brand", 0] }] },
                    resolvedModel: { $cond: [{ $ifNull: ["$model", false] }, "$model", { $arrayElemAt: ["$vehicleDocs.model", 0] }] }
                }
            },
            {
                $group: {
                    _id: null,
                    statuses: { $addToSet: "$status" },
                    complianceStatuses: { $addToSet: "$complianceStatus" },
                    carTypes: {
                        $addToSet: {
                            make: { $ifNull: ["$resolvedMake", ""] },
                            model: { $ifNull: ["$resolvedModel", ""] }
                        }
                    }
                }
            }
        ]);

        const uniqueCarTypesMap = new Map();
        if (metadataAgg.length > 0) {
            metadataAgg[0].carTypes.forEach(t => {
                const makeStr = typeof t.make === 'string' ? t.make.trim() : "";
                const modelStr = typeof t.model === 'string' ? t.model.trim() : "";
                let label = \`\${makeStr} \${modelStr}\`.trim();
                if (!label) label = "Unknown Type";
                if (!uniqueCarTypesMap.has(label)) {
                    uniqueCarTypesMap.set(label, { label, make: t.make, model: t.model });
                }
            });
        }
        
        const filterMetadata = {
            statuses: metadataAgg.length > 0 ? metadataAgg[0].statuses.filter(Boolean).sort() : [],
            complianceStatuses: metadataAgg.length > 0 ? metadataAgg[0].complianceStatuses.filter(Boolean).sort() : [],
            carTypes: Array.from(uniqueCarTypesMap.values()).sort((a, b) => a.label.localeCompare(b.label))
        };
        // -----------------------------------

        if (status) filter.status = status;
        if (complianceStatus) filter.complianceStatus = complianceStatus;

        if (make !== undefined && model !== undefined) {
            let vehicleIds = [];
            if (make !== "" || model !== "") {
                const vQuery = {};
                if (make) vQuery.brand = make;
                if (model) vQuery.model = model;
                const vs = await mongoose.model('Vehicle').find(vQuery).select('_id');
                vehicleIds = vs.map(v => v._id);
            }

            const makeCond = make === "" ? { $in: [null, ""] } : make;
            const modelCond = model === "" ? { $in: [null, ""] } : model;

            const typeOr = [];
            
            // Match native fields
            typeOr.push({ make: makeCond, model: modelCond });
            
            // Match vehicle fields if any found (and native fields are empty)
            if (vehicleIds.length > 0) {
                typeOr.push({
                    make: { $in: [null, ""] },
                    model: { $in: [null, ""] },
                    vehicleId: { $in: vehicleIds }
                });
            } else if (make === "" && model === "") {
                // Unknown Type: Must have empty native AND no valid vehicleId
                typeOr.push({
                    make: { $in: [null, ""] },
                    model: { $in: [null, ""] },
                    vehicleId: { $in: [null, undefined] }
                });
            }

            filter.$and = filter.$and || [];
            filter.$and.push({ $or: typeOr });
        }

        const escapeRegex = (string) => string.replace(/[.*+?^\\$\\{\\}()|[\\]\\\\]/g, '\\\\$&');

        if (search) {
            const searchRegex = new RegExp(escapeRegex(search), 'i');
            
            // Lookup vehicles for search
            const matchingVehicles = await mongoose.model('Vehicle').find({
                $or: [
                    { registrationNumber: searchRegex },
                    { vin: searchRegex },
                    { brand: searchRegex },
                    { model: searchRegex }
                ]
            }).select('_id');
            const searchVehicleIds = matchingVehicles.map(v => v._id);

            const searchOr = [
                { registrationNumber: searchRegex },
                { vin: searchRegex },
                { make: searchRegex },
                { model: searchRegex },
                { referenceNumber: searchRegex }
            ];

            if (searchVehicleIds.length > 0) {
                searchOr.push({ vehicleId: { $in: searchVehicleIds } });
            }

            filter.$and = filter.$and || [];
            filter.$and.push({ $or: searchOr });
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const total = await mongoose.model('VehicleBatchMembership').countDocuments(filter);
        
        const cars = await mongoose.model('VehicleBatchMembership').find(filter)
            .populate('vehicleId', 'registrationNumber brand model vin status')
            .populate('jobCardId', 'jobCardNumber status')
            .sort({ addedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        res.status(200).json({
            success: true,
            data: cars,
            filters: filterMetadata,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error("Error fetching batch vehicles:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};`;

const regex = /export const getBatchVehicles = async \(req, res\) => \{[\s\S]*?\n\};\n\n\/\//;
if (regex.test(code)) {
    code = code.replace(regex, newFunc + '\n\n//');
    fs.writeFileSync(controllerPath, code);
    console.log("Successfully replaced getBatchVehicles");
} else {
    // try matching without the trailing comment if it's at EOF
    const fallbackRegex = /export const getBatchVehicles = async \(req, res\) => \{[\s\S]*?\n\};/;
    if (fallbackRegex.test(code)) {
        // we'll just replace the function exactly
        const startIndex = code.indexOf("export const getBatchVehicles = async (req, res) => {");
        const nextFuncIndex = code.indexOf("\nexport const addVehicleToBatch", startIndex);
        
        if (startIndex !== -1 && nextFuncIndex !== -1) {
            code = code.slice(0, startIndex) + newFunc + code.slice(nextFuncIndex);
            fs.writeFileSync(controllerPath, code);
            console.log("Successfully replaced getBatchVehicles via fallback");
        } else {
            console.log("Failed to find exact bounds");
        }
    } else {
        console.log("Failed to match getBatchVehicles");
    }
}
