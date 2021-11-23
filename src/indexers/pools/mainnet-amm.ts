import {
  UiPoolDataProvider,
  UiPoolDataProviderInterface,
  ReservesDataHumanized,
  ReserveDataHumanized,
} from '@aave/contract-helpers';
import { IERC20, IERC20__factory } from '../../contracts';
import BasePoolIndexer from './BasePoolIndexer';

export class AmmPool extends BasePoolIndexer {
  readonly poolAddressProvider: string;
  readonly uiPoolDataProviderAddress: string;
  readonly uiPoolDataProvider: UiPoolDataProviderInterface;
  readonly aTokens: IERC20[];
  readonly sTokens: IERC20[];
  readonly vTokens: IERC20[];

  constructor() {
    super();
    this.poolAddressProvider = process.env.POOL_ADDRESS_PROVIDER ?? '';
    this.uiPoolDataProviderAddress = process.env.UI_POOL_DATA_PROVIDER ?? '';

    this.uiPoolDataProvider = new UiPoolDataProvider({
      uiPoolDataProviderAddress: this.uiPoolDataProviderAddress,
      provider: this.provider,
    });

    this.aTokens = [];
    this.sTokens = [];
    this.vTokens = [];
  }

  public startJobs = async () => {
    // get reserves to get subtoken addresses
    const reserves: ReservesDataHumanized =
      await this.uiPoolDataProvider.getReservesHumanized(
        this.poolAddressProvider,
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
    // const sPromises = this.sTokens.map(this.transferEventGetterJob);
    // const vPromises = this.vTokens.map(this.transferEventGetterJob);

    const test = await Promise.allSettled([
      ...aPromises,
      // ...sPromises, ...vPromises
    ]);
    console.log('test');
  };
}

const amm = new AmmPool();
amm
  .startJobs()
  .then(() => {
    console.log('====================');
    process.exit(0);
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
