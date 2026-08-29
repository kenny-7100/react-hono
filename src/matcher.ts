
interface LimitOrder {
  orderId: string;
  side: 'BUY' | 'SELL';
  price: bigint;
  amount: bigint;
  timestamp: number;
}

class Matcher {
  private askOrderList: LimitOrder[] = [];
  private bidOrderList: LimitOrder[] = [];

  public Limit(limitOrder: LimitOrder) {
    const order: LimitOrder = { ...limitOrder, timestamp: Date.now() };
    if (order.side === 'BUY') {
      this.buyLimitOrder(order);
    } else if (order.side === 'SELL') {
      this.sellLimitOrder(order);
    }
  }

  private buyLimitOrder(bidOrder: LimitOrder) {
    let index = 0;
    for (; index < this.bidOrderList.length && bidOrder.price <= this.bidOrderList[index].price; ++index);
    this.bidOrderList.splice(index, 0, bidOrder);
  }

  private sellLimitOrder(askOrder: LimitOrder) {
    let index = 0;
    for (; index < this.askOrderList.length && askOrder.price >= this.askOrderList[index].price; ++index);
    this.askOrderList.splice(index, 0, askOrder);
  }
}

export default Matcher;
