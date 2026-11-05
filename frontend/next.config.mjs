/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    VITE_API_URL:
      process.env.NEXT_PUBLIC_API_URL ??
      process.env.VITE_API_URL ??
      'http://localhost:3000/api/v1',
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ??
      process.env.VITE_API_URL ??
      'http://localhost:3000/api/v1',
  },
}

export default nextConfig
