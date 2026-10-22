# Security Policy

## 1. Supported Versions

Security patches and stability updates are applied to the active production branch.

| Version | Supported          |
| ------- | ------------------ |
| 1.8.x   | Yes (Current)      |
| < 1.8.0 | No                 |

---

## 2. Biomedical Data and Patient Privacy Considerations

ThermalSight is designed to process thermal radiometric datasets locally on client workstations without requiring cloud upload. To uphold clinical ethics and international health data standards (including HIPAA and GDPR):
- **Local-Only Processing**: The standalone Desktop Application performs all radiometric unpacking, polygon masking, and statistical exports completely offline on the local machine.
- **Web Demo Isolation**: The GitHub Pages trial web client runs client-side within the user's browser sandbox and does not transmit uploaded thermal images to external servers.
- **De-Identification**: Users must ensure all metadata fields containing direct patient health information (PHI) are scrubbed before publishing or sharing sample session JSON files.

---

## 3. Reporting a Vulnerability

If you identify a security vulnerability, execution exploit, path traversal flaw, or dependency vulnerability in ThermalSight:
1. **Do not disclose the vulnerability publicly** in GitHub Issues or pull requests.
2. Please submit a private advisory through GitHub Security Advisories or contact the maintainers directly via repository security channels.
3. Provide a detailed summary, proof-of-concept script, and the affected version.
4. The maintainers will acknowledge receipt within 48 to 72 hours, assess the impact, and release an update promptly.
