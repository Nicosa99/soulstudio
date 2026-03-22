import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Turbopack HMR and Dev resources to load on the production proxy domain
  // @ts-ignore - Supress TS error if type is not fully updated yet
  allowedDevOrigins: ['studio.soultune.app'],
};

export default nextConfig;
