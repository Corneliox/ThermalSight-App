# Contributing to ThermalSight

Thank you for your interest in contributing to ThermalSight. We welcome academic collaborations, bug reports, feature proposals, and code contributions that advance biomedical thermography and non-invasive diabetic foot monitoring.

---

## 1. Non-Commercial Licensing Policy

ThermalSight is licensed under the **PolyForm Noncommercial License 1.0.0**. By contributing code, documentation, mathematical algorithms, or analytical scripts to this repository, you agree that:
1. Your contributions will be distributed under the PolyForm Noncommercial License 1.0.0.
2. The software and all derived works remain free for academic, scientific research, and non-commercial educational use.
3. Any commercial use or closed-source commercial exploitation requires explicit written authorization and contribution agreement from the primary authors.

---

## 2. Code of Conduct and Research Integrity

Contributors are expected to adhere to standard scientific and academic research integrity principles:
- Maintain mathematical rigor and transparency in all physical units, coordinate transformations, and directional metrics (e.g., circular statistics for angular gradients).
- Ensure patient privacy and HIPAA/GDPR anonymization: never commit raw patient identifiers or unmasked clinical metadata to the repository.
- Communicate respectfully, objectively, and professionally across all discussions, issues, and code reviews.

---

## 3. Development Setup and Workflow

### Repository Structure
- `backend/`: Python scientific backend (`analyzer.py`), image processing pipelines, unit tests (`test_*.py`), and requirements.
- `src/`: Electron desktop application wrapper, React client UI, and Vite bundler configuration.
- `ppg_workbench.py`: Standalone native Tkinter/Matplotlib research workbench for deep plantar biomechanical analysis and multi-protocol cohort recomputation.

### Contribution Process
1. **Fork the Repository**: Create your personal fork on GitHub.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Install Dependencies**:
   - Frontend:
     ```bash
     cd src
     npm install
     ```
   - Python Backend:
     ```bash
     pip install -r backend/requirements.txt
     ```
4. **Implement and Verify**:
   - Ensure all existing unit tests pass:
     ```bash
     python -m unittest backend/test_cohort_v184.py backend/test_regression_v184.py
     ```
   - Ensure the frontend builds cleanly without Vite or React syntax errors:
     ```bash
     cd src
     npm run build
     ```
5. **Commit and Submit**:
   - Write concise, conventional commit messages (e.g., `feat(gradient): add polar angle smoothing`, `fix(export): resolve lock issue`).
   - Open a Pull Request against the `main` branch with a clear description of changes, methodology, and verification steps.

---

## 4. Reporting Issues

When reporting an anomaly, please provide:
- The operating system and version (e.g., Windows 11 64-bit, macOS 14.5).
- Python environment details (`python --version`, Anaconda vs standard venv).
- The ThermalSight application version (e.g., v1.8.5).
- Complete error tracebacks from the Electron console or terminal.
- Anonymized sample data or reproduction steps, if applicable.

---

## 5. Contact and Inquiries

For academic collaborations, joint research proposals, or licensing inquiries regarding institutional/commercial deployments, please open a discussion on GitHub or contact the primary authors directly via the project repository.
