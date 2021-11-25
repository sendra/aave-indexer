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
import { InsertAggregatorInterface } from '../repositories/mongo/insertAggregator';

export type TransferIndexingConfig = {
  poolAddressProvider: string;
  uiPoolDataProvider: string;
  provider: providers.Provider;
  insertAggregator: InsertAggregatorInterface;
};

export class TransferIndexer {
  readonly provider: providers.Provider;
  readonly poolAddressProviderAddress: string;
  readonly uiPoolDataProviderAddress: string;
  readonly uiPoolDataProvider: UiPoolDataProviderInterface;
  readonly insertAggregator: InsertAggregatorInterface;
  readonly aTokens: IERC20[];
  readonly sTokens: IERC20[];
  readonly vTokens: IERC20[];

  constructor({
    poolAddressProvider,
    uiPoolDataProvider,
    provider,
    insertAggregator,
  }: TransferIndexingConfig) {
    this.provider = provider;
    this.poolAddressProviderAddress = poolAddressProvider;
    this.uiPoolDataProviderAddress = uiPoolDataProvider;
    this.insertAggregator = insertAggregator;

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

    // const currentBlockNumber = await this.provider.getBlockNumber();

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
    // blockOffset = 10000000,
    fromBlock = 0,
    toBlock = undefined,
    iteration = 0,
    logsCount = 0,
  ): Promise<void> => {
    try {
      // get last block number from db

      if (fromBlock === 0) {
        const lastTokenTransfer = await transferDomain.getRecordByAddress(
          contract.address,
        );
        if (lastTokenTransfer) {
          fromBlock = lastTokenTransfer.blockNumber;
        }
      }

      // const currentBlockNumber = await this.provider.getBlockNumber();

      // const toBlock =
      //   fromBlock + blockOffset > currentBlockNumber
      //     ? currentBlockNumber
      //     : fromBlock + Math.max(blockOffset, 1999);

      const event = contract.filters.Transfer();

      let eventLogs: TransferType[] = [];
      const timestamp = Date.now();
      try {
        console.time(`${contract.address}+${timestamp}`);
        eventLogs = (await contract.queryFilter(
          event,
          toBlock === undefined ? fromBlock + 1 : fromBlock,
          toBlock,
        )) as TransferType[];
        console.timeEnd(`${contract.address}+${timestamp}`);
      } catch (error) {
        console.timeEnd(`${contract.address}+${timestamp}`);

        const { 0: newFromBlock, 1: newToBlock } = error.error.message
          .split('[')[1]
          .split(']')[0]
          .split(', ');

        console.log(
          contract.address,
          ' Error code: ',
          error.error?.code,
          ' fromBloc: ',
          Number(newFromBlock),
          ' toBlock: ',
          Number(newToBlock),
        );

        return this.transferEventGetterJob(
          contract,
          // Math.floor(blockOffset / 2),
          Number(newFromBlock),
          Number(newToBlock),
          iteration + 1,
          logsCount + eventLogs.length,
        );
      }

      console.log(
        contract.address,
        ' iteration: ',
        iteration,
        'from: ',
        fromBlock,
        ' to: ',
        toBlock,
        ' offset: ',
        toBlock - fromBlock,
        ' documents: ',
        eventLogs.length,
      );

      this.insertAggregator.queueLogs(eventLogs);

      if (eventLogs.length < 9999 && toBlock === undefined) {
        // We trigger insert so as to not have to wait until we reach
        // max batch size when a reserve indexing is done
        await this.insertAggregator.triggerInsert();

        console.log(
          contract.address.toLowerCase(),
          ': eventLogs Count: ',
          eventLogs.length + logsCount,
          ' iteration: ',
          iteration,
        );
        return;
      }

      return this.transferEventGetterJob(
        contract,
        // blockOffset, // iteration % 10 === 0 ? blockOffset * 2 : blockOffset,
        toBlock,
        undefined, // we send undefined when success to get a fail with new recomended blocks
        iteration + 1,
        logsCount + eventLogs.length,
      );
    } catch (error) {
      console.log(contract.address, ' other error: ', error);
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
