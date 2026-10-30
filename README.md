# React + TypeScript + Vite

## Render deployment

The Render Web Service serves both the website and API. Administrator and
cashier accounts, products, sales, customers, supplier stock, payments and
finance records are stored in PostgreSQL and shared across devices.

1. Create a PostgreSQL database in Render.
2. Create a Render Web Service from this repository. Leave **Root Directory**
   empty. Set the build command to `npm install && npm run build && npm install
   --prefix server` and the start command to `npm start --prefix server`.
3. Add `DATABASE_URL` to the Web Service using the database's **Internal Database
   URL**. The site and API share the same origin, so `VITE_API_URL` and
   `FRONTEND_ORIGIN` are not needed.
4. Open the service URL, choose **Admin**, and create the first administrator.
   The API creates the required PostgreSQL tables automatically on startup.

For local API development, copy `server/.env.example` to `server/.env` and set
`DATABASE_URL` to Render's **External Database URL**. Set `PGSSLMODE=require`
when using that external connection. Build the frontend with `npm run build`,
then run `npm run server:dev`.

Moving the API to PostgreSQL does not transfer accounts from a previous MongoDB
database. Create the first admin again and re-add cashier accounts. On the first
administrator sign-in after shared POS storage is deployed, the product catalog
from that browser initializes the shared catalog; legacy browser-local sales and
finance records are not imported. Use **Admin → Finance → Reset sales & supplier
data** to clear shared transactions while keeping products and accounts.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
