import {
  UiPoolDataProvider,
  UiPoolDataProviderInterface,
  ReservesDataHumanized,
  ReserveDataHumanized,
} from '@aave/contract-helpers';
import { providers, utils } from 'ethers';
import transferDomain from '../repositories/mongo/domain/Transfer';
import { TransferType } from '../repositories/mongo/model/Transfer';
import { IERC20, IERC20__factory } from '../contracts';
// import BasePoolIndexer from './BasePoolIndexer';

export type TransferIndexingConfig = {
  poolAddressProvider: string;
  uiPoolDataProvider: string;
  provider: providers.Provider;
};

export class TransferIndexer {
  readonly provider: providers.Provider;
  readonly poolAddressProviderAddress: string;
  readonly uiPoolDataProviderAddress: string;
  readonly uiPoolDataProvider: UiPoolDataProviderInterface;
  readonly aTokens: IERC20[];
  readonly sTokens: IERC20[];
  readonly vTokens: IERC20[];

  constructor({
    poolAddressProvider,
    uiPoolDataProvider,
    provider,
  }: TransferIndexingConfig) {
    this.provider = provider;
    this.poolAddressProviderAddress = poolAddressProvider;
    this.uiPoolDataProviderAddress = uiPoolDataProvider;

    this.uiPoolDataProvider = new UiPoolDataProvider({
      uiPoolDataProviderAddress: this.uiPoolDataProviderAddress,
      provider: this.provider,
    });

    this.aTokens = [];
    this.sTokens = [];
    this.vTokens = [];
  }

  public startIndexing = async () => {
    // get reserves to get subtoken addresses

    const reserves: ReservesDataHumanized =
      await this.uiPoolDataProvider.getReservesHumanized(
        this.poolAddressProviderAddress,
      );

    reserves.reservesData.forEach((reserve: ReserveDataHumanized) => {
      const aTokenContract = IERC20__factory.connect(
        reserve.aTokenAddress,
        this.provider,
      );
      const sTokenContract = IERC20__factory.connect(
        reserve.stableDebtTokenAddress,
        this.provider,
      );
      const vTokenContract = IERC20__factory.connect(
        reserve.variableDebtTokenAddress,
        this.provider,
      );

      this.aTokens.push(aTokenContract);
      this.sTokens.push(sTokenContract);
      this.vTokens.push(vTokenContract);
    });

    // start method to listen to users that are using amm
    const aPromises = this.aTokens.map((contract: IERC20) =>
      this.transferEventGetterJob(contract),
    );
    const sPromises = this.sTokens.map((contract: IERC20) =>
      this.transferEventGetterJob(contract),
    );
    const vPromises = this.vTokens.map((contract: IERC20) =>
      this.transferEventGetterJob(contract),
    );

    await Promise.allSettled([...aPromises, ...sPromises, ...vPromises]);
  };

  // get the transfer logs without sending toBlock
  public transferEventGetterJob = async (
    contract: IERC20,
    count = 0,
    logsCount = 0,
  ): Promise<void> => {
    try {
      // get last block number from db
      const lastTokenTransfer = await transferDomain.getRecordByAddress(
        contract.address,
      );

      let fromBlock = 0;
      if (lastTokenTransfer) {
        // TODO: do we repeat lastBlockNumber to make sure we dont forget anything? or increase by one?
        fromBlock = lastTokenTransfer.blockNumber;
      }
      // console.log('from block: ', fromBlock);
      // const event = contract.filters.Transfer();
      const topicId = utils.id('Transfer(address,address,uint256)');
      // const eventLogs = await contract.queryFilter(event, fromBlock);
      let eventLogs: TransferType[] = [];
      try {
        eventLogs = (await this.provider.getLogs({
          fromBlock,
          toBlock: 21748922,
          address: contract.address,
          topics: [topicId],
        })) as TransferType[];
      } catch (error) {
        console.log(contract.address, ' error code: ', error.error?.code);
      }
      // console.log('events length: ', eventLogs.length);

      // save on db
      if (eventLogs.length > 0) {
        await transferDomain.insertRawTransferLogsInBulk([eventLogs[0]]);
      }

      // check if max log amount reached
      if (eventLogs.length < 9999) {
        console.log(
          contract.address.toLowerCase(),
          ': eventLogs Count: ',
          eventLogs.length + logsCount,
          ' count: ',
          count,
        );
        return;
      }

      return this.transferEventGetterJob(
        contract,
        count + 1,
        logsCount + eventLogs.length,
      );
    } catch (error) {
      console.log(contract.address, ' other error');
    }
  };

  public transferEventGetterWithToBlockJob = async (
    contract: IERC20,
    count = 0,
    logsCount = 0,
  ): Promise<void> => {
    // get last block number from db
    const lastTokenTransfer = await transferDomain.getRecordByAddress(
      contract.address,
    );

    let fromBlock = 0;
    if (lastTokenTransfer) {
      // TODO: do we repeat lastBlockNumber to make sure we dont forget anything? or increase by one?
      fromBlock = lastTokenTransfer.blockNumber;
    }

    const event = contract.filters.Transfer();
    const toBlock = fromBlock + 1000;
    const eventLogs = await contract.queryFilter(event, fromBlock, toBlock);

    // save on db
    await transferDomain.insertRawTransferLogsInBulk(eventLogs);
    // console.log('events length: ', eventLogs.length);
    // check if max log amount reached
    const currentBlock = await this.provider.getBlockNumber();
    if (currentBlock < toBlock) {
      console.log(
        contract.address.toLowerCase(),
        ': eventLogs Count: ',
        eventLogs.length + logsCount,
        ' count: ',
        count,
      );
      return;
    }

    return this.transferEventGetterWithToBlockJob(
      contract,
      count + 1,
      logsCount + eventLogs.length,
    );
  };
}
