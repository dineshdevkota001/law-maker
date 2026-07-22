import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Proxy all /api/* requests to the FastAPI backend in development.
        // This avoids CORS issues and lets relative URLs work in the browser.
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL ?? "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
