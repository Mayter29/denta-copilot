import type { NextConfig } from 'next';
// Top-right keeps the dev badge off the sidebar controls; errors still surface.
const config: NextConfig = { poweredByHeader: false, devIndicators: { position: 'top-right' } };
export default config;
