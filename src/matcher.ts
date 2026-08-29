
interface Order {
  orderId: string;
  action: 'BID' | 'ASK' | 'BUY' | 'SELL' | 'FILLED' | 'PARTIALLY_FILLED';
  price: bigint;
  amount: bigint;
}

interface Dealt {
  amount: bigint;
  filledOrders: Order[];
}

interface LimitResult {
  dealt?: Dealt;
  order?: Order;
}

class Matcher {
  private askOrderList: Order[] = [];
  private bidOrderList: Order[] = [];

  public Limit(limitOrder: Order) {
    this.validateAmount(limitOrder);
    this.validatePrice(limitOrder);
    if (limitOrder.action === 'BID') {
      return this.limitBid(limitOrder);
    } else if (limitOrder.action === 'ASK') {
      return this.limitAsk(limitOrder);
    } else {
      throw new RangeError(`Invalid action for limit order: ${limitOrder.action}`);
    }
  }

  private limitBid(bidOrder: Order): LimitResult {
    const order = { ...bidOrder };
    const filledOrders: Order[] = [];
    while (this.askOrderList.length > 0 && order.amount > 0n && order.price >= this.askOrderList[0].price) {
      const ask1Order = this.askOrderList[0];
      if (ask1Order.amount <= order.amount) {
        order.amount -= ask1Order.amount;
        filledOrders.push({ ...this.askOrderList.shift()!, action: 'FILLED' });
      } else {
        ask1Order.amount -= order.amount;
        filledOrders.push({ ...ask1Order, amount: order.amount, action: 'PARTIALLY_FILLED' });
        order.amount = 0n;
      }
    }
    const dealt = { amount: bidOrder.amount - order.amount, filledOrders };
    if (dealt.amount === bidOrder.amount) {
      return { dealt };
    }
    let index = 0;
    for (; index < this.bidOrderList.length && order.price <= this.bidOrderList[index].price; ++index);
    this.bidOrderList.splice(index, 0, order);
    return dealt.amount === 0n ? { order } : { order, dealt };
  }

  private limitAsk(askOrder: Order): LimitResult {
    const order = { ...askOrder };
    const filledOrders: Order[] = [];
    while (this.bidOrderList.length > 0 && order.amount > 0n && order.price <= this.bidOrderList[0].price) {
      const bid1Order = this.bidOrderList[0];
      if (bid1Order.amount <= order.amount) {
        order.amount -= bid1Order.amount;
        filledOrders.push({ ...this.bidOrderList.shift()!, action: 'FILLED' });
      } else {
        bid1Order.amount -= order.amount;
        filledOrders.push({ ...bid1Order, amount: order.amount, action: 'PARTIALLY_FILLED' });
        order.amount = 0n;
      }
    }
    const dealt = { amount: askOrder.amount - order.amount, filledOrders };
    if (dealt.amount === askOrder.amount) {
      return { dealt };
    }
    let index = 0;
    for (; index < this.askOrderList.length && order.price >= this.askOrderList[index].price; ++index);
    this.askOrderList.splice(index, 0, order);
    return dealt.amount === 0n ? { order } : { order, dealt };
  }

  public Market(marketOrder: Order) {
    this.validateAmount(marketOrder);
    if (marketOrder.action === 'BUY') {
      return this.marketBuy(marketOrder);
    } else if (marketOrder.action === 'SELL') {
      return this.marketSell(marketOrder);
    } else {
      throw new RangeError(`Invalid action for market order: ${marketOrder.action}`);
    }
  }

  private marketBuy(buyOrder: Order): Dealt {
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

  private marketSell(sellOrder: Order): Dealt {
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

  private validateAmount(order: Order) {
    if (order.amount <= 0n) {
      throw new RangeError('Order amount must be greater than zero');
    }
  }

  private validatePrice(order: Order) {
    if (order.price <= 0n) {
      throw new RangeError('Limit order price must be greater than zero');
    }
  }
}

export default Matcher;
