
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

  private buyLimitOrder(buyOrder: LimitOrder) {
    const index = this.bidOrderList.findIndex((order) => buyOrder.price > order.price);
    this.bidOrderList.splice(index, 0, buyOrder);
  }

  private sellLimitOrder(sellOrder: LimitOrder) {
    const index = this.askOrderList.findIndex((order) => sellOrder.price < order.price);
    this.bidOrderList.splice(index, 0, sellOrder);
  }
}

export default Matcher;
