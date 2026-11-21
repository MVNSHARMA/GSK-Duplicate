import mongoose from 'mongoose';

const sequenceSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Number, required: true, default: 0 }
});

export default mongoose.model('Sequence', sequenceSchema);
