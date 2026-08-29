
interface Order {
  orderId: string;
  action: 'BID' | 'ASK' | 'BUY' | 'SELL';
  price: bigint;
  amount: bigint;
}

class Matcher {
  private askOrderList: Order[] = [];
  private bidOrderList: Order[] = [];

  public Limit(limitOrder: Order) {
    if (limitOrder.action === 'BID') {
      this.bidLimitOrder(limitOrder);
    } else if (limitOrder.action === 'ASK') {
      this.askLimitOrder(limitOrder);
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
    if (marketOrder.action === 'BUY') {
      return this.buyMarketOrder(marketOrder);
    } else if (marketOrder.action === 'SELL') {
      return this.sellMarketOrder(marketOrder);
    }
  }

  private buyMarketOrder(buyOrder: Order) {
    const filledOrders: Order[] = [];
    let buyAmount = buyOrder.amount;
    while (this.askOrderList.length > 0 && buyAmount > 0n) {
      const ask1Order = this.askOrderList[0];
      if (ask1Order.amount <= buyAmount) {
        buyAmount -= ask1Order.amount;
        filledOrders.push(this.askOrderList.shift()!);
      } else {
        ask1Order.amount -= buyAmount;
        filledOrders.push({ ...ask1Order, amount: buyAmount });
        buyAmount = 0n;
      }
    }
    return filledOrders;
  }

  private sellMarketOrder(sellOrder: Order) {
    let sellAmount = sellOrder.amount;
    while (this.bidOrderList.length > 0 && sellAmount > 0n) {
      const bid1Order = this.bidOrderList[0];
      if (bid1Order.amount <= sellAmount) {
        sellAmount -= bid1Order.amount;
        this.bidOrderList.shift();
      } else {
        bid1Order.amount -= sellAmount;
        sellAmount = 0n;
      }
    }
  }
}

export default Matcher;
