import { providers } from 'ethers';
import { exit } from 'process';
import InsertAggregator, {
  InsertAggregatorInterface,
} from '../repositories/mongo/insertAggregator';
import { configByChainId } from '../config/constants';
import MongoDB, { MongoDBInterface } from '../repositories/mongo/connection';
import { TransferIndexer } from './Transfers';

class Indexer {
  readonly mongodb: MongoDBInterface;
  readonly providersByChainId: Record<number, providers.Provider>;

  constructor() {
    this.mongodb = MongoDB;
    this.providersByChainId = {};

    Object.keys(configByChainId).forEach((chainId) => {
      const rpcUrls = process.env[`RPCS_${Number(chainId)}`];
      // const rpcProviders: providers.Provider[] = rpcUrls
      //   .split(',')
      //   .map((rpc: string) => new providers.JsonRpcProvider(rpc));
      this.providersByChainId[chainId] = new providers.StaticJsonRpcProvider(
        rpcUrls,
      );
      // new providers.FallbackProvider(
      //   rpcProviders,
      // );
    });
  }

  public startIndexers = async () => {
    await this.mongodb.connect();
    const insertAggregator = new InsertAggregator();
    await this.startTransferIndexers(insertAggregator);
    await this.startInsertAggregator(insertAggregator);
  };

  public startTransferIndexers = async (
    insertAggregator: InsertAggregatorInterface,
  ) => {
    const indexingPromises = [];

    Object.keys(this.providersByChainId).forEach((chainId) => {
      const { poolAddressProviders, uiPoolDataProvider } =
        configByChainId[Number(chainId)];
      const provider = this.providersByChainId[Number(chainId)];
      poolAddressProviders.forEach((poolAddressProvider) => {
        const transferIndexer = new TransferIndexer({
          poolAddressProvider,
          uiPoolDataProvider,
          provider,
          insertAggregator,
        });
        indexingPromises.push(transferIndexer.startIndexing());
      });
    });

    await Promise.allSettled(indexingPromises);
  };

  public startInsertAggregator = async (
    insertAggregator: InsertAggregatorInterface,
  ): Promise<void> => {
    await insertAggregator.initializeWatcher();
  };
}

const indexer = new Indexer();
indexer
  .startIndexers()
  .then(() => {
    console.log('indexers finished');
    exit(0);
  })
  .catch((error) => {
    console.log(error);
    exit(1);
  });
