
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

type LimitOrderRow = {
  sequence: string;
  orderId: string;
  side: number;
  price: string;
  amount: string;
};

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
        side = ${side === LimitSide.BID ? 0 : 1}`;
    const bindings: (string | number)[] = [];
    const andPriceSQL = price != null ? `AND price ${side === LimitSide.BID ? '>=' : '<='} ?` : '';
    price != null && bindings.push(this.bigint2SQLiteInteger(price));
    const orderBySQL = `ORDER BY price ${side === LimitSide.BID ? 'DESC' : 'ASC'}, sequence ASC`;
    const limitSQL = limit != null ? `LIMIT ?` : '';
    limit != null && bindings.push(limit);

    return this.state.storage.sql
      .exec<LimitOrderRow>(`${baseSQL} ${andPriceSQL} ${orderBySQL} ${limitSQL}`, ...bindings)
      .toArray().map((order) => ({
        sequence: BigInt(order.sequence),
        orderId: order.orderId,
        side: order.side as LimitSide,
        price: BigInt(order.price),
        amount: BigInt(order.amount),
      }));
  }

  private matchOrder(makerSide: LimitSide, amount: bigint, price?: bigint): Dealt {
    if (makerSide !== LimitSide.BID && makerSide !== LimitSide.ASK) {
      throw new RangeError(`invalid limit order side: ${makerSide}`);
    }
    this.validateSQLitePositiveInteger(amount, 'amount');
    price != null && this.validateSQLitePositiveInteger(price, 'price');

    let remainingAmount = amount;
    const filledOrders: FilledOrder[] = [];

    while (remainingAmount > 0n) {
      const top = this.queryLimitOrder(makerSide, 1, price)[0];
      if (!top) {
        break;
      }

      if (top.amount <= remainingAmount) {
        remainingAmount -= top.amount;
        filledOrders.push({
          ...top,
          dealtAmount: top.amount,
        });
        this.state.storage.sql.exec(
          'DELETE FROM orders WHERE sequence = ?',
          this.bigint2SQLiteInteger(top.sequence),
        );
      } else {
        filledOrders.push({
          ...top,
          dealtAmount: remainingAmount,
        });
        this.state.storage.sql.exec(
          'UPDATE orders SET amount = ? WHERE sequence = ?',
          this.bigint2SQLiteInteger(top.amount - remainingAmount),
          this.bigint2SQLiteInteger(top.sequence),
        );
        remainingAmount = 0n;
      }
    }

    return {
      dealtAmount: amount - remainingAmount,
      filledOrders,
    };
  }

  private limitOrder(orderId: string, side: LimitSide, price: bigint, amount: bigint): LimitOrder {
    this.validateOrderId(orderId);
    if (side !== LimitSide.BID && side !== LimitSide.ASK) {
      throw new RangeError(`invalid limit order side: ${side}`);
    }
    this.validateSQLitePositiveInteger(price, 'price');
    this.validateSQLitePositiveInteger(amount, 'amount');

    this.registerOrderId(orderId);

    const inserted = this.state.storage.sql
      .exec<{ sequence: string }>(
        'INSERT INTO orders (orderId, side, price, amount) VALUES (?, ?, ?, ?) RETURNING CAST(sequence AS TEXT) AS sequence',
        orderId,
        side as number,
        this.bigint2SQLiteInteger(price),
        this.bigint2SQLiteInteger(amount),
      )
      .one();
    return {
      sequence: BigInt(inserted.sequence),
      orderId,
      side,
      price,
      amount,
    };
  }

  private deleteOrder(orderId: string): LimitOrder {
    this.validateOrderId(orderId);

    const orders = this.state.storage.sql
      .exec<LimitOrderRow>(
        `DELETE FROM orders
         WHERE orderId = ?
         RETURNING CAST(sequence AS TEXT) AS sequence, orderId, side,
                   CAST(price AS TEXT) AS price,
                   CAST(amount AS TEXT) AS amount`,
        orderId,
      )
      .toArray();
    const order = orders[0];
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    return {
      sequence: BigInt(order.sequence),
      orderId: order.orderId,
      side: order.side as LimitSide,
      price: BigInt(order.price),
      amount: BigInt(order.amount),
    };
  }

  public LimitBid(orderId: string, price: bigint, amount: bigint): LimitResult {
    return this.state.storage.transactionSync(() => {
      const dealt = this.matchOrder(LimitSide.ASK, amount, price);
      const remainingAmount = amount - dealt.dealtAmount;
      if (remainingAmount === 0n) {
        this.registerOrderId(orderId);
        return { dealt };
      }

      const order = this.limitOrder(orderId, LimitSide.BID, price, remainingAmount);

      return dealt.dealtAmount === 0n ? { order } : { order, dealt };
    });
  }

  public LimitAsk(orderId: string, price: bigint, amount: bigint): LimitResult {
    return this.state.storage.transactionSync(() => {
      const dealt = this.matchOrder(LimitSide.BID, amount, price);
      const remainingAmount = amount - dealt.dealtAmount;
      if (remainingAmount === 0n) {
        this.registerOrderId(orderId);
        return { dealt };
      }

      const order = this.limitOrder(orderId, LimitSide.ASK, price, remainingAmount);

      return dealt.dealtAmount === 0n ? { order } : { order, dealt };
    });
  }

  public MarketBuy(orderId: string, amount: bigint): Dealt {
    return this.state.storage.transactionSync(() => {
      this.registerOrderId(orderId);
      return this.matchOrder(LimitSide.ASK, amount);
    });
  }

  public MarketSell(orderId: string, amount: bigint): Dealt {
    return this.state.storage.transactionSync(() => {
      this.registerOrderId(orderId);
      return this.matchOrder(LimitSide.BID, amount);
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
    return this.state.storage.transactionSync(() => {
      return this.deleteOrder(orderId);
    });
  }

  private validateSQLitePositiveInteger(value: bigint, field: string) {
    if (typeof value !== 'bigint') {
      throw new TypeError(`${field} must be a bigint`);
    }
    if (value <= 0n || value > MatcherDurableObject.SQLITE_INTEGER_MAX) {
      throw new RangeError(`${field} must be between 1 and ${MatcherDurableObject.SQLITE_INTEGER_MAX}`);
    }
  }

  private bigint2SQLiteInteger(value: bigint) {
    if (typeof value !== 'bigint') {
      throw new TypeError('value must be a bigint');
    }
    if (value < MatcherDurableObject.SQLITE_INTEGER_MIN || value > MatcherDurableObject.SQLITE_INTEGER_MAX) {
      throw new RangeError(`value must be between ${MatcherDurableObject.SQLITE_INTEGER_MIN} and ${MatcherDurableObject.SQLITE_INTEGER_MAX}`);
    }
    return value.toString();
  }

  private validateOrderId(orderId: string) {
    if (typeof orderId !== 'string' || orderId.trim().length === 0) {
      throw new RangeError('orderId must be a non-empty string');
    }
  }

  private registerOrderId(orderId: string): void {
    this.validateOrderId(orderId);

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
