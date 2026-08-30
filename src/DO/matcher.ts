export class MatcherDurableObject {
  private static readonly SQLITE_INTEGER_MIN = -(2n ** 63n);
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
    this.validateSqliteInteger(price, 'price');
    this.validateSqliteInteger(amount, 'amount');
    this.state.storage.sql.exec(
      'INSERT INTO orders (order_id, side, price, amount) VALUES (?, 0, ?, ?)',
      orderId,
      price,
      amount,
    );
  }

  private limitAsk(orderId: string, price: bigint, amount: bigint): void {
    this.validateSqliteInteger(price, 'price');
    this.validateSqliteInteger(amount, 'amount');
    this.state.storage.sql.exec(
      'INSERT INTO orders (order_id, side, price, amount) VALUES (?, 1, ?, ?)',
      orderId,
      price,
      amount,
    );
  }

  private validateSqliteInteger(value: bigint, field: string): void {
    if (value < MatcherDurableObject.SQLITE_INTEGER_MIN || value > MatcherDurableObject.SQLITE_INTEGER_MAX) {
      throw new RangeError(`${field} must fit within SQLite INTEGER range`);
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
