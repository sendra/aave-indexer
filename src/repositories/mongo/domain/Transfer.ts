import { utils } from 'ethers';
import mongoose from 'mongoose';
import transferModel, {
  TransferType,
  TransferModelInterface,
} from '../model/Transfer';
import BaseDomain, { BaseDomainInterface } from './BaseDomain';

export interface TransferDomainInterface
  extends BaseDomainInterface<TransferType, TransferModelInterface> {
  getRecordByAddress: (address: string) => Promise<TransferType>;
  updateTransfersInBulk: (transferLogs: TransferType[]) => Promise<void>;
  insertRawTransferLogsInBulk: (transferLogs: TransferType[]) => Promise<void>;
}

class TransferDomain
  extends BaseDomain<TransferType, TransferModelInterface>
  implements TransferDomainInterface
{
  public async getRecordByAddress(address: string): Promise<TransferType> {
    const blockedAddress = await this.DataModel.findOne({
      address: address.toLowerCase(),
    }).sort({ blockNumber: 'desc' });
    return blockedAddress;
  }

  public async updateTransfersInBulk(
    transferLogs: TransferType[],
  ): Promise<void> {
    const bulk = transferLogs.map((transferLog: TransferType) => ({
      updateOne: {
        filter: {
          address: transferLog.address.toLowerCase(),
          blockNumber: transferLog.blockNumber,
          blockHash: transferLog.blockHash,
          transactionIndex: transferLog.transactionIndex,
          transactionHash: transferLog.transactionHash,
          logIndex: transferLog.logIndex,
        },
        update: {
          $set: {
            ...transferLog,
            address: transferLog.address.toLowerCase(),
            args: {
              ...transferLog.args,
              value: transferLog.args.value.toString(),
            },
          },
        },
        upsert: true,
      },
    }));

    await this.DataModel.collection.bulkWrite(bulk);
  }

  public async insertRawTransferLogsInBulk(
    transferLogs: TransferType[],
  ): Promise<void> {
    const bulk = transferLogs.map((transferLog: TransferType) => {
      const decodedValue = utils.defaultAbiCoder.decode(
        ['uint256'],
        transferLog.data,
      );
      const decodedFrom = utils.defaultAbiCoder.decode(
        ['address'],
        transferLog.topics[1],
      );

      const decodedTo = utils.defaultAbiCoder.decode(
        ['address'],
        transferLog.topics[2],
      );
      const id = `${transferLog.blockNumber}_${transferLog.blockHash}_${transferLog.transactionIndex}_${transferLog.transactionHash}_${transferLog.logIndex}`;
      return {
        insertOne: {
          document: {
            id,
            ...transferLog,
            address: transferLog.address.toLowerCase(),
            args: {
              from: decodedFrom[0],
              to: decodedTo[0],
              value: decodedValue.toString(),
            },
          },
        },
      };
    });
    if (bulk.length > 0) {
      await this.DataModel.collection.bulkWrite(bulk, { ordered: false });
    }
  }
}

const transferDomain = new TransferDomain(transferModel);
export default transferDomain;
