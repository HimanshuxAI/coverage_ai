import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/functions/v1/read-case-registry",
        destination: "/api/workflow/read-case-registry",
      },
      {
        source: "/functions/v1/update-case-registry-validation",
        destination: "/api/workflow/validate-activation",
      },
      {
        source: "/functions/v1/update-case-validation",
        destination: "/api/workflow/validate-activation",
      },
      {
        source: "/functions/v1/calculate-expected-contribution",
        destination: "/api/workflow/calculate-contribution",
      },
      {
        source: "/functions/v1/tool-15-call",
        destination: "/api/workflow/calculate-contribution",
      },
      {
        source: "/functions/v1/update-versioned-resolution-graph",
        destination: "/api/workflow/build-resolution-graph",
      },
      {
        source: "/functions/v1/tool-17-call",
        destination: "/api/workflow/read-consolidated-evidence",
      },
      {
        source: "/functions/v1/read-consolidated-specialist-evidence",
        destination: "/api/workflow/read-consolidated-evidence",
      },
      {
        source: "/functions/v1/update-blocker-status",
        destination: "/api/workflow/resolve-blockers",
      },
      {
        source: "/functions/v1/tool-16-call",
        destination: "/api/workflow/resolve-blockers",
      },
      {
        source: "/functions/v1/generate-decision-ready-packet",
        destination: "/api/workflow/generate-decision-packet",
      },
      {
        source: "/functions/v1/store-human-outcome",
        destination: "/api/workflow/submit-human-decision",
      },
    ];
  },
};

export default nextConfig;
