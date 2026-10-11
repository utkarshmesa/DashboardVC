import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // /spike is a separate throwaway package; keep it out of the app build.
  outputFileTracingExcludes: { '*': ['spike/**'] },
};

export default nextConfig;
