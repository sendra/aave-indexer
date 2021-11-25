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
  upsertRawTransferLogsInBulk: (transferLogs: TransferType[]) => Promise<void>;
  insertManyRawTransferLogsInBulk: (
    transferLogs: TransferType[],
  ) => Promise<void>;
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

  public async upsertRawTransferLogsInBulk(
    transferLogs: TransferType[],
  ): Promise<void> {
    const bulk = transferLogs.map((transferLog: TransferType) => {
      const id = `${transferLog.blockNumber}_${transferLog.blockHash}_${transferLog.transactionIndex}_${transferLog.transactionHash}_${transferLog.logIndex}`;
      return {
        updateOne: {
          filter: {
            id,
          },
          update: {
            $set: {
              id,
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
      };
    });

    if (transferLogs.length > 0) {
      await this.DataModel.collection.bulkWrite(bulk, { ordered: false });
    }
  }

  public async insertManyRawTransferLogsInBulk(
    transferLogs: TransferType[],
  ): Promise<void> {
    const logs = transferLogs.map((transferLog: TransferType) => {
      const id = `${transferLog.blockNumber}_${transferLog.blockHash}_${transferLog.transactionIndex}_${transferLog.transactionHash}_${transferLog.logIndex}`;
      return {
        id,
        ...transferLog,
        address: transferLog.address.toLowerCase(),
        args: {
          ...transferLog.args,
          value: transferLog.args.value.toString(),
        },
      };
    });
    if (transferLogs.length > 0) {
      await this.DataModel.collection.insertMany(logs, {
        ordered: false,
      });
    }
  }

  public async insertRawTransferLogsInBulk(
    transferLogs: TransferType[],
  ): Promise<void> {
    const bulk = this.DataModel.collection.initializeUnorderedBulkOp();

    transferLogs.map((transferLog: TransferType) => {
      const id = `${transferLog.blockNumber}_${transferLog.blockHash}_${transferLog.transactionIndex}_${transferLog.transactionHash}_${transferLog.logIndex}`;
      bulk.insert({
        insertOne: {
          document: {
            id,
            ...transferLog,
            address: transferLog.address.toLowerCase(),
            args: {
              ...transferLog.args,
              value: transferLog.args.value.toString(),
            },
          },
        },
      });
    });
    if (transferLogs.length > 0) {
      await bulk.execute({ ordered: false });
    }
  }
}

const transferDomain = new TransferDomain(transferModel);
export default transferDomain;
