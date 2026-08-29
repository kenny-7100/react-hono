
interface Order {
  orderId: string;
  action: 'BID' | 'ASK' | 'BUY' | 'SELL' | 'FILLED' | 'PARTIALLY_FILLED';
  price: bigint;
  amount: bigint;
}

class Matcher {
  private askOrderList: Order[] = [];
  private bidOrderList: Order[] = [];

  public Limit(limitOrder: Order) {
    if (limitOrder.action === 'BID') {
      this.limitBid(limitOrder);
    } else if (limitOrder.action === 'ASK') {
      this.limitAsk(limitOrder);
    }
  }

  private limitBid(bidOrder: Order) {
    let index = 0;
    for (; index < this.bidOrderList.length && bidOrder.price <= this.bidOrderList[index].price; ++index);
    this.bidOrderList.splice(index, 0, bidOrder);
  }

  private limitAsk(askOrder: Order) {
    let index = 0;
    for (; index < this.askOrderList.length && askOrder.price >= this.askOrderList[index].price; ++index);
    this.askOrderList.splice(index, 0, askOrder);
  }

  public Market(marketOrder: Order) {
    if (marketOrder.action === 'BUY') {
      return this.marketBuy(marketOrder);
    } else if (marketOrder.action === 'SELL') {
      return this.marketSell(marketOrder);
    } else {
      return { amount: 0n, filledOrders: [] };
    }
  }

  private marketBuy(buyOrder: Order) {
    const filledOrders: Order[] = [];
    let buyAmount = buyOrder.amount;
    while (this.askOrderList.length > 0 && buyAmount > 0n) {
      const ask1Order = this.askOrderList[0];
      if (ask1Order.amount <= buyAmount) {
        buyAmount -= ask1Order.amount;
        filledOrders.push({ ...this.askOrderList.shift()!, action: 'FILLED' });
      } else {
        ask1Order.amount -= buyAmount;
        filledOrders.push({ ...ask1Order, amount: buyAmount, action: 'PARTIALLY_FILLED' });
        buyAmount = 0n;
      }
    }
    return { amount: buyOrder.amount - buyAmount, filledOrders };
  }

  private marketSell(sellOrder: Order) {
    const filledOrders: Order[] = [];
    let sellAmount = sellOrder.amount;
    while (this.bidOrderList.length > 0 && sellAmount > 0n) {
      const bid1Order = this.bidOrderList[0];
      if (bid1Order.amount <= sellAmount) {
        sellAmount -= bid1Order.amount;
        filledOrders.push({ ...this.bidOrderList.shift()!, action: 'FILLED' });
      } else {
        bid1Order.amount -= sellAmount;
        filledOrders.push({ ...bid1Order, amount: sellAmount, action: 'PARTIALLY_FILLED' });
        sellAmount = 0n;
      }
    }
    return { amount: sellOrder.amount - sellAmount, filledOrders };
  }
}

export default Matcher;
