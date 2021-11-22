import mongoose from 'mongoose';

export interface MongoDBInterface {
  connect: () => Promise<typeof mongoose>;
  getConnection: () => typeof mongoose;
  closeConnection: () => Promise<void>;
}

class MongoDB implements MongoDBInterface {
  private connection: typeof mongoose;

  readonly url: string;

  constructor() {
    this.url = process.env.MONGODB_URL;
  }

  public async connect(): Promise<typeof mongoose> {
    if (!this.connection) {
      this.connection = await mongoose.connect(this.url);
      if (this.connection.connections[0].readyState) {
        console.info('🚀 Connected to MongoDB at: http://0.0.0.0:8081');
        return this.connection;
      } else {
        console.log('Something happened');
        throw new Error('Some TODO error / logic here');
      }
    } else {
      return this.connection;
    }
  }

  // eslint-disable-next-line class-methods-use-this
  public async closeConnection(): Promise<void> {
    await mongoose.connection.close();
  }

  public getConnection(): typeof mongoose {
    return this.connection;
  }
}

export default new MongoDB();
