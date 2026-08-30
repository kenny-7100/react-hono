
enum LimitSide {
  BID = 0,
  ASK = 1,
}

interface LimitOrder {
  sequence: bigint;
  orderId: string;
  side: LimitSide;
  price: bigint;
  amount: bigint;
}

interface FilledOrder extends LimitOrder {
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
  private static readonly SQLITE_INTEGER_MIN = -(2n ** 63n);
  private static readonly SQLITE_INTEGER_MAX = 2n ** 63n - 1n;

  constructor(private readonly state: DurableObjectState) {
    this.state.blockConcurrencyWhile(async () => {
      this.initializeSchema();
    });
  }

  private queryLimitOrder(side: LimitSide, limit: number | null = null, price?: bigint): LimitOrder[] {
    if (side !== LimitSide.BID && side !== LimitSide.ASK) {
      throw new RangeError(`invalid limit order side: ${side}`);
    }
    if (limit != null && (!Number.isSafeInteger(limit) || limit <= 0)) {
      throw new RangeError('limit must be a positive safe integer');
    }
    price != null && this.validateSQLitePositiveInteger(price, 'price');

    const baseSQL =
      `SELECT
        CAST(sequence AS TEXT) AS sequence,
        orderId,
        side,
        CAST(price AS TEXT) AS price,
        CAST(amount AS TEXT) AS amount
      FROM
        orders
      WHERE
        side = ?`;
    const bindings: (number | string)[] = [side === LimitSide.BID ? 0 : 1];
    const andPriceSQL = price != null ? `AND price ${side === LimitSide.BID ? '>=' : '<='} ?` : '';
    price != null && bindings.push(this.bigint2SQLiteInteger(price));
    const orderBySQL = `ORDER BY price ${side === LimitSide.BID ? 'DESC' : 'ASC'}, sequence ASC`;
    const limitSQL = limit != null ? `LIMIT ?` : '';
    limit != null && bindings.push(limit);

    return this.state.storage.sql
      .exec<{
        sequence: string;
        orderId: string;
        side: number;
        price: string;
        amount: string;
      }>(`${baseSQL} ${andPriceSQL} ${orderBySQL} ${limitSQL}`, ...bindings)
      .toArray().map((order) => ({
        sequence: BigInt(order.sequence),
        orderId: order.orderId,
        side: order.side as LimitSide,
        price: BigInt(order.price),
        amount: BigInt(order.amount),
      }));
  }

  public LimitBid(orderId: string, price: bigint, amount: bigint): LimitResult {
    this.validateOrderId(orderId);
    this.validateSQLitePositiveInteger(price, 'price');
    this.validateSQLitePositiveInteger(amount, 'amount');

    return this.state.storage.transactionSync(() => {
      this.registerOrderId(orderId);

      let remainingAmount = amount;
      const filledOrders: FilledOrder[] = [];

      while (remainingAmount > 0n) {
        const ask = this.queryLimitOrder(LimitSide.ASK, 1, price)[0];
        if (!ask) {
          break;
        }

        const askAmount = ask.amount;
        if (askAmount <= remainingAmount) {
          remainingAmount -= askAmount;
          filledOrders.push({
            ...ask,
            dealtAmount: askAmount,
          });
          this.state.storage.sql.exec(
            'DELETE FROM orders WHERE sequence = ?',
            this.bigint2SQLiteInteger(ask.sequence),
          );
        } else {
          filledOrders.push({
            ...ask,
            dealtAmount: remainingAmount,
          });
          this.state.storage.sql.exec(
            'UPDATE orders SET amount = ? WHERE sequence = ?',
            askAmount - remainingAmount,
            this.bigint2SQLiteInteger(ask.sequence),
          );
          remainingAmount = 0n;
        }
      }

      const dealt = {
        dealtAmount: amount - remainingAmount,
        filledOrders,
      };
      if (remainingAmount === 0n) {
        return { dealt };
      }

      const order: LimitOrder = {
        orderId,
        side: LimitSide.BID,
        price,
        amount: remainingAmount,
      };
      this.state.storage.sql.exec(
        'INSERT INTO orders (orderId, side, price, amount) VALUES (?, 0, ?, ?)',
        order.orderId,
        order.price,
        order.amount,
      );

      return dealt.dealtAmount === 0n ? { order } : { order, dealt };
    });
  }

  public LimitAsk(orderId: string, price: bigint, amount: bigint): LimitResult {
    this.validateOrderId(orderId);
    this.validateSQLitePositiveInteger(price, 'price');
    this.validateSQLitePositiveInteger(amount, 'amount');

    return this.state.storage.transactionSync(() => {
      this.registerOrderId(orderId);

      let remainingAmount = amount;
      const filledOrders: FilledOrder[] = [];

      while (remainingAmount > 0n) {
        const bid = this.queryLimitOrder(LimitSide.BID, 1, price)[0];
        if (!bid) {
          break;
        }

        const bidAmount = bid.amount;
        if (bidAmount <= remainingAmount) {
          remainingAmount -= bidAmount;
          filledOrders.push({
            ...bid,
            dealtAmount: bidAmount,
          });
          this.state.storage.sql.exec(
            'DELETE FROM orders WHERE sequence = ?',
            this.bigint2SQLiteInteger(bid.sequence),
          );
        } else {
          filledOrders.push({
            ...bid,
            dealtAmount: remainingAmount,
          });
          this.state.storage.sql.exec(
            'UPDATE orders SET amount = ? WHERE sequence = ?',
            bidAmount - remainingAmount,
            this.bigint2SQLiteInteger(bid.sequence),
          );
          remainingAmount = 0n;
        }
      }

      const dealt = {
        dealtAmount: amount - remainingAmount,
        filledOrders,
      };
      if (remainingAmount === 0n) {
        return { dealt };
      }

      const order: LimitOrder = {
        orderId,
        side: LimitSide.ASK,
        price,
        amount: remainingAmount,
      };
      this.state.storage.sql.exec(
        'INSERT INTO orders (orderId, side, price, amount) VALUES (?, 1, ?, ?)',
        order.orderId,
        order.price,
        order.amount,
      );

      return dealt.dealtAmount === 0n ? { order } : { order, dealt };
    });
  }

