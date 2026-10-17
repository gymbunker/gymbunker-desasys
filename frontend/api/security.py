import hashlib
import secrets

def hash_password(password: str) -> str:
    """Hash a password using salted PBKDF2-HMAC-SHA256."""
    if not password:
        return ""
    if password.startswith("pbkdf2:"):
        return password
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"pbkdf2:sha256:100000${salt}${key.hex()}"

def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verify a plain password against a stored hash (with legacy plaintext fallback)."""
    if not plain_password or not stored_hash:
        return False
    if not stored_hash.startswith("pbkdf2:"):
        return plain_password == stored_hash
    try:
        parts = stored_hash.split("$")
        if len(parts) != 3:
            return False
        algo_part, salt, key_hex = parts
        _, hash_name, iters = algo_part.split(":")
        new_key = hashlib.pbkdf2_hmac(hash_name, plain_password.encode("utf-8"), salt.encode("utf-8"), int(iters))
        return secrets.compare_digest(new_key.hex(), key_hex)
    except Exception:
        return False
