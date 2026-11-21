import mongoose from 'mongoose';

/**
 * Executes a callback within a MongoDB transaction if the topology supports it (ReplicaSet).
 * If running in a standalone topology (like default local development), executes the callback without a transaction.
 * 
 * @param {Function} callback - Function containing the database operations. Must accept `session` as an argument.
 * @returns {Promise<any>}
 */
export const withTransaction = async (callback) => {
    // Check if the current connection supports transactions
    const client = mongoose.connection.getClient();
    let isReplicaSet = false;
    
    if (client && client.topology) {
        const type = client.topology.description ? client.topology.description.type : client.topology.s?.description?.type;
        isReplicaSet = type === 'ReplicaSetWithPrimary' || type === 'ReplicaSetNoPrimary' || type === 'Sharded';
    }

    if (isReplicaSet) {
        const session = await mongoose.startSession();
        try {
            return await session.withTransaction(async () => {
                return await callback(session);
            });
        } finally {
            session.endSession();
        }
    } else {
        // Fallback for standalone topology (local dev without replica set)
        console.warn('MongoDB Topology does not support transactions. Executing operations WITHOUT transaction guarantees.');
        return await callback(null);
    }
};
