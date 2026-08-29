
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

  }
}

export default Matcher;
