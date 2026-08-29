
interface LimitOrder {
  accountId: string;
  side: 'BUY' | 'SELL';
  price: bigint;
  amount: bigint;
  timestamp: number;
}

class Matcher {
  private askOrderList: LimitOrder[] = [];
  private bidOrderList: LimitOrder[] = [];

  public Limit(limitOrder: LimitOrder) {

  }
}

export default Matcher;
