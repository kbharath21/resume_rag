import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_AUTH_API_URL: process.env.NEXT_PUBLIC_AUTH_API_URL || 'https://resumerag.kanugulabharathkumar.me/api/auth',
    NEXT_PUBLIC_SEARCH_API_URL: process.env.NEXT_PUBLIC_SEARCH_API_URL || 'https://resumerag.kanugulabharathkumar.me/api/search',
    NEXT_PUBLIC_STORING_API_URL: process.env.NEXT_PUBLIC_STORING_API_URL || 'https://resumerag.kanugulabharathkumar.me/api/storing',
  },
};

export default nextConfig;
