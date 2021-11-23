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
    });
    return blockedAddress;
  }

  public async updateTransfersInBulk(
    transferLogs: TransferType[],
  ): Promise<void> {
    const bulk = transferLogs.map(
      ({
        address,
        blockNumber,
        blockHash,
        transactionIndex,
        transactionHash,
        logIndex,
        args,
      }) => ({
        updateOne: {
          filter: {
            address: address.toLowerCase(),
            blockNumber,
            blockHash,
            transactionIndex,
            transactionHash,
            logIndex,
          },
          update: {
            $set: {
              args: {
                value: args.value.toString(),
              },
            },
          },
          upsert: true,
        },
      }),
    );

    await this.DataModel.collection.bulkWrite(bulk);
  }
}

const transferDomain = new TransferDomain(transferModel);
export default transferDomain;
