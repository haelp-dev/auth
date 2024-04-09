import { ObjectId } from "mongodb";

export { JWTUser } from "./utils/token";
export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  pfp: string;
}

export type MongoUser = Omit<User, "id"> & { _id: ObjectId };

export type PasswordUser = User & { password: string };
