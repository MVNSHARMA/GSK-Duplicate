import connectDB from './src/config/db.js';
import JobCard from './src/models/JobCard.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    await connectDB();
    
    const verifiedTestAffectedIds = [
      '6a903e1d4a915734d820ca3e',
      '6a903e1d4a915734d820ca3f',
      '6a903e1d4a915734d820ca3d',
      '6a9a5fd386ae6ea70cce0b9f',
      '6a9abd65472a1b2ddc7cafda',
      '6a9ac36c94615a4caa353a6d',
      '6a9ad12a94615a4caa353b47',
      '6a9ad35894615a4caa353cff',
      '6a9c4e18a8852c70c89958c1',
      '6a9d37a387af9cfebc9aaf89',
      '6a9d53b4dbfe8812695d2c3a',
      '6a9d53f370ab48fed5f9d534',
      '6a9d5503511faf26f4d9693a',
      '6a9d5508511faf26f4d9693d',
      '6aabda281b6445e401107e5c',
      '6aaccdcbdff05ff1637f35d5',
      '6aacf035fbf4e408e75641d7'
    ];
    
    const result = await JobCard.updateMany(
        { _id: { $in: verifiedTestAffectedIds } },
        { $set: { isActive: true } }
    );
    
    console.log(`Restored ${result.modifiedCount} Job Cards successfully.`);
    
    // Verification
    const total = await JobCard.countDocuments();
    const active = await JobCard.countDocuments({ isActive: true });
    const inactive = await JobCard.countDocuments({ isActive: false });
    
    console.log(`Total: ${total}, Active: ${active}, Inactive: ${inactive}`);
    process.exit(0);
};

run();
