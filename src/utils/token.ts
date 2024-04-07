import jwt from "jsonwebtoken";
import { User } from "../types";

export type JWTUser = Pick<User, 'id'>;

export const generateToken = (key: string, user: User): string => {
	const payload: JWTUser = { id: user.id };
	return jwt.sign(payload, key);
}

export const verifyToken = (key: string, token: string): Promise<JWTUser> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, key, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as JWTUser);
      }
    });
  });
};