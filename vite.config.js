import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const pages = ['privacy-policy', 'terms-of-service', 'warranty-policy', 'return-policy', 'shipping-policy', 'quality-check-policy'];

// Serve /privacy-policy (no trailing slash) as /privacy-policy/index.html instead of falling back to the home page.
const cleanUrls = () => {
  const rewrite = (req, _res, next) => {
    const [path, query = ''] = req.url.split('?');
    const slug = path.replace(/^\/|\/$/g, '');
    if (pages.includes(slug)) req.url = `/${slug}/index.html${query ? `?${query}` : ''}`;
    next();
  };
  return {
    name: 'clean-urls',
    configureServer: (server) => { server.middlewares.use(rewrite); },
    configurePreviewServer: (server) => { server.middlewares.use(rewrite); },
  };
};

// The page runs on :5500; config.js points the API at localhost:8080.
export default defineConfig({
  plugins: [cleanUrls()],
  server: { port: 5500, strictPort: true, proxy: { '/api': 'http://localhost:8787' } },
  preview: { port: 5500, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        ...Object.fromEntries(pages.map((p) => [p, resolve(import.meta.dirname, p, 'index.html')])),
      },
    },
  },
});
