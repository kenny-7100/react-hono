
interface Order {
  orderId: string;
  side: 'BUY' | 'SELL';
  price: bigint;
  amount: bigint;
  timestamp: number;
}

class Matcher {
  private askOrderList: Order[] = [];
  private bidOrderList: Order[] = [];

  public Limit(limitOrder: Order) {
    const order: Order = { ...limitOrder, timestamp: Date.now() };
    if (order.side === 'BUY') {
      this.bidLimitOrder(order);
    } else if (order.side === 'SELL') {
      this.askLimitOrder(order);
    }
  }

  private bidLimitOrder(bidOrder: Order) {
    let index = 0;
    for (; index < this.bidOrderList.length && bidOrder.price <= this.bidOrderList[index].price; ++index);
    this.bidOrderList.splice(index, 0, bidOrder);
  }

  private askLimitOrder(askOrder: Order) {
    let index = 0;
    for (; index < this.askOrderList.length && askOrder.price >= this.askOrderList[index].price; ++index);
    this.askOrderList.splice(index, 0, askOrder);
  }

  public Market(marketOrder: Order) {
    if (marketOrder.side === 'BUY') {
      return this.buyMarketOrder(marketOrder);
    } else if (marketOrder.side === 'SELL') {
      return this.sellMarketOrder(marketOrder);
    }
  }

  private buyMarketOrder(buyOrder: Order) {
    let buyAmount = buyOrder.amount;
    while (this.askOrderList.length > 0 && buyAmount > 0) {
      const ask1Order = this.askOrderList[0];
      if (ask1Order.amount <= buyAmount) {
        buyAmount -= ask1Order.amount;
        this.askOrderList.shift();
      } else {
        ask1Order.amount -= buyAmount;
        buyAmount = 0n;
      }
    }
  }

  private sellMarketOrder(sellOrder: Order) {

  }
}

export default Matcher;
