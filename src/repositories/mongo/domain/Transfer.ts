import transferModel, {
  TransferType,
  TransferModelInterface,
} from '../model/Transfer';
import BaseDomain, { BaseDomainInterface } from './BaseDomain';

export interface TransferDomainInterface
  extends BaseDomainInterface<TransferType, TransferModelInterface> {
  getRecordByAddress: (address: string) => Promise<TransferType | null>;
  updateTransfersInBulk: (transferLogs: TransferType[]) => Promise<void>;
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
}

const transferDomain = new TransferDomain(transferModel);
export default transferDomain;
