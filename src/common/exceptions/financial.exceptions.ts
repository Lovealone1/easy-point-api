import { AppError } from './base.error';

export class CurrencyMismatchError extends AppError {
  constructor(currencyA: string, currencyB: string) {
    super(
      `Cannot perform operations on different currencies: ${currencyA} and ${currencyB}.`,
      400,
      'CURRENCY_MISMATCH',
      { currencyA, currencyB },
    );
  }
}

export class InvalidMoneyAmountError extends AppError {
  constructor(amount: any) {
    super(
      `Invalid money amount provided: ${amount}. Only numeric finite values are accepted.`,
      400,
      'INVALID_AMOUNT',
      { amount },
    );
  }
}
