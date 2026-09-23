@echo off
title ThermalSight PPG-PGA Interactive Workbench
echo Starting ThermalSight PPG-PGA Interactive Workbench...
python "%~dp0ppg_workbench.py"
if errorlevel 1 (
    echo.
    echo An error occurred running the workbench.
    pause
)
