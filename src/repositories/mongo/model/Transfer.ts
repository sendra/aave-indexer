import { BigNumber } from 'ethers';
import mongoose from 'mongoose';

export type TransactionArgs = {
  from: string;
  to: string;
  value: string;
};

export type TransferType = {
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  address: string;
  removed: boolean;
  data: string;
  topics: string[];
  transactionHash: string;
  logIndex: number;
  event: string;
  eventSignature: string;
  args: TransactionArgs;
};

export interface TransferModelInterface
  extends TransferType,
    mongoose.Document {}

const transferSchema = new mongoose.Schema({
  blockNumber: { type: Number },
  blockHash: { type: String },
  transactionIndex: { type: Number },
  address: { type: String },
  removed: { type: Boolean },
  data: { type: String },
  topics: [{ type: String }],
  transactionHash: { type: String },
  logIndex: { type: Number },
  event: { type: String },
  eventSignature: { type: String },
  args: {
    from: { type: String },
    to: { type: String },
    value: { type: String },
  },
});

const transferModel: mongoose.Model<TransferModelInterface> =
  mongoose.model<TransferModelInterface>('Transfer', transferSchema);
export default transferModel;
