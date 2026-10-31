import type { NextConfig } from 'next';
// Bottom-right keeps the dev badge off the sidebar and panel tabs; errors still surface.
const config: NextConfig = { poweredByHeader: false, devIndicators: { position: 'bottom-right' } };
export default config;
