"""
Create the initial admin user.

Usage:
    python scripts/setup_admin.py --username admin --password secret123
    python scripts/setup_admin.py --username admin --password secret123 --display-name "Admin User"
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.api.auth import hash_password
from src.database.models import User, create_tables, get_session


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an admin user")
    parser.add_argument("--username", required=True, help="Admin username")
    parser.add_argument("--password", required=True, help="Admin password")
    parser.add_argument("--display-name", default=None, help="Display name (defaults to username)")
    args = parser.parse_args()

    database_url = os.environ.get(
        "DATABASE_URL", "postgresql://intel:password@localhost:5432/whatsapp_intel"
    )

    create_tables(database_url)
    session = get_session(database_url)

    try:
        existing = session.query(User).filter(User.username == args.username).first()
        if existing:
            print(f"User '{args.username}' already exists.")
            sys.exit(1)

        user = User(
            username=args.username,
            password_hash=hash_password(args.password),
            display_name=args.display_name or args.username,
            role="admin",
            is_active=True,
        )
        session.add(user)
        session.commit()
        print(f"Admin user '{args.username}' created successfully.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
