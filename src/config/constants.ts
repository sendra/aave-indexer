export type ConfigByChainIdType = Record<
  number,
  {
    poolAddressProviders: string[];
    uiPoolDataProvider: string;
  }
>;

// Contains the poolAddressproviders (markets) of every network
export const configByChainId: ConfigByChainIdType = {
  // mainnet
  1: {
    poolAddressProviders: [
      '0xacc030ef66f9dfeae9cbb0cd1b25654b82cfa8d5',
      '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
    ],
    uiPoolDataProvider: '0x47e300dDd1d25447482E2F7e5a5a967EA2DA8634',
  },
  // polygon
  137: {
    poolAddressProviders: ['0xd05e3E715d945B59290df0ae8eF85c1BdB684744'],
    uiPoolDataProvider: '0x538C84EA84F655f2e04eBfAD4948abA9495A2Fc3',
  },
  // avalanche
  43114: {
    poolAddressProviders: ['0xb6A86025F0FE1862B372cb0ca18CE3EDe02A318f'],
    uiPoolDataProvider: '0xf51F46EfE8eFA7BB6AA8cDfb1d2eFb8eb27d12c5',
  },
  // arbitrum
  // 421611: [],
};
