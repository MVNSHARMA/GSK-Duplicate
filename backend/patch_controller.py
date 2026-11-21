import re

with open('src/controllers/vehicleBatchController.js', 'r') as f:
    content = f.read()

# 1. Fix the aggregation to properly handle empty strings
agg_old = """                $addFields: {
                    resolvedMake: { $cond: [{ $ifNull: ["$make", false] }, "$make", { $arrayElemAt: ["$vehicleDocs.brand", 0] }] },
                    resolvedModel: { $cond: [{ $ifNull: ["$model", false] }, "$model", { $arrayElemAt: ["$vehicleDocs.model", 0] }] }
                }"""

agg_new = """                $addFields: {
                    resolvedMake: {
                        $cond: [
                            { $and: [{ $ne: ["$make", null] }, { $ne: ["$make", ""] }] },
                            "$make",
                            { $arrayElemAt: ["$vehicleDocs.brand", 0] }
                        ]
                    },
                    resolvedModel: {
                        $cond: [
                            { $and: [{ $ne: ["$model", null] }, { $ne: ["$model", ""] }] },
                            "$model",
                            { $arrayElemAt: ["$vehicleDocs.model", 0] }
                        ]
                    }
                }"""
content = content.replace(agg_old, agg_new)

# 2. Fix the query construction for make/model
query_old = """            const makeCond = make === "" ? { $in: [null, ""] } : make;
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
            }"""

query_new = """            const typeOr = [];
            
            if (make === "" && model === "") {
                // Unknown Type: Must have empty native AND no valid vehicleId
                typeOr.push({
                    make: { $in: [null, ""] },
                    model: { $in: [null, ""] },
                    vehicleId: { $in: [null, undefined] }
                });
            } else {
                // Specific Type: 
                // Match native fields OR match vehicle fields if native are empty
                typeOr.push({ make: make, model: model });
                
                if (vehicleIds.length > 0) {
                    typeOr.push({
                        make: { $in: [null, ""] },
                        model: { $in: [null, ""] },
                        vehicleId: { $in: vehicleIds }
                    });
                }
            }"""
content = content.replace(query_old, query_new)

with open('src/controllers/vehicleBatchController.js', 'w') as f:
    f.write(content)

print("Controller patched.")
