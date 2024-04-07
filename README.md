# @haelp/auth

This is a simple authentication library.

## Installation

Use the package manager [npm](https://www.npmjs.com/) to install @haelp/auth.

```bash
npm install @haelp/auth
```

## Usage

```javascript
import { Auth } from '@haelp/auth';

const auth = new Auth({
	domain: ".example.com",
	database: {
		uri: process.env.MONGODB_URI,
	},
	jwt: {
		secret: process.env.JWT_SECRET,
	}
});
```

## License
[MIT](https://choosealicense.com/licenses/mit/)

