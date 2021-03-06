import transferDomain from './domain/Transfer';
import { TransferType } from './model/Transfer';

const MAX_BATCH_SIZE = 100000;
const INSERT_TIMEOUT = 1000;

export interface InsertAggregatorInterface {
  queueLogs: (logs: TransferType[]) => void;
  triggerInsert: () => Promise<void>;
  initializeWatcher: () => Promise<void>;
}

/**
 * Class for aggregating all the transfer logs and insert
 * in batches of 100k
 */
export default class InsertAggregator implements InsertAggregatorInterface {
  readonly logsQueue: TransferType[];

  constructor() {
    this.logsQueue = [];
  }

  public initializeWatcher = async (): Promise<void> => {
    console.log('######## Logs Queue watcher initialized ##########');
    const insertLogsQueued = async () => {
      try {
        // TODO: add logic here
        if (this.queueLogs.length >= MAX_BATCH_SIZE) {
          await this.triggerInsert();
        }
        return setTimeout(insertLogsQueued, INSERT_TIMEOUT);
      } catch (error) {
        // TODO: do something with the error

        return setTimeout(insertLogsQueued, INSERT_TIMEOUT);
      }
    };

    await insertLogsQueued();
  };

  /**
   * Queues logs and if batch limit is reached it calls the insert method
   * @param logs Array of logs to insert
   * @returns
   */
  public queueLogsOld = async (logs: TransferType[]): Promise<void> => {
    const batchSize = this.logsQueue.length + logs.length;
    console.log('Batch size: ', batchSize);
    if (batchSize >= MAX_BATCH_SIZE) {
      const differential = MAX_BATCH_SIZE - this.logsQueue.length;
      this.logsQueue.push(...logs.slice(0, differential));

      await this.triggerInsert();
      this.logsQueue.length = 0;
      this.logsQueue.push(...logs.slice(differential - logs.length));

      return;
    }

    this.logsQueue.push(...logs);
  };

  /**
   * Queues logs and if batch limit is reached it calls the insert method
   * @param logs Array of logs to insert
   * @returns
   */
  public queueLogs = (logs: TransferType[]): void => {
    this.logsQueue.push(...logs);
    console.log('Batch size: ', this.logsQueue.length);
  };

  /**
   * Log insert method. Tries to insert with insertMany.
   * If error of keys already existing tries to upsert
   */
  public triggerInsert = async (): Promise<void> => {
    // TODO: investigate the error of repeated key, as with unordererd this should not happen
    // upsert is quite slow as it needs to check by id
    const insertLogs = this.logsQueue.splice(0, MAX_BATCH_SIZE);
    console.log('Batch size after index: ', this.logsQueue.length);

    const timestamp = Date.now();
    console.time(`insert: ${timestamp}`);
    try {
      await transferDomain.insertManyRawTransferLogsInBulk(insertLogs);
    } catch (error) {
      console.log('Error inserting: ', error.code);
      await transferDomain.upsertRawTransferLogsInBulk(insertLogs);
    }

    console.timeEnd(`insert: ${timestamp}`);
  };
}
