#!/usr/bin/env python3
"""
Test script for Credentials API
Tests the credential storage, encryption, and connection testing functionality.
"""

import requests
import json

BASE_URL = "http://localhost:8000/api/credentials"


def test_create_credential():
    """Test creating a new credential"""
    print("\n1. Testing credential creation...")

    payload = {
        "name": "Test PostgreSQL Database",
        "source_type": "postgresql",
        "host": "localhost",
        "port": 5432,
        "database": "testdb",
        "username": "testuser",
        "password": "testpass123",
        "test_connection": False  # Skip connection test for demo
    }

    response = requests.post(BASE_URL, json=payload)
    print(f"   Status: {response.status_code}")

    if response.status_code == 201:
        data = response.json()
        print(f"   Created credential ID: {data['id']}")
        print(f"   Name: {data['name']}")
        print(f"   Source: {data['source_type']}")
        print(f"   Valid: {data['is_valid']}")
        return data['id']
    else:
        print(f"   Error: {response.text}")
        return None


def test_list_credentials():
    """Test listing credentials"""
    print("\n2. Testing credential listing...")

    response = requests.get(BASE_URL)
    print(f"   Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"   Found {len(data)} credential(s)")
        for cred in data:
            print(f"   - {cred['name']} ({cred['source_type']})")
    else:
        print(f"   Error: {response.text}")


def test_get_credential(credential_id):
    """Test getting a specific credential"""
    print(f"\n3. Testing credential retrieval (ID: {credential_id})...")

    response = requests.get(f"{BASE_URL}/{credential_id}")
    print(f"   Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"   Name: {data['name']}")
        print(f"   Source: {data['source_type']}")
        # Don't print actual credentials for security
        print(f"   Credentials keys: {list(data['credentials'].keys())}")
    else:
        print(f"   Error: {response.text}")


def test_connection_test():
    """Test connection testing without storing"""
    print("\n4. Testing connection test (without storing)...")

    payload = {
        "source_type": "postgresql",
        "host": "localhost",
        "port": 5432,
        "database": "dataflow",
        "username": "dataflow",
        "password": "dataflow"
    }

    response = requests.post(f"{BASE_URL}/test", json=payload)
    print(f"   Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"   Success: {data['success']}")
        if data['success']:
            print(f"   Version: {data.get('version', 'N/A')}")
        else:
            print(f"   Error: {data.get('error', 'Unknown')}")
    else:
        print(f"   Error: {response.text}")


def test_delete_credential(credential_id):
    """Test deleting a credential"""
    print(f"\n5. Testing credential deletion (ID: {credential_id})...")

    response = requests.delete(f"{BASE_URL}/{credential_id}")
    print(f"   Status: {response.status_code}")

    if response.status_code == 204:
        print("   ✓ Credential deleted successfully")
    else:
        print(f"   Error: {response.text}")


def main():
    print("=" * 60)
    print("Credentials API Test Suite")
    print("=" * 60)
    print("\nMake sure the backend server is running on http://localhost:8000")

    try:
        # Test credential creation
        credential_id = test_create_credential()

        if credential_id:
            # Test listing
            test_list_credentials()

            # Test retrieval
            test_get_credential(credential_id)

            # Test connection test
            test_connection_test()

            # Test deletion
            test_delete_credential(credential_id)

            # Verify deletion
            test_list_credentials()

        print("\n" + "=" * 60)
        print("Test Suite Completed")
        print("=" * 60)

    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Could not connect to backend server.")
        print("   Make sure the server is running: cd backend && uvicorn app.main:socket_app")


if __name__ == "__main__":
    main()
