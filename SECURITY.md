# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please report it responsibly.

**Please do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. Email: Open a private security advisory via GitHub
2. Go to: https://github.com/juyel-dev/Notes-Print-Optimizer/security/advisories/new
3. Describe the vulnerability in detail
4. Include steps to reproduce if possible

### What to Expect

- Acknowledgment within 48 hours
- A fix or mitigation plan within 7 days
- Credit in the release notes (unless you prefer anonymity)

## Security Considerations

This application runs entirely in the browser (client-side). Key points:

- No server-side processing of user PDFs
- No data is uploaded to any server (except optional feedback)
- All PDF processing happens locally via WebAssembly and Web Workers
- Service Worker caches only static assets (no user data)
