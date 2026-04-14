import {
  CurrencyMismatchError,
  InvalidMoneyAmountError,
} from '../../common/exceptions/financial.exceptions';

export class Money {
  private readonly amount: number;
  public readonly currency: string;

  constructor(amountInCents: number, currency: string = 'COP') {
    if (typeof amountInCents !== 'number' || !Number.isInteger(amountInCents)) {
      throw new InvalidMoneyAmountError(amountInCents);
    }
    this.amount = amountInCents;
    this.currency = currency.toUpperCase();
  }

  toNumber(): number {
    return this.amount;
  }

  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(multiplier: number): Money {
    return new Money(Math.round(this.amount * multiplier), this.currency);
  }

  percentage(percent: number): Money {
    return new Money(Math.round((this.amount * percent) / 100), this.currency);
  }

  allocate(ratios: number[]): Money[] {
    if (ratios.length === 0) return [];

    const totalRatio = ratios.reduce((sum, r) => sum + r, 0);
    let remainder = this.amount;
    const results: number[] = [];

    for (let i = 0; i < ratios.length; i++) {
        const share = Math.floor((this.amount * ratios[i]) / totalRatio);
        results.push(share);
        remainder -= share;
    }

    for (let i = 0; remainder > 0 && i < results.length; i++) {
        results[i] += 1;
        remainder -= 1;
    }

    return results.map((res) => new Money(res, this.currency));
  }

  format(): string {
    const formatted = (this.amount / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${this.currency} ${formatted}`;
  }

  private ensureSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
