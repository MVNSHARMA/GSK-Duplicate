import re

with open('src/controllers/vehicleBatchController.js', 'r') as f:
    content = f.read()

query_old = """        if (make !== undefined && model !== undefined) {
            let vehicleIds = [];
            if (make !== "" || model !== "") {
                const vQuery = {};
                if (make) vQuery.brand = make;
                if (model) vQuery.model = model;
                const vs = await Vehicle.find(vQuery).select('_id');
                vehicleIds = vs.map(v => v._id);
            }

            const typeOr = [];
            
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

query_new = """        if (make !== undefined && model !== undefined) {
            let vehicleIds = [];
            if (make !== "" || model !== "") {
                const vQuery = {};
                vQuery.brand = make === "" ? { $in: [null, ""] } : make;
                vQuery.model = model === "" ? { $in: [null, ""] } : model;
                const vs = await Vehicle.find(vQuery).select('_id');
                vehicleIds = vs.map(v => v._id);
            }

            const typeOr = [];
            
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
                const makeMatch = make === "" ? { $in: [null, ""] } : make;
                const modelMatch = model === "" ? { $in: [null, ""] } : model;
                typeOr.push({ make: makeMatch, model: modelMatch });
                
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

print("Controller car types patched.")
