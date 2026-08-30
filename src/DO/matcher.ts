
enum OrderSide {
  BID = 0,
  ASK = 1,
}

enum DealStatus {
  FILLED = 0,
  PARTIALLY_FILLED = 1,
}

interface LimitOrder {
  orderId: string;
  side: OrderSide;
  price: bigint;
  amount: bigint;
}

interface FilledOrder {
  orderId: string;
  side: OrderSide;
  status: DealStatus;
  price: bigint;
  amount: bigint;
  dealtAmount: bigint;
}

interface Dealt {
  dealtAmount: bigint;
  filledOrders: FilledOrder[];
}

interface LimitResult {
  dealt?: Dealt;
  order?: LimitOrder;
}

export class MatcherDurableObject {
  private static readonly SQLITE_INTEGER_MAX = 2n ** 63n - 1n;

  constructor(private readonly state: DurableObjectState) {
    this.state.blockConcurrencyWhile(async () => {
      this.initializeSchema();
    });
  }

  async fetch(): Promise<Response> {
    return Response.json(
      { error: 'Market matcher endpoint is not implemented yet' },
      { status: 501 },
    );
  }

  private limitBid(orderId: string, price: bigint, amount: bigint): void {
    this.validateOrderId(orderId);
    this.validateOrderInteger(price, 'price');
    this.validateOrderInteger(amount, 'amount');
    this.state.storage.transactionSync(() => {
      this.state.storage.sql.exec(
        'INSERT INTO orders (order_id, side, price, amount) VALUES (?, 0, ?, ?)',
        orderId,
        price,
        amount,
      );
    });
  }

  private limitAsk(orderId: string, price: bigint, amount: bigint): void {
    this.validateOrderId(orderId);
    this.validateOrderInteger(price, 'price');
    this.validateOrderInteger(amount, 'amount');
    this.state.storage.transactionSync(() => {
      this.state.storage.sql.exec(
        'INSERT INTO orders (order_id, side, price, amount) VALUES (?, 1, ?, ?)',
        orderId,
        price,
        amount,
      );
    });
  }

  private marketBuy(orderId: string, amount: bigint): Dealt {
    this.validateOrderId(orderId);
    this.validateOrderInteger(amount, 'amount');

    return this.state.storage.transactionSync(() => {
      let remainingAmount = amount;
      const filledOrders: FilledOrder[] = [];
      while (remainingAmount > 0n) {
        const asks = this.state.storage.sql
          .exec<{
            sequence: number;
            order_id: string;
            side: number;
            price: string;
            amount: string;
          }>(
            `SELECT sequence, order_id, side,
                    CAST(price AS TEXT) AS price,
                    CAST(amount AS TEXT) AS amount
             FROM orders
             WHERE side = 1
             ORDER BY price ASC, sequence ASC
             LIMIT 1`,
          )
          .toArray();
        const ask = asks[0];
        if (!ask) {
          break;
        }

        const askAmount = BigInt(ask.amount);
        if (askAmount <= remainingAmount) {
          remainingAmount -= askAmount;
          filledOrders.push({
            orderId: ask.order_id,
            side: OrderSide.ASK,
            status: DealStatus.FILLED,
            price: BigInt(ask.price),
            amount: askAmount,
            dealtAmount: askAmount,
          });
          this.state.storage.sql.exec('DELETE FROM orders WHERE sequence = ?', ask.sequence);
        } else {
          filledOrders.push({
            orderId: ask.order_id,
            side: OrderSide.ASK,
            status: DealStatus.PARTIALLY_FILLED,
            price: BigInt(ask.price),
            amount: askAmount,
            dealtAmount: remainingAmount,
          });
          this.state.storage.sql.exec(
            'UPDATE orders SET amount = ? WHERE sequence = ?',
            askAmount - remainingAmount,
            ask.sequence,
          );
          remainingAmount = 0n;
        }
      }

      return {
        dealtAmount: amount - remainingAmount,
        filledOrders,
      };
    });
  }

  private marketSell(orderId: string, amount: bigint): Dealt {
    this.validateOrderId(orderId);
    this.validateOrderInteger(amount, 'amount');

    return this.state.storage.transactionSync(() => {
      let remainingAmount = amount;
      const filledOrders: FilledOrder[] = [];
      while (remainingAmount > 0n) {
        const bids = this.state.storage.sql
          .exec<{
            sequence: number;
            order_id: string;
            side: number;
            price: string;
            amount: string;
          }>(
            `SELECT sequence, order_id, side,
                    CAST(price AS TEXT) AS price,
                    CAST(amount AS TEXT) AS amount
             FROM orders
             WHERE side = 0
             ORDER BY price DESC, sequence ASC
             LIMIT 1`,
          )
          .toArray();
        const bid = bids[0];
        if (!bid) {
          break;
        }

        const bidAmount = BigInt(bid.amount);
        if (bidAmount <= remainingAmount) {
          remainingAmount -= bidAmount;
          filledOrders.push({
            orderId: bid.order_id,
            side: OrderSide.BID,
            status: DealStatus.FILLED,
            price: BigInt(bid.price),
            amount: bidAmount,
            dealtAmount: bidAmount,
          });
          this.state.storage.sql.exec('DELETE FROM orders WHERE sequence = ?', bid.sequence);
        } else {
          filledOrders.push({
            orderId: bid.order_id,
            side: OrderSide.BID,
            status: DealStatus.PARTIALLY_FILLED,
            price: BigInt(bid.price),
            amount: bidAmount,
            dealtAmount: remainingAmount,
          });
          this.state.storage.sql.exec(
            'UPDATE orders SET amount = ? WHERE sequence = ?',
            bidAmount - remainingAmount,
            bid.sequence,
          );
          remainingAmount = 0n;
        }
      }

      return {
        dealtAmount: amount - remainingAmount,
        filledOrders,
      };
    });
  }

  private validateOrderInteger(value: bigint, field: string): void {
    if (value <= 0n || value > MatcherDurableObject.SQLITE_INTEGER_MAX) {
      throw new RangeError(`${field} must be between 1 and ${MatcherDurableObject.SQLITE_INTEGER_MAX}`);
    }
  }

  private validateOrderId(orderId: string): void {
    if (typeof orderId !== 'string' || orderId.trim().length === 0) {
      throw new RangeError('orderId must be a non-empty string');
    }
  }

  private initializeSchema() {
    this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL UNIQUE,
        side INTEGER NOT NULL CHECK (side IN (0, 1)),
        price INTEGER NOT NULL CHECK (price > 0),
        amount INTEGER NOT NULL CHECK (amount > 0)
      );

      CREATE INDEX IF NOT EXISTS idx_orders_bid
      ON orders (price DESC, sequence ASC)
      WHERE side = 0;

      CREATE INDEX IF NOT EXISTS idx_orders_ask
      ON orders (price ASC, sequence ASC)
      WHERE side = 1;
    `);
  }
}
