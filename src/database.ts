import {
  MongoClient,
  type Filter,
  type WithId,
  type Document,
  type OptionalId,
} from "mongodb";

export interface DatabaseAdapterOptions {
  uri: string;
  name?: string;
}

export class DatabaseAdapter {
  private client: MongoClient;
  private connecting: Promise<MongoClient>;
  private dbName: string;
  constructor(options: DatabaseAdapterOptions) {
    this.client = new MongoClient(options.uri);

    this.dbName = options.name || "auth";

    this.connecting = this.client.connect();

    this.init();
  }

  private async init() {
    await this.connecting;

    // create users collection
    await this.client.db(this.dbName).createCollection("users");
  }

  async query<T = any>({
    collection,
    query = {},
    projection = {},
    sort = {},
  }: {
    collection: string;
    query?: Filter<Document>;
    projection?: Document;
    sort?: Document;
  }) {
    await this.connecting;
    return (await this.client
      .db(this.dbName)
      .collection(collection)
      .find(query)
      .sort(sort)
      .project(projection)
      .toArray()) as WithId<T>[];
  }

  async update(collection: string, query: any, update: any) {
    await this.connecting;
    return await this.client
      .db(this.dbName)
      .collection(collection)
      .updateOne(query, update);
  }

  async insert(collection: string, doc: OptionalId<Document>) {
    await this.connecting;
    return await this.client.db(this.dbName).collection(collection).insertOne(doc);
  }

  async updateOrInsert(collection: string, search: any, set: any) {
    await this.connecting;
    const queryRes = await this.query({ collection, query: search });
    if (queryRes.length > 0) {
      return await this.update(collection, search, { $set: { ...set } });
    } else {
      return await this.insert(collection, set);
    }
  }

  async remove(collection: string, search: any) {
    await this.connecting;
    const res = await this.client
      .db(this.dbName)
      .collection(collection)
      .deleteOne(search);
    return !!res.deletedCount;
  }

  transformID<T>(object: WithId<T>) {
    return { ...object, _id: object._id.toString() } as Omit<T, "_id"> & {
      _id: string;
    };
  }
}
