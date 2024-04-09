import jwt from "jsonwebtoken";
import { DatabaseAdapter, type DatabaseAdapterOptions } from "./database";
import { MongoUser, PasswordUser, User } from "./types";
import { sha256 } from "./utils";
import { generateToken, verifyToken } from "./utils/token";
import { ObjectId } from "mongodb";

export interface AuthOptions {
  domain: string;
  database: DatabaseAdapterOptions;
  jwt: {
    secret: string;
    cookie?: string;
  };
}

export class Auth {
  private db: DatabaseAdapter;
  jwt: { cookie: string; secret: string };
  domain: string;
  constructor(options: AuthOptions) {
    this.db = new DatabaseAdapter(options.database);

    this.jwt = {
      cookie: options.jwt.cookie || "auth.token",
      secret: options.jwt.secret,
    };

    this.domain = options.domain;
  }

  async createUser(
    newUser: Omit<PasswordUser, "id">
  ): Promise<{ jwt: string; user: User }> {
    const user = await this.db.query<MongoUser>({
      collection: "users",
      query: { $or: [{ email: newUser.email }, { username: newUser.username }] },
    });
    if (user.length > 0) {
      throw new Error("User already exists");
    }

    const pwHash = sha256(newUser.password);

    const insertionRes = await this.db.insert("users", {
      ...newUser,
      password: pwHash,
    });

    const res: User & { password?: string } = this.removeObjectId({
      ...newUser,
      _id: insertionRes.insertedId,
    });
    delete res.password;

    return {
      jwt: this.generateJWT(res),
      user: res,
    };
  }

  async checkIdentifier(identifier: string): Promise<boolean> {
    const user = await this.db.query<MongoUser>({
      collection: "users",
      query: { $or: [{ email: identifier }, { username: identifier }] },
    });

    return user.length > 0;
  }

  async authenticateUser(
    identifier: string,
    password: string
  ): Promise<{ jwt: string; user: User }> {
    const user = (
      await this.db.query<MongoUser & {password: string}>({
        collection: "users",
        query: {
          $or: [{ email: identifier }, { username: identifier }],
          password: sha256(password),
        },
      })
    )[0];

    if (!user) {
      throw new Error("Invalid credentials");
    }

    const res: User & { password?: string } = this.removeObjectId({ ...user });
    delete res.password;

    return {
      jwt: this.generateJWT(res),
      user: res,
    };
  }

  async updateUser(
    id: string,
    update: Partial<Omit<PasswordUser, "id">>
  ): Promise<{ jwt: string; user: User }> {
    if ("id" in update) delete update.id;
    const user = await this.db.query<MongoUser>({
      collection: "users",
      query: { id },
    });

    if (user.length === 0) {
      throw new Error("User not found");
    }

    await this.db.update("users", { id }, { $set: update });

    const res: User & { password?: string } = this.removeObjectId({ ...user[0], ...update });
    delete res.password;

    return {
      jwt: this.generateJWT(res),
      user: res,
    };
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = await this.db.query<MongoUser>({
      collection: "users",
      query: { id },
    });

    if (user.length === 0) {
      throw new Error("User not found");
    }

    return await this.db.remove("users", { id });
  }

  async getUser(jwt: string): Promise<User> {
    try {
      const tokenUser = await verifyToken(this.jwt.secret, jwt);
      const user = await this.db.query<MongoUser>({
        collection: "users",
        query: { id: new ObjectId(tokenUser.sub) },
      });

      if (user.length === 0) {
        throw new Error("User not found");
      }

      return this.removeObjectId(user[0]);
    } catch {
      throw new Error("Invalid token");
    }
  }

  private removeObjectId(user: MongoUser): User {
    // @ts-expect-error
    user.id = user._id.toString();
    // @ts-expect-error
		delete user._id;
		// @ts-expect-error
		return user;
  }

  private generateJWT(user: User): string {
    return generateToken(this.jwt.secret, user);
  }

  getCookieString(jwt: string): string {
    return `${this.jwt.cookie}=${jwt}; Domain=${this.domain}; Path=/; HttpOnly; SameSite=Strict`;
  }
}

export { type DatabaseAdapterOptions, type User };
