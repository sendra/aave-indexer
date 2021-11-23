import { providers } from 'ethers';
import transferDomain from '../../repositories/mongo/domain/Transfer';
import { IERC20 } from '../../contracts';
import MongoDB from '../../repositories/mongo/connection';
import { TransferType } from '../../repositories/mongo/model/Transfer';

export type Config = {
  poolAddress: string;
  startingBlock: number;
};

export interface BasePoolIndexerInterface {
  // getVariableDebtTransfers: (startingBlock?: number) => Promise<void>;
}

export default class BasePoolIndexer implements BasePoolIndexerInterface {
  readonly poolAddress: string;
  readonly startingBlock: number;
  readonly provider: providers.Provider;

  constructor() {
    const rpcUrls = process.env.RPC_URLS ?? '';

    const rpcProviders: providers.Provider[] = rpcUrls
      .split(',')
      .map((rpc: string) => new providers.JsonRpcProvider(rpc));
    this.provider = new providers.FallbackProvider(rpcProviders);
  }

  public transferEventGetterJob = async (contract: IERC20): Promise<void> => {
    // get last block number from db
    await MongoDB.connect();
    const lastTokenTransfer = await transferDomain.getRecordByAddress(
      contract.address,
    );
    let fromBlock = 0;
    if (lastTokenTransfer) {
      // TODO: do we repeat lastBlockNumber to make sure we dont forget anything? or increase by one?
      fromBlock = lastTokenTransfer.blockNumber;
    }
    console.log(contract.address.toLowerCase(), ' last block:: ', fromBlock);
    const event = contract.filters.Transfer();

    const eventLogs: TransferType[] = await contract.queryFilter(
      event,
      fromBlock,
      'latest',
    );
    console.log('eventLogs length: ', eventLogs.length);

    // save on db
    await transferDomain.updateTransfersInBulk(eventLogs);

    // check if max log amount reached
    if (eventLogs.length < 10000) {
      return;
    }

    return this.transferEventGetterJob(contract);
  };
}