  public MarketBuy(orderId: string, amount: bigint): Dealt {
    this.validateOrderId(orderId);
    this.validateSQLitePositiveInteger(amount, 'amount');

    return this.state.storage.transactionSync(() => {
      this.registerOrderId(orderId);

      let remainingAmount = amount;
      const filledOrders: FilledOrder[] = [];
      while (remainingAmount > 0n) {
        const ask = this.queryLimitOrder(LimitSide.ASK, 1)[0];
        if (!ask) {
          break;
        }

        const askAmount = ask.amount;
        if (askAmount <= remainingAmount) {
          remainingAmount -= askAmount;
          filledOrders.push({
            ...ask,
            dealtAmount: askAmount,
          });
          this.state.storage.sql.exec(
            'DELETE FROM orders WHERE sequence = ?',
            this.bigint2SQLiteInteger(ask.sequence),
          );
        } else {
          filledOrders.push({
            ...ask,
            dealtAmount: remainingAmount,
          });
          this.state.storage.sql.exec(
            'UPDATE orders SET amount = ? WHERE sequence = ?',
            askAmount - remainingAmount,
            this.bigint2SQLiteInteger(ask.sequence),
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

  public MarketSell(orderId: string, amount: bigint): Dealt {
    this.validateOrderId(orderId);
    this.validateSQLitePositiveInteger(amount, 'amount');

    return this.state.storage.transactionSync(() => {
      this.registerOrderId(orderId);

      let remainingAmount = amount;
      const filledOrders: FilledOrder[] = [];
      while (remainingAmount > 0n) {
        const bid = this.queryLimitOrder(LimitSide.BID, 1)[0];
        if (!bid) {
          break;
        }

        const bidAmount = bid.amount;
        if (bidAmount <= remainingAmount) {
          remainingAmount -= bidAmount;
          filledOrders.push({
            ...bid,
            dealtAmount: bidAmount,
          });
          this.state.storage.sql.exec(
            'DELETE FROM orders WHERE sequence = ?',
            this.bigint2SQLiteInteger(bid.sequence),
          );
        } else {
          filledOrders.push({
            ...bid,
            dealtAmount: remainingAmount,
          });
          this.state.storage.sql.exec(
            'UPDATE orders SET amount = ? WHERE sequence = ?',
            bidAmount - remainingAmount,
            this.bigint2SQLiteInteger(bid.sequence),
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

  public GetBids(price: bigint): LimitOrder[] {
    return this.state.storage.transactionSync(() => {
      return this.queryLimitOrder(LimitSide.BID, null, price);
    });
  }

  public GetAsks(price: bigint): LimitOrder[] {
    return this.state.storage.transactionSync(() => {
      return this.queryLimitOrder(LimitSide.ASK, null, price);
    });
  }

  public CancelOrder(orderId: string): LimitOrder {
    this.validateOrderId(orderId);

    return this.state.storage.transactionSync(() => {
      const orders = this.state.storage.sql
        .exec<{
          sequence: number;
          orderId: string;
          side: number;
          price: string;
          amount: string;
        }>(
          `SELECT sequence, orderId, side,
                  CAST(price AS TEXT) AS price,
                  CAST(amount AS TEXT) AS amount
           FROM orders
           WHERE orderId = ?
           LIMIT 1`,
          orderId,
        )
        .toArray();
      const order = orders[0];
      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      this.state.storage.sql.exec('DELETE FROM orders WHERE sequence = ?', order.sequence);

      return {
        orderId: order.orderId,
        side: order.side as LimitSide,
        price: BigInt(order.price),
        amount: BigInt(order.amount),
      };
    });
  }

  private validateSQLitePositiveInteger(value: bigint | number | string, field: string): void {
    const bigintValue = BigInt(value);
    if (bigintValue <= 0n || bigintValue > MatcherDurableObject.SQLITE_INTEGER_MAX) {
      throw new RangeError(`${field} must be between 1 and ${MatcherDurableObject.SQLITE_INTEGER_MAX}`);
    }
  }

  private bigint2SQLiteInteger(value: bigint): string {
    if (
      value < MatcherDurableObject.SQLITE_INTEGER_MIN ||
      value > MatcherDurableObject.SQLITE_INTEGER_MAX
    ) {
      throw new RangeError(
        `value must be between ${MatcherDurableObject.SQLITE_INTEGER_MIN} and ${MatcherDurableObject.SQLITE_INTEGER_MAX}`,
      );
    }

    return value.toString();
  }

  private validateOrderId(orderId: string): void {
    if (typeof orderId !== 'string' || orderId.trim().length === 0) {
      throw new RangeError('orderId must be a non-empty string');
    }
  }

  private registerOrderId(orderId: string): void {
    try {
      this.state.storage.sql.exec(
        'INSERT INTO order_ids (orderId) VALUES (?)',
        orderId,
      );
    } catch {
      // Keep registration failures opaque to callers, including duplicate IDs.
      throw new Error(`Failed to register order: ${orderId}`);
    }
  }

  private initializeSchema() {
    this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS order_ids (
        orderId TEXT PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS orders (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId TEXT NOT NULL UNIQUE,
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
