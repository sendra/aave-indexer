import { providers } from 'ethers';
import { exit } from 'process';
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
      const rpcProviders: providers.Provider[] = rpcUrls
        .split(',')
        .map((rpc: string) => new providers.JsonRpcProvider(rpc));
      this.providersByChainId[chainId] = new providers.FallbackProvider(
        rpcProviders,
      );
    });
  }

  public startIndexers = async () => {
    await this.mongodb.connect();
    await this.startTransferIndexers();
  };

  public startTransferIndexers = async () => {
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
        });
        indexingPromises.push(transferIndexer.startIndexing());
      });
    });

    await Promise.allSettled(indexingPromises);
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
