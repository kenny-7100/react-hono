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
    this.validateOrderInteger(price, 'price');
    this.validateOrderInteger(amount, 'amount');
    this.state.storage.sql.exec(
      'INSERT INTO orders (order_id, side, price, amount) VALUES (?, 0, ?, ?)',
      orderId,
      price,
      amount,
    );
  }

  private limitAsk(orderId: string, price: bigint, amount: bigint): void {
    this.validateOrderInteger(price, 'price');
    this.validateOrderInteger(amount, 'amount');
    this.state.storage.sql.exec(
      'INSERT INTO orders (order_id, side, price, amount) VALUES (?, 1, ?, ?)',
      orderId,
      price,
      amount,
    );
  }

  private marketBuy(orderId: string, amount: bigint): void {
    this.validateOrderInteger(amount, 'amount');

    this.state.storage.transactionSync(() => {
      let remainingAmount = amount;
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
          return;
        }

        const askAmount = BigInt(ask.amount);
        if (askAmount <= remainingAmount) {
          remainingAmount -= askAmount;
          this.state.storage.sql.exec('DELETE FROM orders WHERE sequence = ?', ask.sequence);
        } else {
          this.state.storage.sql.exec(
            'UPDATE orders SET amount = ? WHERE sequence = ?',
            askAmount - remainingAmount,
            ask.sequence,
          );
          return;
        }
      }
    });
  }

  private validateOrderInteger(value: bigint, field: string): void {
    if (value <= 0n || value > MatcherDurableObject.SQLITE_INTEGER_MAX) {
      throw new RangeError(`${field} must be between 1 and ${MatcherDurableObject.SQLITE_INTEGER_MAX}`);
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
