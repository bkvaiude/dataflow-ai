#!/usr/bin/env python3
"""
Phase 1D Integration Tests
Comprehensive test suite for CDC Platform Phase 1 functionality.

Tests:
1. Credentials API - CRUD operations + connection testing
2. Sources API - Schema discovery + CDC readiness checks
3. End-to-end flow - Create credential → Discover schema → Check CDC readiness

Run with: python -m pytest tests/test_phase1d_integration.py -v
Or directly: python tests/test_phase1d_integration.py
"""

import requests
import json
import sys
import time
from typing import Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000/api"
CREDENTIALS_URL = f"{BASE_URL}/credentials"
SOURCES_URL = f"{BASE_URL}/sources"

# Test database configuration (uses the same PostgreSQL as the app)
TEST_DB_CONFIG = {
    "name": "Phase 1D Test Database",
    "source_type": "postgresql",
    "host": "postgres-local",  # Docker network hostname
    "port": 5432,
    "database": "dataflow",
    "username": "postgres",
    "password": "postgres",
    "test_connection": True
}


@dataclass
class TestResult:
    name: str
    passed: bool
    duration_ms: float
    message: str = ""
    details: Optional[Dict[str, Any]] = None


class Phase1DTestSuite:
    """Comprehensive test suite for Phase 1D integration testing"""

    def __init__(self):
        self.results: list[TestResult] = []
        self.credential_id: Optional[str] = None

    def run_test(self, name: str, test_func) -> TestResult:
        """Run a single test and record the result"""
        start_time = time.time()
        try:
            result = test_func()
            duration = (time.time() - start_time) * 1000
            test_result = TestResult(
                name=name,
                passed=result.get('passed', False),
                duration_ms=duration,
                message=result.get('message', ''),
                details=result.get('details')
            )
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            test_result = TestResult(
                name=name,
                passed=False,
                duration_ms=duration,
                message=f"Exception: {str(e)}"
            )

        self.results.append(test_result)
        return test_result

    # =========================================================================
    # Credentials API Tests
    # =========================================================================

    def test_create_credential(self) -> Dict[str, Any]:
        """Test creating a new credential with connection test"""
        response = requests.post(CREDENTIALS_URL, json=TEST_DB_CONFIG)

        if response.status_code == 201:
            data = response.json()
            self.credential_id = data.get('id')
            return {
                'passed': True,
                'message': f"Created credential: {data.get('name')} (ID: {self.credential_id})",
                'details': {
                    'id': data.get('id'),
                    'is_valid': data.get('is_valid'),
                    'source_type': data.get('source_type')
                }
            }
        else:
            return {
                'passed': False,
                'message': f"HTTP {response.status_code}: {response.text}"
            }

    def test_list_credentials(self) -> Dict[str, Any]:
        """Test listing all credentials"""
        response = requests.get(CREDENTIALS_URL)

        if response.status_code == 200:
            data = response.json()
            # Find our test credential
            test_cred = next((c for c in data if c.get('id') == self.credential_id), None)
            return {
                'passed': test_cred is not None,
                'message': f"Found {len(data)} credential(s), test credential {'found' if test_cred else 'NOT found'}",
                'details': {'count': len(data), 'credentials': [c.get('name') for c in data]}
            }
        else:
            return {
                'passed': False,
                'message': f"HTTP {response.status_code}: {response.text}"
            }

    def test_get_credential(self) -> Dict[str, Any]:
        """Test retrieving a specific credential with decrypted details"""
        if not self.credential_id:
            return {'passed': False, 'message': "No credential ID available"}

        response = requests.get(f"{CREDENTIALS_URL}/{self.credential_id}")

        if response.status_code == 200:
            data = response.json()
            creds = data.get('credentials', {})
            # Verify we can retrieve decrypted credentials
            has_password = 'password' in creds and creds['password'] == TEST_DB_CONFIG['password']
            return {
                'passed': has_password,
                'message': f"Retrieved credential with decrypted data",
                'details': {
                    'name': data.get('name'),
                    'has_credentials': bool(creds),
                    'decryption_verified': has_password
                }
            }
        else:
            return {
                'passed': False,
                'message': f"HTTP {response.status_code}: {response.text}"
            }

    def test_connection_test_stored(self) -> Dict[str, Any]:
        """Test connection using stored credentials"""
        if not self.credential_id:
            return {'passed': False, 'message': "No credential ID available"}

        response = requests.post(f"{CREDENTIALS_URL}/{self.credential_id}/test")

        if response.status_code == 200:
            data = response.json()
            return {
                'passed': data.get('success', False),
                'message': f"Connection test: {'SUCCESS' if data.get('success') else 'FAILED'}",
                'details': {
                    'success': data.get('success'),
                    'version': data.get('version'),
                    'error': data.get('error')
                }
            }
        else:
            return {
                'passed': False,
                'message': f"HTTP {response.status_code}: {response.text}"
            }

    def test_connection_test_inline(self) -> Dict[str, Any]:
        """Test connection without storing credentials"""
        payload = {
            "source_type": TEST_DB_CONFIG["source_type"],
            "host": TEST_DB_CONFIG["host"],
            "port": TEST_DB_CONFIG["port"],
            "database": TEST_DB_CONFIG["database"],
            "username": TEST_DB_CONFIG["username"],
            "password": TEST_DB_CONFIG["password"]
        }

        response = requests.post(f"{CREDENTIALS_URL}/test", json=payload)

        if response.status_code == 200:
            data = response.json()
            return {
                'passed': data.get('success', False),
                'message': f"Inline connection test: {'SUCCESS' if data.get('success') else 'FAILED'}",
                'details': data
            }
        else:
            return {
                'passed': False,
                'message': f"HTTP {response.status_code}: {response.text}"
            }

    # =========================================================================
    # Sources API Tests
    # =========================================================================

    def test_schema_discovery(self) -> Dict[str, Any]:
        """Test schema discovery for public schema"""
        if not self.credential_id:
            return {'passed': False, 'message': "No credential ID available"}

        payload = {
            "credential_id": self.credential_id,
            "schema_filter": "public",
            "include_row_counts": True
        }

        response = requests.post(f"{SOURCES_URL}/discover", json=payload)

        if response.status_code == 200:
            data = response.json()
            tables = data.get('tables', [])
            table_count = data.get('table_count', 0)

            # Count CDC-eligible tables
            cdc_eligible = sum(1 for t in tables if t.get('cdc_eligible', False))

            return {
                'passed': table_count > 0,
                'message': f"Discovered {table_count} tables ({cdc_eligible} CDC-eligible)",
                'details': {
                    'table_count': table_count,
                    'cdc_eligible_count': cdc_eligible,
                    'tables': [t.get('table_name') for t in tables[:10]],  # First 10
                    'relationship_graph': data.get('relationship_graph')
                }
            }
        else:
            return {
                'passed': False,
                'message': f"HTTP {response.status_code}: {response.text}"
            }

    def test_cdc_readiness(self) -> Dict[str, Any]:
        """Test CDC readiness check"""
        if not self.credential_id:
            return {'passed': False, 'message': "No credential ID available"}

        payload = {
            "credential_id": self.credential_id
        }

        response = requests.post(f"{SOURCES_URL}/check-readiness", json=payload)

        if response.status_code == 200:
            data = response.json()
            checks = data.get('checks', {})

            # Count pass/fail/warning
            pass_count = sum(1 for c in checks.values() if c.get('status') == 'pass')
            fail_count = sum(1 for c in checks.values() if c.get('status') == 'fail')
            warn_count = sum(1 for c in checks.values() if c.get('status') == 'warning')

            return {
                'passed': True,  # Test passes if we get a response
                'message': f"CDC Ready: {data.get('overall_ready')} | Provider: {data.get('provider_name')} | Checks: {pass_count} pass, {fail_count} fail, {warn_count} warn",
                'details': {
                    'overall_ready': data.get('overall_ready'),
                    'provider': data.get('provider'),
                    'provider_name': data.get('provider_name'),
                    'server_version': data.get('server_version'),
                    'checks': {k: v.get('status') for k, v in checks.items()},
                    'recommendations_count': len(data.get('recommendations', []))
                }
            }
        else:
            return {
                'passed': False,
                'message': f"HTTP {response.status_code}: {response.text}"
            }

    def test_get_cached_schemas(self) -> Dict[str, Any]:
        """Test retrieving cached schema discovery results"""
        if not self.credential_id:
            return {'passed': False, 'message': "No credential ID available"}

        response = requests.get(f"{SOURCES_URL}/schemas/{self.credential_id}")

        if response.status_code == 200:
            data = response.json()
            return {
                'passed': True,
                'message': f"Retrieved {len(data)} cached schema entries",
                'details': {'count': len(data)}
            }
        else:
            return {
                'passed': False,
                'message': f"HTTP {response.status_code}: {response.text}"
            }

    # =========================================================================
    # Cleanup
    # =========================================================================

    def test_delete_credential(self) -> Dict[str, Any]:
        """Test deleting the test credential"""
        if not self.credential_id:
            return {'passed': False, 'message': "No credential ID available"}

        response = requests.delete(f"{CREDENTIALS_URL}/{self.credential_id}")

        if response.status_code == 204:
            return {
                'passed': True,
                'message': f"Deleted credential {self.credential_id}"
            }
        else:
            return {
                'passed': False,
                'message': f"HTTP {response.status_code}: {response.text}"
            }

    def test_verify_deletion(self) -> Dict[str, Any]:
        """Verify the credential was deleted"""
        if not self.credential_id:
            return {'passed': False, 'message': "No credential ID available"}

        response = requests.get(f"{CREDENTIALS_URL}/{self.credential_id}")

        # Should return 404 after deletion
        if response.status_code == 404:
            return {
                'passed': True,
                'message': "Credential properly deleted (404 Not Found)"
            }
        else:
            return {
                'passed': False,
                'message': f"Expected 404, got HTTP {response.status_code}"
            }

    # =========================================================================
    # Test Runner
    # =========================================================================

    def run_all_tests(self):
        """Run all Phase 1D integration tests"""
        print("=" * 70)
        print("Phase 1D Integration Test Suite")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)

        # Check server connectivity
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=5)
            print(f"\nServer Status: {'OK' if response.status_code == 200 else 'ERROR'}")
        except requests.exceptions.ConnectionError:
            print("\nERROR: Cannot connect to backend server at", BASE_URL)
            print("Make sure the backend is running: docker compose up backend")
            return False

        print("\n" + "-" * 70)
        print("CREDENTIALS API TESTS")
        print("-" * 70)

        tests = [
            ("Create Credential", self.test_create_credential),
            ("List Credentials", self.test_list_credentials),
            ("Get Credential (Decrypted)", self.test_get_credential),
            ("Test Connection (Stored)", self.test_connection_test_stored),
            ("Test Connection (Inline)", self.test_connection_test_inline),
        ]

        for name, test_func in tests:
            result = self.run_test(name, test_func)
            status = "PASS" if result.passed else "FAIL"
            print(f"  [{status}] {result.name} ({result.duration_ms:.0f}ms)")
            if result.message:
                print(f"        {result.message}")

        print("\n" + "-" * 70)
        print("SOURCES API TESTS")
        print("-" * 70)

        tests = [
            ("Schema Discovery", self.test_schema_discovery),
            ("CDC Readiness Check", self.test_cdc_readiness),
            ("Get Cached Schemas", self.test_get_cached_schemas),
        ]

        for name, test_func in tests:
            result = self.run_test(name, test_func)
            status = "PASS" if result.passed else "FAIL"
            print(f"  [{status}] {result.name} ({result.duration_ms:.0f}ms)")
            if result.message:
                print(f"        {result.message}")

        print("\n" + "-" * 70)
        print("CLEANUP TESTS")
        print("-" * 70)

        tests = [
            ("Delete Credential", self.test_delete_credential),
            ("Verify Deletion", self.test_verify_deletion),
        ]

        for name, test_func in tests:
            result = self.run_test(name, test_func)
            status = "PASS" if result.passed else "FAIL"
            print(f"  [{status}] {result.name} ({result.duration_ms:.0f}ms)")
            if result.message:
                print(f"        {result.message}")

        # Summary
        print("\n" + "=" * 70)
        print("TEST SUMMARY")
        print("=" * 70)

        passed = sum(1 for r in self.results if r.passed)
        failed = sum(1 for r in self.results if not r.passed)
        total = len(self.results)
        total_time = sum(r.duration_ms for r in self.results)

        print(f"\n  Total Tests: {total}")
        print(f"  Passed:      {passed} ({100*passed/total:.0f}%)")
        print(f"  Failed:      {failed} ({100*failed/total:.0f}%)")
        print(f"  Duration:    {total_time:.0f}ms")

        if failed > 0:
            print("\n  Failed Tests:")
            for r in self.results:
                if not r.passed:
                    print(f"    - {r.name}: {r.message}")

        print("\n" + "=" * 70)
        return failed == 0


def main():
    """Run the test suite"""
    suite = Phase1DTestSuite()
    success = suite.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
