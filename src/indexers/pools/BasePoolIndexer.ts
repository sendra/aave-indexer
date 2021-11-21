import { providers } from 'ethers';
// import { IERC20, IERC20__factory } from '../../contracts';

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
    // { poolAddress, startingBlock }: Config
    // this.poolAddress = poolAddress;
    // this.startingBlock = startingBlock ?? 0;

    const rpcUrls = process.env.RPC_URLS ?? '';

    const rpcProviders: providers.Provider[] = rpcUrls
      .split(',')
      .map((rpc: string) => new providers.JsonRpcProvider(rpc));
    this.provider = new providers.FallbackProvider(rpcProviders);
  }

  // public getVariableDebtTransfers = async (
  //   startingBlock?: number,
  // ): Promise<void> => {
  // const rawLogs = await this.provider.getPastLogs({
  //   fromBlock,
  //   toBlock,
  //   topics: topics.map((t) => utils.id(t)),
  //   address: reservesList,
  // });
  // const users: string[] = [];
  // rawLogs.forEach((data) => {
  //   const logs = alchemyWeb3Provider.eth.abi.decodeLog(
  //     [
  //       {
  //         type: 'address',
  //         name: 'from',
  //         indexed: true,
  //       },
  //       {
  //         type: 'address',
  //         name: 'to',
  //         indexed: true,
  //       },
  //     ],
  //     '',
  //     [data.topics[1], data.topics[2]]
  //   );
  // };
}
