/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["jsforce"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({ jsforce: "commonjs jsforce" });
    }
    return config;
  },
};

export default nextConfig;
