export { JWTUser } from './utils/token';
export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  pfp: string;
}


export type PasswordUser = User & { password: string };
