export type Side = 'buy' | 'sell';

export type Price = {
  readonly value: bigint;
  readonly decimals: number;
};

export type Amount = {
  readonly value: bigint;
  readonly decimals: number;
};
