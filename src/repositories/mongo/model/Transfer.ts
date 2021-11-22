import { ObjectId } from 'mongodb';
import { BigNumber } from 'ethers';
import mongoose from 'mongoose';
import BaseDomain, { BaseDomainInterface } from '../domain/BaseDomain';

export type TransactionArgs = {
  from: string;
  to: string;
  value: BigNumber;
};

export type TransferModel = {
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
  extends TransferModel,
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
    value: { type: BigNumber },
  },
});

const transferModel: mongoose.Model<TransferModelInterface> =
  mongoose.model<TransferModelInterface>('rate', transferSchema);
export default transferModel;

export type TransferDomainInterface = BaseDomainInterface<
  TransferModel,
  TransferModelInterface
>;

export const transferDomain: TransferDomainInterface = new BaseDomain<
  TransferModel,
  TransferModelInterface
>(transferModel);
