"""
Test runner script for Kitchen Assistant AI
"""
import subprocess
import sys
import os


def run_tests():
    """Run all tests with coverage"""
    print("""
    ╔════════════════════════════════════════════════════════════╗
    ║   Kitchen Assistant AI - Test Suite                       ║
    ║   Running unit and integration tests                      ║
    ╚════════════════════════════════════════════════════════════╝
    """)
    
    # Check if pytest is installed
    try:
        import pytest
    except ImportError:
        print("❌ pytest not found. Installing test dependencies...")
        subprocess.run([sys.executable, "-m", "pip", "install", 
                       "pytest", "pytest-cov", "pytest-mock", "flask-testing"])
    
    # Run tests with coverage
    print("\n📊 Running tests with coverage report...\n")
    
    result = subprocess.run([
        sys.executable, "-m", "pytest",
        "-v",  # Verbose
        "--cov=app",  # Coverage for app directory
        "--cov-report=html",  # HTML report
        "--cov-report=term",  # Terminal report
        "tests/"
    ])
    
    if result.returncode == 0:
        print("\n✅ All tests passed!")
        print(f"\n📂 Coverage report: {os.path.abspath('htmlcov/index.html')}")
        print("   Open it in your browser to see detailed coverage")
    else:
        print("\n❌ Some tests failed. Please review the output above.")
    
    return result.returncode


def run_unit_tests_only():
    """Run only unit tests"""
    print("\n🔬 Running unit tests only...\n")
    
    result = subprocess.run([
        sys.executable, "-m", "pytest",
        "-v",
        "tests/test_*.py",  # Only files starting with test_
        "--ignore=tests/integration"
    ])
    
    return result.returncode


def run_integration_tests_only():
    """Run only integration tests"""
    print("\n🔗 Running integration tests only...\n")
    
    result = subprocess.run([
        sys.executable, "-m", "pytest",
        "-v",
        "tests/integration/"
    ])
    
    return result.returncode


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Kitchen Assistant AI Test Runner")
    parser.add_argument("--unit", action="store_true", help="Run only unit tests")
    parser.add_argument("--integration", action="store_true", help="Run only integration tests")
    
    args = parser.parse_args()
    
    if args.unit:
        exit_code = run_unit_tests_only()
    elif args.integration:
        exit_code = run_integration_tests_only()
    else:
        exit_code = run_tests()
    
    sys.exit(exit_code)
