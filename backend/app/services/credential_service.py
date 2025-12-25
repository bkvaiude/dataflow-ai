"""
Credential Service
Handles secure storage and retrieval of database credentials with AES-256-GCM encryption.
"""

import os
import json
import hashlib
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend


class CredentialService:
    """
    Service for encrypting and managing database credentials.
    Uses AES-256-GCM for authenticated encryption with singleton pattern.
    """

    def __init__(self):
        from app.config import settings

        # Derive encryption key from app secret
        encryption_secret = settings.credential_encryption_key

        if not encryption_secret:
            # Development fallback key (print warning)
            encryption_secret = "dev-key-change-in-production-minimum-32-chars-required"
            print("⚠️  WARNING: Using development encryption key. Set CREDENTIAL_ENCRYPTION_KEY in production!")

        # Derive 256-bit key using SHA-256
        self.encryption_key = hashlib.sha256(encryption_secret.encode()).digest()
        self._db_session = None

    def _get_session(self):
        """Get database session"""
        from app.services.db_service import db_service
        return db_service._get_session()

    def _encrypt_credentials(self, credentials_dict: Dict[str, Any]) -> Dict[str, bytes]:
        """
        Encrypt credentials using AES-256-GCM

        Returns:
            dict with 'ciphertext', 'iv', and 'tag' as bytes
        """
        # Serialize credentials to JSON
        plaintext = json.dumps(credentials_dict).encode('utf-8')

        # Generate random IV (96 bits recommended for GCM)
        iv = os.urandom(12)

        # Encrypt with AES-256-GCM
        aesgcm = AESGCM(self.encryption_key)
        ciphertext = aesgcm.encrypt(iv, plaintext, None)

        # GCM combines ciphertext + tag, split them
        # Last 16 bytes are the authentication tag
        tag = ciphertext[-16:]
        encrypted_data = ciphertext[:-16]

        return {
            'ciphertext': encrypted_data,
            'iv': iv,
            'tag': tag
        }

    def _decrypt_credentials(self, encrypted_data: bytes, iv: bytes, tag: bytes) -> Dict[str, Any]:
        """
        Decrypt credentials using AES-256-GCM

        Args:
            encrypted_data: The encrypted credential data
            iv: Initialization vector
            tag: Authentication tag

        Returns:
            Decrypted credentials as dictionary
        """
        # Recombine ciphertext and tag
        ciphertext = encrypted_data + tag

        # Decrypt with AES-256-GCM
        aesgcm = AESGCM(self.encryption_key)
        plaintext = aesgcm.decrypt(iv, ciphertext, None)

        # Parse JSON
        return json.loads(plaintext.decode('utf-8'))

    def store_credentials(
        self,
        user_id: str,
        name: str,
        source_type: str,
        credentials: Dict[str, Any],
        test_connection: bool = True
    ) -> Dict[str, Any]:
        """
        Store encrypted database credentials

        Args:
            user_id: User ID
            name: Friendly name for this credential
            source_type: Database type (postgresql, mysql)
            credentials: Dict with host, port, database, username, password
            test_connection: Whether to test connection before storing

        Returns:
            Credential object as dictionary
        """
        from app.db.models import Credential, User

        # Test connection if requested
        is_valid = False
        if test_connection:
            test_result = self.test_connection(source_type, credentials)
            is_valid = test_result['success']
            if not is_valid:
                raise ValueError(f"Connection test failed: {test_result.get('error', 'Unknown error')}")

        # Encrypt credentials
        encrypted = self._encrypt_credentials(credentials)

        # Generate credential ID
        credential_id = str(uuid.uuid4())

        # Save to database
        session = self._get_session()
        try:
            # Ensure user exists
            user = session.query(User).filter(User.id == user_id).first()
            if not user:
                user = User(id=user_id)
                session.add(user)
                session.flush()

            # Create credential
            credential = Credential(
                id=credential_id,
                user_id=user_id,
                name=name,
                source_type=source_type,
                encrypted_credentials=encrypted['ciphertext'],
                encryption_iv=encrypted['iv'],
                encryption_tag=encrypted['tag'],
                host=credentials.get('host'),
                database=credentials.get('database'),
                port=credentials.get('port'),
                is_valid=is_valid,
                last_validated_at=datetime.utcnow() if is_valid else None
            )

            session.add(credential)
            session.commit()
            session.refresh(credential)

            print(f"[CREDENTIAL] Stored encrypted credentials '{name}' for user {user_id}")
            return credential.to_dict()

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def get_decrypted_credentials(self, user_id: str, credential_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve and decrypt credentials

        Args:
            user_id: User ID
            credential_id: Credential ID

        Returns:
            Decrypted credentials dictionary or None
        """
        from app.db.models import Credential

        session = self._get_session()
        try:
            credential = session.query(Credential).filter(
                Credential.id == credential_id,
                Credential.user_id == user_id
            ).first()

            if not credential:
                return None

            # Decrypt credentials
            decrypted = self._decrypt_credentials(
                credential.encrypted_credentials,
                credential.encryption_iv,
                credential.encryption_tag
            )

            return {
                'id': credential.id,
                'name': credential.name,
                'source_type': credential.source_type,
                'credentials': decrypted,
                'is_valid': credential.is_valid,
                'last_validated_at': credential.last_validated_at
            }

        finally:
            session.close()

    def list_credentials(self, user_id: str) -> List[Dict[str, Any]]:
        """
        List all credentials for a user (without decrypting)

        Args:
            user_id: User ID

        Returns:
            List of credential metadata
        """
        from app.db.models import Credential

        session = self._get_session()
        try:
            credentials = session.query(Credential).filter(
                Credential.user_id == user_id
            ).all()

            return [c.to_dict() for c in credentials]

        finally:
            session.close()

    def delete_credentials(self, user_id: str, credential_id: str) -> bool:
        """
        Delete credentials

        Args:
            user_id: User ID
            credential_id: Credential ID

        Returns:
            True if deleted, False if not found
        """
        from app.db.models import Credential

        session = self._get_session()
        try:
            credential = session.query(Credential).filter(
                Credential.id == credential_id,
                Credential.user_id == user_id
            ).first()

            if credential:
                session.delete(credential)
                session.commit()
                print(f"[CREDENTIAL] Deleted credential {credential_id}")
                return True

            return False

        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def test_connection(self, source_type: str, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """
        Test database connection

        Args:
            source_type: Database type (postgresql, mysql)
            credentials: Connection credentials

        Returns:
            Dict with 'success' boolean and optional 'error' message
        """
        if source_type == 'postgresql':
            return self._test_postgresql_connection(credentials)
        elif source_type == 'mysql':
            return self._test_mysql_connection(credentials)
        else:
            return {
                'success': False,
                'error': f'Unsupported source type: {source_type}'
            }

    def _test_postgresql_connection(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """Test PostgreSQL connection"""
        try:
            import psycopg2

            conn = psycopg2.connect(
                host=credentials.get('host'),
                port=credentials.get('port', 5432),
                database=credentials.get('database'),
                user=credentials.get('username'),
                password=credentials.get('password'),
                connect_timeout=5
            )

            # Test query
            cursor = conn.cursor()
            cursor.execute('SELECT version()')
            version = cursor.fetchone()[0]
            cursor.close()
            conn.close()

            return {
                'success': True,
                'message': 'Connection successful',
                'version': version
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _test_mysql_connection(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """Test MySQL connection"""
        try:
            import pymysql

            conn = pymysql.connect(
                host=credentials.get('host'),
                port=credentials.get('port', 3306),
                database=credentials.get('database'),
                user=credentials.get('username'),
                password=credentials.get('password'),
                connect_timeout=5
            )

            # Test query
            cursor = conn.cursor()
            cursor.execute('SELECT VERSION()')
            version = cursor.fetchone()[0]
            cursor.close()
            conn.close()

            return {
                'success': True,
                'message': 'Connection successful',
                'version': version
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


# Singleton instance
credential_service = CredentialService()
