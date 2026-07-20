import os
import sys
import secrets
import datetime
from sqlalchemy.orm import Session

# Add backend directory to sys.path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.models import User, AuditLog
from app.routers.auth import hash_password

def create_admin(username, password, email):
    db: Session = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            print(f"[-] User '{username}' already exists. Cannot create admin.")
            return

        # Validate password length
        if len(password) < 8:
            print("[-] Password must be at least 8 characters long.")
            return

        user_id = secrets.token_hex(8)
        hashed = hash_password(password)
        
        user = User(
            id=user_id,
            username=username,
            hashed_password=hashed,
            email=email,
            role="SystemAdmin",
            created_at=datetime.datetime.utcnow().isoformat()
        )
        db.add(user)
        
        # Add Audit log
        audit = AuditLog(
            id=secrets.token_hex(8),
            userId=user_id,
            action="SYSTEM_PROVISION",
            details=f"Admin {username} provisioned via backend CLI",
            timestamp=datetime.datetime.utcnow().isoformat()
        )
        db.add(audit)
        
        db.commit()
        print(f"[+] Successfully created SystemAdmin user: {username}")

    except Exception as e:
        print(f"[-] Error creating admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Create a SystemAdmin user.")
    parser.add_argument("--username", required=True, help="Admin username")
    parser.add_argument("--password", required=True, help="Admin password (min 8 chars)")
    parser.add_argument("--email", required=True, help="Admin email")

    args = parser.parse_args()
    create_admin(args.username, args.password, args.email)
