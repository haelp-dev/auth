import jwt from "jsonwebtoken";
import { parse } from "cookie";
import { DatabaseAdapter, type DatabaseAdapterOptions } from "./database";
import { PasswordUser, User } from "./types";
import { sha256 } from "./utils";
import { verifyToken } from "./utils/token";
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
  private jwt: { cookie: string; secret: string };
  private domain: string;
  constructor(options: AuthOptions) {
    this.db = new DatabaseAdapter(options.database);

    this.jwt = {
      cookie: options.jwt.cookie || "auth.token",
      secret: options.jwt.secret,
    };

    this.domain = options.domain;
  }

  async createUser(newUser: Omit<PasswordUser, "id">): Promise<User> {
    const user = await this.db.query<User>({
      collection: "users",
      query: { email: newUser.email },
    });
    if (user.length > 0) {
      throw new Error("User already exists");
    }

    const pwHash = sha256(newUser.password);

    const insertionRes = await this.db.insert("users", {
      ...newUser,
      password: pwHash,
    });

    const res: User & { password?: string } = {
      ...newUser,
      id: insertionRes.insertedId.toString(),
    };
    delete res.password;

    return res;
  }

  async authenticateUser(identifier: string, password: string): Promise<User> {
    const user = (
      await this.db.query<PasswordUser>({
        collection: "users",
        query: {
          $or: [{ email: identifier }, { username: identifier }],
          password: sha256(password),
        },
      })
    )[0];

    if (!user) {
      throw new Error("User not found");
    }

    const res: User & { password?: string } = { ...user };
    delete res.password;

    return res;
  }

  async updateUser(id: string, update: Partial<Omit<PasswordUser, "id">>): Promise<User> {
    if ("id" in update) delete update.id;
    const user = await this.db.query<User>({
      collection: "users",
      query: { id },
    });

    if (user.length === 0) {
      throw new Error("User not found");
    }

    await this.db.update("users", { id }, { $set: update });

    const res: User & { password?: string } = { ...user[0], ...update };
    delete res.password;

    return res;
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = await this.db.query<User>({
      collection: "users",
      query: { id },
    });

    if (user.length === 0) {
      throw new Error("User not found");
    }

    return await this.db.remove("users", { id });
  }

  async readRequest(req: Request): Promise<User | null> {
    const cookies = parse(req.headers.get("cookie") || "");

    if (!cookies.token || typeof cookies.token !== "string") {
      return null;
    }

    try {
      const tokenUser = await verifyToken(this.jwt.secret, cookies[this.jwt.cookie]);
      const user = await this.db.query<User>({
        collection: "users",
        query: { id: new ObjectId(tokenUser.id) },
      });

      if (user.length === 0) {
        return null;
      }

      return user[0];
    } catch {
      return null;
    }
  }

  async writeResponse(res: Response, user: User | null): Promise<void> {
    if (user) {
      const token = jwt.sign({ id: user.id }, this.jwt.secret);
      res.headers.set(
        "Set-Cookie",
        `${this.jwt.cookie}=${token}; Path=/; Domain=${this.domain}; HttpOnly; Secure; SameSite=Strict`
      );
    } else {
      res.headers.set(
        "Set-Cookie",
        `${this.jwt.cookie}=; Path=/; Domain=${this.domain}; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
      );
    }
  }
}
